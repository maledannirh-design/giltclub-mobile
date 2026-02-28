import { auth, db } from "./firebase.js";
import { 
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  runTransaction,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { recalculateUserStats } from "./userStats.js";
import { runMigration } from "./migration.js";
import "./scanQR.js";

const BASE_SCAN_URL = "https://giltclub.app/scan";

/* =====================================================
   RENDER ADMIN PANEL
===================================================== */
export async function renderAdmin(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!user) return;

  const userSnap = await getDoc(doc(db,"users",user.uid));
  if(!userSnap.exists()){
    content.innerHTML = "User tidak ditemukan";
    return;
  }

  const userData = userSnap.data();

  if(userData.role !== "ADMIN" && userData.role !== "SUPERCOACH"){
    content.innerHTML = `<div style="padding:20px;">Akses ditolak.</div>`;
    return;
  }

  const snap = await getDocs(
    query(
      collection(db,"walletTransactions"),
      where("status","==","PENDING")
    )
  );

  let html = `
    <div class="admin-container">
      <h2>Pending Top Up</h2>
  `;

  /* =========================
     PENDING TOPUP
  ========================= */

  if(snap.empty){

    html += `
      <div style="opacity:.6;margin-bottom:20px;">
        Tidak ada top up pending
      </div>
    `;

  }else{

    for(const docSnap of snap.docs){

      const d = docSnap.data();

      const uSnap = await getDoc(doc(db,"users", d.userId));
      const username = uSnap.exists()
        ? uSnap.data().username || "User"
        : "User";

      html += `
        <div class="admin-trx">
          <div>
            <div>${username}</div>
            <div>Rp ${Number(d.amount || 0).toLocaleString("id-ID")}</div>
          </div>
          <div>
            <button onclick="approveTopup('${docSnap.id}','${d.userId}',${d.amount}, this)">
              Approve
            </button>
            <button onclick="rejectTopup('${docSnap.id}')">
              Reject
            </button>
          </div>
        </div>
      `;
    }
  }

  /* =========================
     QR VALIDATOR SECTION
  ========================= */

  html += `
      <hr style="margin:30px 0;">

      <button id="openCheckinQR" class="admin-btn">
        Scan Member QR
      </button>

      <div id="checkinModal" class="checkin-modal hidden">
        <div class="checkin-card">
          <h3>Scan Member</h3>

          <div id="reader" style="width:280px;margin:auto;"></div>

          <div style="margin-top:10px;">
            <button id="switchCameraBtn">🔄 Ganti Kamera</button>
          </div>

          <div id="checkinResult" style="margin-top:10px;"></div>

          <button id="closeCheckin">Tutup</button>
        </div>
      </div>

      <hr style="margin:30px 0;">

      <div id="adminBalanceAdjustment"></div>

      <hr style="margin:30px 0;">

      <button onclick="exportTopupHistory()">Export History Top Up</button>
      <button onclick="exportBookingHistory()">Export History Booking</button>
      <button onclick="exportAdjustmentHistory()">Export History Adjustment</button>
      <button onclick="exportMembersToCSV()">
  Export Data Members
</button>

    </div>
  `;

  content.innerHTML = html;

  /* =========================
     INIT SUB MODULES
  ========================= */

  await renderBalanceAdjustmentPanel();
  await setupQrValidator();   // 🔥 PENTING supaya QR aktif
}


/* =====================================================
   ADJUSTMENT (LEDGER CLEAN)
===================================================== */
async function handleBalanceAdjustment(){

  const userId = document.getElementById("adjustUser").value;
  const walletAmount = Number(document.getElementById("adjustAmount").value || 0);
  const gPointsAmount = Number(document.getElementById("adjustGPoints").value || 0);
  const reason = document.getElementById("adjustReason").value;
  const note = document.getElementById("adjustNote").value.trim();

  if(!walletAmount && !gPointsAmount){
    alert("Isi minimal salah satu nominal");
    return;
  }

  const userRef = doc(db,"users",userId);
  const walletLedgerRef = doc(collection(db,"walletLedger"));
  const gPointLedgerRef = doc(collection(db,"gPointLedger"));

  await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(userRef);
    if(!snap.exists()) throw new Error("User tidak ditemukan");

    const data = snap.data();

    const walletBefore = data.walletBalance || 0;
    const gBefore = data.gPoints || 0;

    const walletAfter = walletBefore + walletAmount;
    const gAfter = gBefore + gPointsAmount;

    if(walletAfter < 0) throw new Error("Saldo tidak boleh minus");
    if(gAfter < 0) throw new Error("GPoints tidak boleh minus");

    transaction.update(userRef,{
      walletBalance: walletAfter,
      gPoints: gAfter
    });

    if(walletAmount !== 0){
      transaction.set(walletLedgerRef,{
        userId,
        txId: "ADMIN_ADJUST_" + Date.now(),
        entryType: walletAmount > 0 ? "CREDIT" : "DEBIT",
        amount: walletAmount,
        balanceBefore: walletBefore,
        balanceAfter: walletAfter,
        description: reason,
        note,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
    }

    if(gPointsAmount !== 0){
      transaction.set(gPointLedgerRef,{
        userId,
        entryType: gPointsAmount > 0 ? "CREDIT" : "DEBIT",
        amount: gPointsAmount,
        balanceBefore: gBefore,
        balanceAfter: gAfter,
        description: reason,
        note,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
    }

  });

  alert("Adjustment berhasil");
  renderAdmin();
}

/* =====================================================
   EXPORT FUNCTIONS (RAPI & AMAN)
===================================================== */

function downloadCSV(filename, rows){

  const csvContent = rows
    .map(row => row.map(val => `"${val}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


/* =====================================================
   RENDER BALANCE ADJUSTMENT PANEL
===================================================== */
async function renderBalanceAdjustmentPanel(){

  const container = document.getElementById("adminBalanceAdjustment");
  if(!container) return;

  const usersSnap = await getDocs(collection(db,"users"));

  let options = "";

  usersSnap.forEach(docSnap=>{
    const u = docSnap.data();
    options += `
      <option value="${docSnap.id}">
        ${u.username || u.fullName || docSnap.id}
      </option>
    `;
  });

  container.innerHTML = `
    <div class="admin-card">

      <h3>Manual Adjustment</h3>

      <label>User</label>
      <select id="adjustUser">
        ${options}
      </select>

      <label>Wallet Adjustment (+ / -)</label>
      <input type="number" id="adjustAmount" placeholder="50000 atau -20000">

      <label>Reason</label>
      <select id="adjustReason">
        <option value="admin_adjustment">Admin Adjustment</option>
        <option value="cashback_session">Cashback Session</option>
        <option value="refund">Refund</option>
        <option value="penalty">Penalty</option>
      </select>

      <label>Note (optional)</label>
      <input type="text" id="adjustNote" placeholder="Detail keterangan">

      <button id="saveAdjustment" class="admin-btn">
        Simpan Adjustment
      </button>
<button onclick="exportFullMutation()">
  Export Mutasi Semua Orang (Current System)
</button><button onclick="auditOldSystemReconciliation()">
  Audit Rekonsil Sistem Lama
</button>
    </div>
  `;

  document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;
}
/* =====================================================
   QR VALIDATOR (NO FINANCIAL IMPACT)
===================================================== */

let html5QrInstance = null;
let cameraList = [];
let currentCameraIndex = 0;

async function loadQrLibrary(){
  return new Promise((resolve, reject) => {

    if(window.Html5Qrcode){
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode";
    script.onload = resolve;
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

async function setupQrValidator(){

  const openBtn = document.getElementById("openCheckinQR");
  const modal = document.getElementById("checkinModal");
  const closeBtn = document.getElementById("closeCheckin");
  const switchBtn = document.getElementById("switchCameraBtn");
  const resultBox = document.getElementById("checkinResult");

  if(!openBtn) return;

  openBtn.onclick = async () => {

    await loadQrLibrary();

    modal.classList.remove("hidden");
    resultBox.innerHTML = "";

    html5QrInstance = new Html5Qrcode("reader");

    cameraList = await Html5Qrcode.getCameras();

    if(!cameraList.length){
      alert("Camera tidak ditemukan");
      return;
    }

    currentCameraIndex = cameraList.length - 1;
    await startCamera();
  };

  async function startCamera(){

    const cameraId = cameraList[currentCameraIndex].id;

    await html5QrInstance.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {

        await html5QrInstance.stop();

        try{

          let cleaned = decodedText.trim().replace(/\n/g,"");

          let c = null;
          let i = null;
          let s = null;

          if(cleaned.startsWith("http")){
            const parsed = new URL(cleaned);
            c = parsed.searchParams.get("c");
            i = parsed.searchParams.get("i");
            s = parsed.searchParams.get("s");
          } else {
            const params = new URLSearchParams(cleaned);
            c = params.get("c");
            i = params.get("i");
            s = params.get("s");
          }

          if(!c || !i || !s){
            resultBox.innerHTML =
              `<div class="invalid-box">QR format tidak valid</div>`;
            return;
          }

          const res = await window.validateScanParams(c,i,s);

          if(res.valid){

            resultBox.innerHTML = `
              <div class="valid-box">
                ✅ VALID<br>
                ${res.user.username}<br>
                Member Code: ${res.user.memberCode}
              </div>
            `;

          } else {

            resultBox.innerHTML = `
              <div class="invalid-box">
                ❌ INVALID<br>
                ${res.reason}
              </div>
            `;
          }

        }catch(err){
          resultBox.innerHTML =
            `<div class="invalid-box">QR tidak valid</div>`;
        }
      }
    );
  }

  if(switchBtn){
    switchBtn.onclick = async () => {

      if(!html5QrInstance || !cameraList.length) return;

      await html5QrInstance.stop();

      currentCameraIndex =
        (currentCameraIndex + 1) % cameraList.length;

      await startCamera();
    };
  }

  closeBtn.onclick = async () => {

    if(html5QrInstance){
      try{
        await html5QrInstance.stop();
        await html5QrInstance.clear();
      }catch(e){}
    }

    modal.classList.add("hidden");
    resultBox.innerHTML = "";
  };
}
/* =====================================================
   FUNGSI WINDOW
===================================================== */

/* =====================================================
   APPROVE TOP UP (ATOMIC + LEDGER)
===================================================== */
window.approveTopup = async function(trxId, userId, amount){

  try{

    const userRef   = doc(db,"users", userId);
    const trxRef    = doc(db,"walletTransactions", trxId);
    const ledgerRef = doc(collection(db,"walletLedger"));

    await runTransaction(db, async (transaction)=>{

      const userSnap = await transaction.get(userRef);
      const trxSnap  = await transaction.get(trxRef);

      if(!userSnap.exists()) throw new Error("User tidak ditemukan");
      if(!trxSnap.exists()) throw new Error("Transaksi tidak ditemukan");

      const trxData = trxSnap.data();
      if(trxData.status !== "PENDING"){
        throw new Error("Sudah diproses");
      }

      const balanceBefore = userSnap.data().walletBalance || 0;
      const newBalance    = balanceBefore + amount;

      transaction.update(userRef,{
        walletBalance: newBalance,
        totalTopup: (userSnap.data().totalTopup || 0) + amount
      });

      transaction.update(trxRef,{
        status: "SUCCESS",
        balanceBefore,
        balanceAfter: newBalance,
        processedAt: serverTimestamp(),
        processedBy: auth.currentUser.uid
      });

      transaction.set(ledgerRef,{
        userId,
        txId: trxId,
        entryType: "CREDIT",
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        description: "Top Up Approved",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

    });

    alert("Top up berhasil di-approve");
    renderAdmin();

  }catch(error){
    alert(error.message || "Gagal approve");
  }
};

/* =====================================================
   REJECT TOP UP
===================================================== */
window.rejectTopup = async function(trxId){

  const trxRef = doc(db,"walletTransactions",trxId);
  const trxSnap = await getDoc(trxRef);

  if(!trxSnap.exists() || trxSnap.data().status !== "PENDING"){
    alert("Sudah diproses");
    return;
  }

  await updateDoc(trxRef,{
    status: "REJECTED",
    rejectedAt: serverTimestamp()
  });

  alert("Top up ditolak");
  renderAdmin();
};




window.exportTopupHistory = async function(){

  const snap = await getDocs(
    query(collection(db,"walletTransactions"), where("type","==","TOPUP"))
  );

  let rows = [["Tanggal","UID","Amount","Status","BalanceAfter"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();
    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      d.amount || 0,
      d.status || "",
      d.balanceAfter ?? ""
    ]);
  });

  downloadCSV("topup_history.csv", rows);
};

window.exportBookingHistory = async function(){

  const snap = await getDocs(collection(db,"bookings"));
  let rows = [["BookingID","UID","Amount","Status"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();
    rows.push([
      docSnap.id,
      d.userId || "",
      d.amount || 0,
      d.status || ""
    ]);
  });

  downloadCSV("booking_history.csv", rows);
};

window.exportAdjustmentHistory = async function(){

  const snap = await getDocs(collection(db,"walletLedger"));
  let rows = [["LedgerID","UID","EntryType","Amount","Description"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();
    if(d.description === "Top Up Approved") return;
    rows.push([
      docSnap.id,
      d.userId || "",
      d.entryType || "",
      d.amount || 0,
      d.description || ""
    ]);
  });

  downloadCSV("adjustment_history.csv", rows);
};
/* =====================================================
   EXPORT MEMBERS CSV (ADMIN ONLY)
===================================================== */

/* =====================================================
   EXPORT MEMBERS – FULL AUDIT VERSION
===================================================== */

window.exportMembersToCSV = async function(){

  try{

    const snap = await getDocs(collection(db,"users"));

    if(snap.empty){
      alert("Tidak ada data user");
      return;
    }

    let rows = [];

    // HEADER AUDIT GRADE
    rows.push([
      "UID",
      "Username",
      "Full Name",
      "Email",
      "Phone",
      "Birth Place",
      "Birth Date",
      "Role",
      "Membership",
      "Member Code",
      "Level",
      "EXP",
      "Wallet Balance",
      "Total Top Up",
      "Total Payment",
      "GPoint",
      "GPoints",
      "Points",
      "Attendance Count",
      "Matches",
      "Wins",
      "Followers",
      "Following",
      "Verified",
      "Verified Approved",
      "Verified Eligible",
      "Status",
      "Playing Level",
      "Monthly Contribution",
      "QR URL",
      "Created At"
    ]);

    snap.forEach(docSnap => {

      const d = docSnap.data();

      rows.push([
        docSnap.id,
        d.username || "",
        d.fullName || "",
        d.email || "",
        d.phone || "",
        d.birthPlace || "",
        d.birthDate || "",
        d.role || "",
        d.membership || "",
        d.memberCode || "",
        d.level || 0,
        d.exp || 0,
        d.walletBalance || 0,
        d.totalTopup || 0,
        d.totalPayment || 0,
        d.gPoint || 0,
        d.gPoints || 0,
        d.points || 0,
        d.attendanceCount || 0,
        d.matches || 0,
        d.wins || 0,
        d.followersCount || 0,
        d.followingCount || 0,
        d.verified === true ? "YES" : "NO",
        d.verifiedApproved === true ? "YES" : "NO",
        d.verifiedEligible === true ? "YES" : "NO",
        d.status || "",
        d.playingLevel || "",
        d.monthlyContribution || 0,
        d.qrUrl || "",
        d.createdAt?.toDate?.().toLocaleString("id-ID") || ""
      ]);
    });

    const csvContent = rows
      .map(row => row.map(val => `"${val}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "giltclub_members_full_audit.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Export Members Full Audit selesai");

  }catch(err){
    console.error(err);
    alert("Gagal export members");
  }
};

/* =====================================================
   EXPORT FULL MUTATION (CURRENT SYSTEM)
===================================================== */

window.exportFullMutation = async function(){

  try{

    const snap = await getDocs(collection(db,"walletTransactions"));

    if(snap.empty){
      alert("Tidak ada data mutasi");
      return;
    }

    let rows = [];

    rows.push([
      "Tanggal",
      "UID",
      "Username",
      "Full Name",
      "Type",
      "Amount",
      "Status",
      "Balance Before",
      "Balance After",
      "Created By",
      "Note"
    ]);

    for(const docSnap of snap.docs){

      const d = docSnap.data();
      const uid = d.userId || "";

      let username = "";
      let fullName = "";

      if(uid){
        const userSnap = await getDoc(doc(db,"users",uid));
        if(userSnap.exists()){
          const userData = userSnap.data();
          username = userData.username || "";
          fullName = userData.fullName || "";
        }
      }

      rows.push([
        d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
        uid,
        username,
        fullName,
        d.type || "",
        d.amount || 0,
        d.status || "",
        d.balanceBefore ?? "",
        d.balanceAfter ?? "",
        d.createdBy || "",
        d.note || ""
      ]);
    }

    const csvContent = rows
      .map(row => row.map(val => `"${val}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "giltclub_full_mutation_current_system.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Export full mutation selesai");

  }catch(err){
    console.error(err);
    alert("Gagal export mutation");
  }
};

window.auditOldSystemReconciliation = async function(){

  try{

    const usersSnap = await getDocs(collection(db,"users"));
    const trxSnap = await getDocs(collection(db,"walletTransactions"));

    if(usersSnap.empty){
      alert("Tidak ada user");
      return;
    }

    // Map untuk simpan hasil hitung
    const calculatedBalance = {};

    trxSnap.forEach(docSnap => {

      const d = docSnap.data();
      const uid = d.userId;

      if(!uid) return;

      // hanya transaksi sukses
      if(d.status && d.status !== "APPROVED" && d.status !== "SUCCESS") return;

      if(!calculatedBalance[uid]){
        calculatedBalance[uid] = 0;
      }

      calculatedBalance[uid] += Number(d.amount || 0);
    });

    let rows = [];

    rows.push([
      "UID",
      "Username",
      "Stored WalletBalance",
      "Calculated From Transactions",
      "Difference"
    ]);

    usersSnap.forEach(userDoc => {

      const uid = userDoc.id;
      const userData = userDoc.data();

      const stored = Number(userData.walletBalance || 0);
      const calculated = Number(calculatedBalance[uid] || 0);
      const diff = stored - calculated;

      rows.push([
        uid,
        userData.username || "",
        stored,
        calculated,
        diff
      ]);
    });

    const csvContent = rows
      .map(row => row.map(val => `"${val}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "audit_reconciliation_old_system.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Audit Rekonsiliasi selesai");

  }catch(err){
    console.error(err);
    alert("Gagal audit");
  }
};

window.runMigration = runMigration;
