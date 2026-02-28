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

  if(snap.empty){
    html += `<div style="opacity:.6;margin-bottom:20px;">Tidak ada top up pending</div>`;
  }else{

    for(const docSnap of snap.docs){

      const d = docSnap.data();

      const userSnap = await getDoc(doc(db,"users", d.userId));
      const username = userSnap.exists()
        ? userSnap.data().username || "User"
        : "User";

      html += `
        <div class="admin-trx">
          <div>
            <div>${username}</div>
            <div>Rp ${Number(d.amount).toLocaleString("id-ID")}</div>
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

  html += `
      <hr style="margin:30px 0;">

      <button id="openCheckinQR" class="admin-btn">
        Check-In QR
      </button>

      <div id="adminBalanceAdjustment" style="margin-top:40px;"></div>

      <hr style="margin:30px 0;">

      <button onclick="exportTopupHistory()">Export History Top Up</button>
      <button onclick="exportBookingHistory()">Export History Booking</button>
      <button onclick="exportAdjustmentHistory()">Export History Adjustment</button>

    </div>
  `;

  content.innerHTML = html;

  await renderBalanceAdjustmentPanel();
}

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

/* =====================================================
   ADJUSTMENT (LEDGER CLEAN)
===================================================== */
async function handleBalanceAdjustment(){

  const userId = document.getElementById("adjustUser").value;
  const walletAmount = Number(document.getElementById("adjustAmount").value || 0);
  const reason = document.getElementById("adjustReason").value;
  const note = document.getElementById("adjustNote").value.trim();

  if(!walletAmount){
    alert("Nominal wajib diisi");
    return;
  }

  const userRef = doc(db,"users", userId);
  const ledgerRef = doc(collection(db,"walletLedger"));

  await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(userRef);
    if(!snap.exists()) throw new Error("User tidak ditemukan");

    const balanceBefore = snap.data().walletBalance || 0;
    const newBalance = balanceBefore + walletAmount;

    if(newBalance < 0) throw new Error("Saldo minus");

    transaction.update(userRef,{
      walletBalance: newBalance
    });

    transaction.set(ledgerRef,{
      userId,
      txId: "ADMIN_ADJUST_" + Date.now(),
      entryType: walletAmount > 0 ? "CREDIT" : "DEBIT",
      amount: walletAmount,
      balanceBefore,
      balanceAfter: newBalance,
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

    </div>
  `;

  document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;
}



/* =====================================================
   FUNGSI WINDOW
===================================================== */
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

window.runMigration = runMigration;
