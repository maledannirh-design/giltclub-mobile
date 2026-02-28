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
import { deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import "./recalculate.js";

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
<button onclick="exportFullMutation()">
  Export Mutasi Semua Orang (Current System)
</button><button onclick="auditOldSystemReconciliation()">
  Audit Rekonsil Sistem Lama
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
   RENDER BALANCE ADJUSTMENT PANEL
===================================================== */
async function renderBalanceAdjustmentPanel(){

  const container = document.getElementById("adminBalanceAdjustment");
  if(!container) return;

  try{

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
        <input type="number" id="adjustAmount" placeholder="50000 atau -2000">

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

      </div>
    `;

    document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;

  }catch(err){
    console.error("Render adjustment panel error:", err);
  }
}

/* =====================================================
   ADJUSTMENT (WALLET + GPOINT SEPARATED LEDGER)
===================================================== */
async function handleBalanceAdjustment(){

  const userEl = document.getElementById("adjustUser");
  const walletEl = document.getElementById("adjustAmount");
  const reasonEl = document.getElementById("adjustReason");
  const noteEl = document.getElementById("adjustNote");

  if(!userEl || !walletEl || !reasonEl || !noteEl){
    alert("Panel adjustment belum siap.");
    return;
  }

  const userId = userEl.value;
  const walletAmount = Number(walletEl.value || 0);
  const reason = reasonEl.value;
  const note = noteEl.value.trim();

  if(walletAmount === 0){
    alert("Masukkan nominal adjustment.");
    return;
  }

  const userRef = doc(db,"users",userId);
  const walletLedgerRef = doc(collection(db,"walletLedger"));

  await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(userRef);
    if(!snap.exists()) throw new Error("User tidak ditemukan");

    const data = snap.data();
    const walletBefore = data.walletBalance || 0;
    const walletAfter = walletBefore + walletAmount;

    if(walletAfter < 0) throw new Error("Saldo tidak boleh minus");

    transaction.update(userRef,{
      walletBalance: walletAfter
    });

    transaction.set(walletLedgerRef,{
      userId,
      entryType: walletAmount > 0 ? "CREDIT" : "DEBIT",
      referenceType: "ADMIN_ADJUSTMENT",
      amount: walletAmount,
      balanceBefore: walletBefore,
      balanceAfter: walletAfter,
      description: reason,
      note,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

  });

  alert("Adjustment berhasil");
  renderAdmin();
}


/* =====================================================
   QR VALIDATOR (NO FINANCIAL IMPACT)
   STABLE PRODUCTION VERSION
===================================================== */

let html5QrInstance = null;
let cameraList = [];
let currentCameraIndex = 0;

/* =====================================================
   LOAD LIBRARY (SAFE)
===================================================== */
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

/* =====================================================
   MAIN SETUP
===================================================== */
async function setupQrValidator(){

  const openBtn   = document.getElementById("openCheckinQR");
  const modal     = document.getElementById("checkinModal");
  const closeBtn  = document.getElementById("closeCheckin");
  const switchBtn = document.getElementById("switchCameraBtn");
  const resultBox = document.getElementById("checkinResult");

  if(!openBtn) return;

  /* ===============================
     OPEN SCANNER
  =============================== */
  openBtn.onclick = async () => {

    await loadQrLibrary();

    modal.classList.remove("hidden");
    resultBox.innerHTML = "";

    // Destroy old instance if exists
    if(html5QrInstance){
      try{
        await html5QrInstance.stop();
        await html5QrInstance.clear();
      }catch(e){}
    }

    html5QrInstance = new Html5Qrcode("reader");

    cameraList = await Html5Qrcode.getCameras();

    if(!cameraList.length){
      resultBox.innerHTML =
        `<div class="invalid-box">Camera tidak ditemukan</div>`;
      return;
    }

    // Auto pilih kamera belakang
    const backCam =
      cameraList.find(c =>
        c.label.toLowerCase().includes("back") ||
        c.label.toLowerCase().includes("environment")
      );

    currentCameraIndex = backCam
      ? cameraList.indexOf(backCam)
      : cameraList.length - 1;

    await startCamera();
  };


 /* ===============================
   CAMERA START (STABLE VERSION)
=============================== */
/* ===============================
   CAMERA START (HIGH PERFORMANCE)
=============================== */
async function startCamera(){

  const cameraId = cameraList[currentCameraIndex].id;

  const config = {
    fps: 45, // 50 sering di-throttle browser, 45 lebih stabil
    qrbox: (vw, vh) => {
      const min = Math.min(vw, vh);

      // Fokus kecil supaya QR kecil cepat kebaca
      const size = Math.floor(min * 0.65);

      return {
        width: size,
        height: size
      };
    },
    aspectRatio: window.innerWidth / window.innerHeight,
    disableFlip: false,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };

  let processing = false;

  await html5QrInstance.start(
    cameraId,
    config,
    async (decodedText) => {

      if(processing) return;
      processing = true;

      try{

        const cleaned = decodedText.trim().replace(/\n/g,"");

        let c,i,s;

        if(cleaned.startsWith("http")){
          const parsed = new URL(cleaned);
          c = parsed.searchParams.get("c");
          i = parsed.searchParams.get("i");
          s = parsed.searchParams.get("s");
        }else{
          const params = new URLSearchParams(cleaned);
          c = params.get("c");
          i = params.get("i");
          s = params.get("s");
        }

        if(!c || !i || !s){
          showInvalid("QR format tidak valid");
          return reset();
        }

        const res = await window.validateScanParams(c,i,s);

        if(res.valid){
          showValid(res.user.username);
        }else{
          showInvalid(res.reason);
        }

      }catch(err){
        console.error(err);
        showInvalid("QR tidak valid");
      }

      reset();
    }
  );

  function reset(){
    setTimeout(()=>{
      resultBox.innerHTML = "";
      processing = false;
    },1200); // lebih cepat supaya cepat scan ulang
  }
}

  /* ===============================
     CAMERA SWITCH
  =============================== */
if(switchBtn){
  switchBtn.onclick = async () => {

    if(!html5QrInstance || !cameraList.length) return;

    try{
      await html5QrInstance.stop();
    }catch(e){}

    currentCameraIndex =
      (currentCameraIndex + 1) % cameraList.length;

    setTimeout(()=>{
      startCamera();
    },200);
  };
}

  /* ===============================
     CLOSE SCANNER
  =============================== */
if(closeBtn){
  closeBtn.onclick = async () => {

    try{
      if(html5QrInstance){
        await html5QrInstance.stop();
        await html5QrInstance.clear();
      }
    }catch(e){
      console.warn(e);
    }

    html5QrInstance = null;

    modal.classList.add("hidden");
    resultBox.innerHTML = "";
  };
}
  /* ===============================
     RESULT UI
  =============================== */
function showValid(name){
  resultBox.innerHTML =
    `<div class="result-popup valid-box">
      ✅ VALID MEMBER<br>
      <div style="margin-top:8px;font-size:14px;">
        ${name}
      </div>
    </div>`;
}

function showInvalid(message){
  resultBox.innerHTML =
    `<div class="result-popup invalid-box">
      ❌ ${message}
    </div>`;
}
  async function resume(){
    setTimeout(async ()=>{
      resultBox.innerHTML = "";
      try{
        await html5QrInstance.resume();
      }catch(e){}
    },1500);
  }
}
/* =====================================================
   FUNGSI WINDOW
===================================================== */


/* =====================================================
   APPROVE TOP UP (ATOMIC + LEDGER)
===================================================== */
window.approveTopup = async function(trxId, userId){

  try{

    const userRef   = doc(db,"users", userId);
    const trxRef    = doc(db,"walletTransactions", trxId);
    const ledgerRef = doc(collection(db,"walletLedger"));

    await runTransaction(db, async (transaction)=>{

      const userSnap = await transaction.get(userRef);
      const trxSnap  = await transaction.get(trxRef);

      if(!userSnap.exists()) throw new Error("User tidak ditemukan");
      if(!trxSnap.exists()) throw new Error("Transaksi tidak ditemukan");

      const userData = userSnap.data();
      const trxData  = trxSnap.data();

      if(trxData.status !== "PENDING"){
        throw new Error("Sudah diproses");
      }

      const amount = trxData.amount;

      const balanceBefore = userData.walletBalance || 0;
      const newBalance    = balanceBefore + amount;

      // 1️⃣ UPDATE USER
      transaction.update(userRef,{
        walletBalance: newBalance,
        totalTopup: (userData.totalTopup || 0) + amount
      });

      // 2️⃣ UPDATE TRANSACTION
      transaction.update(trxRef,{
        status: "SUCCESS",
        balanceBefore,
        balanceAfter: newBalance,
        processedAt: serverTimestamp(),
        processedBy: auth.currentUser.uid
      });

      // 3️⃣ INSERT LEDGER (ATOMIC RECORD)
      transaction.set(ledgerRef,{
        userId,
        usernameSnapshot: userData.username || "",
        fullNameSnapshot: userData.fullName || "",
        entryType: "CREDIT",
        referenceType: "TOPUP",
        referenceId: trxId,
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        source: "QRIS",
        note: "Top Up Approved",
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

window.exportTopupHistory = async function(){

  const snap = await getDocs(collection(db,"walletLedger"));

  let rows = [["Tanggal","UID","Amount","BalanceBefore","BalanceAfter","Source"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();

    if(d.referenceType !== "TOPUP") return;

    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      d.amount || 0,
      d.balanceBefore ?? "",
      d.balanceAfter ?? "",
      d.source || ""
    ]);
  });

  downloadCSV("topup_history.csv", rows);
};

window.exportBookingHistory = async function(){

  const snap = await getDocs(collection(db,"bookings"));

  let rows = [["BookingID","UID","SessionPrice","RacketTotal","TotalPrice","Status","Attendance"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();

    rows.push([
      docSnap.id,
      d.userId || "",
      d.sessionPrice || 0,
      d.racketTotal || 0,
      d.price || 0,
      d.status || "",
      d.attendance === true ? "YES" : "NO"
    ]);
  });

  downloadCSV("booking_history.csv", rows);
};

window.exportAdjustmentHistory = async function(){

  const snap = await getDocs(collection(db,"walletLedger"));

  let rows = [["Tanggal","UID","EntryType","Amount","BalanceBefore","BalanceAfter","Note"]];

  snap.forEach(docSnap=>{
    const d = docSnap.data();

    if(d.referenceType !== "ADMIN_ADJUSTMENT") return;

    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      d.entryType || "",
      d.amount || 0,
      d.balanceBefore ?? "",
      d.balanceAfter ?? "",
      d.note || ""
    ]);
  });

  downloadCSV("adjustment_history.csv", rows);
};

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

    rows.push([
      "UID",
      "Username",
      "Full Name",
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
      "Attendance Count",
      "Total Attendance",
      "Followers",
      "Following",
      "Verified",
      "Playing Level",
      "Is Public",
      "Created At"
    ]);

    snap.forEach(docSnap => {

      const d = docSnap.data();

      rows.push([
        docSnap.id,
        d.username || "",
        d.fullName || "",
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
        d.attendanceCount || 0,
        d.totalAttendance || 0,
        d.followersCount || 0,
        d.followingCount || 0,
        d.verified === true ? "YES" : "NO",
        d.playingLevel || "",
        d.isPublic === true ? "YES" : "NO",
        d.createdAt?.toDate?.().toLocaleString("id-ID") || ""
      ]);
    });

    downloadCSV("giltclub_members_clean.csv", rows);

    alert("Export Members selesai");

  }catch(err){
    console.error(err);
    alert("Gagal export members");
  }
};

/* =====================================================
   EXPORT FULL MUTATION (CURRENT SYSTEM)
===================================================== */

window.exportFullMutation = async function(){

  const walletSnap = await getDocs(collection(db,"walletLedger"));
  const gPointSnap = await getDocs(collection(db,"gPointLedger"));

  let rows = [["Tanggal","UID","Type","Amount","BalanceBefore","BalanceAfter","ReferenceType","Note"]];

  walletSnap.forEach(docSnap=>{
    const d = docSnap.data();

    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      "WALLET_" + (d.entryType || ""),
      d.amount || 0,
      d.balanceBefore ?? "",
      d.balanceAfter ?? "",
      d.referenceType || "",
      d.note || ""
    ]);
  });

  gPointSnap.forEach(docSnap=>{
    const d = docSnap.data();

    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      "GPOINT_" + (d.entryType || ""),
      d.amount || 0,
      d.balanceBefore ?? "",
      d.balanceAfter ?? "",
      d.referenceType || "",
      d.note || ""
    ]);
  });

  downloadCSV("full_mutation.csv", rows);
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

window.massiveCleanupFields = async function(){

  try{

    const usersSnap = await getDocs(collection(db,"users"));

    for(const docSnap of usersSnap.docs){

      await updateDoc(doc(db,"users",docSnap.id),{
        points: deleteField(),
        usernameID: deleteField(),
        displayName: deleteField(),
        matches: deleteField(),
        verifiedApproved: deleteField(),
        wins: deleteField(),
        gPoints: deleteField()
      });

      console.log("Cleaned:", docSnap.id);
    }

    console.log("Massive field cleanup DONE.");

  }catch(err){
    console.error("Cleanup error:", err);
  }
};
window.handleBalanceAdjustment = handleBalanceAdjustment;


window.runMigration = runMigration;
