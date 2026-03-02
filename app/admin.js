import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { runMigration } from "./migration.js";
import { deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadMembersForBroadcast, sendBroadcast } from "./admin-broadcast.js";
import "./scanQR.js";

const BASE_SCAN_URL = "https://giltclub.app/scan";

/* =====================================================
   RENDER ADMIN PANEL
===================================================== */
export async function renderAdmin() {

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if (!user) return;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    content.innerHTML = "User tidak ditemukan";
    return;
  }

  const userData = userSnap.data();

  if (userData.role !== "ADMIN" && userData.role !== "SUPERCOACH") {
    content.innerHTML = `<div style="padding:20px;">Akses ditolak.</div>`;
    return;
  }

  const snap = await getDocs(
    query(collection(db, "walletTransactions"), where("status", "==", "PENDING"))
  );

  let html = `
  <div class="admin-container">
    <h2>Pending Top Up</h2>
  `;

  if (snap.empty) {
    html += `<div style="opacity:.6;margin-bottom:20px;">Tidak ada top up pending</div>`;
  } else {
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const uSnap = await getDoc(doc(db, "users", d.userId));
      const username = uSnap.exists() ? uSnap.data().username || "User" : "User";

      html += `
        <div class="admin-trx">
          <div>
            <div>${username}</div>
            <div>Rp ${Number(d.amount || 0).toLocaleString("id-ID")}</div>
          </div>
          <div>
            <button onclick="approveTopup('${docSnap.id}','${d.userId}')">Approve</button>
            <button onclick="rejectTopup('${docSnap.id}')">Reject</button>
          </div>
        </div>
      `;
    }
  }

  html += `
  <hr style="margin:30px 0;">

  <button id="openCheckinQR" class="admin-btn">Scan Member QR</button>
  <button id="openBroadcast" class="admin-btn" style="margin-left:10px;">Broadcast Pesan</button>

  <div id="broadcastModal" class="modal hidden">
    <div class="modal-content">
      <h3>Broadcast Pesan</h3>

      <input type="text" id="broadcastTitle" placeholder="Judul Pesan" />
      <textarea id="broadcastMessage" placeholder="Isi Pesan"></textarea>

      <div>
        <label><input type="radio" name="broadcastTarget" value="ALL" checked /> Semua Member</label>
        <label><input type="radio" name="broadcastTarget" value="SELECTED" /> Pilih Member</label>
      </div>

      <div id="broadcastUserList" style="max-height:200px; overflow:auto;"></div>

      <button id="sendBroadcastBtn">Kirim</button>
      <button id="closeBroadcast">Tutup</button>
    </div>
  </div>

  <hr style="margin:30px 0;">
  <div id="adminBalanceAdjustment"></div>
  </div>
  `;

  content.innerHTML = html;

  await renderBalanceAdjustmentPanel();

  /* =======================
     BROADCAST EVENTS
  ======================= */

  document.getElementById("openBroadcast").onclick = async () => {
    const modal = document.getElementById("broadcastModal");
    modal.classList.remove("hidden");
    await loadMembersForBroadcast("broadcastUserList");
  };

  document.getElementById("closeBroadcast").onclick = () => {
    document.getElementById("broadcastModal").classList.add("hidden");
  };

  document.getElementById("sendBroadcastBtn").onclick = async () => {
    const title = document.getElementById("broadcastTitle").value;
    const message = document.getElementById("broadcastMessage").value;

    const targetType = document.querySelector(
      'input[name="broadcastTarget"]:checked'
    ).value;

    let selectedUserIds = [];

    if (targetType === "SELECTED") {
      const checkboxes = document.querySelectorAll(
        "#broadcastUserList input[type=checkbox]:checked"
      );
      checkboxes.forEach(cb => selectedUserIds.push(cb.value));
    }

    await sendBroadcast({
      title,
      message,
      targetType,
      selectedUserIds,
      adminId: auth.currentUser.uid
    });

    document.getElementById("broadcastModal").classList.add("hidden");
  };
}

/* =====================================================
   BALANCE ADJUSTMENT
===================================================== */
async function renderBalanceAdjustmentPanel() {

  const container = document.getElementById("adminBalanceAdjustment");
  if (!container) return;

  const usersSnap = await getDocs(collection(db, "users"));
  let options = "";

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    options += `<option value="${docSnap.id}">
      ${u.username || u.fullName || docSnap.id}
    </option>`;
  });

  container.innerHTML = `
    <div class="admin-card">
      <h3>Manual Adjustment</h3>
      <label>User</label>
      <select id="adjustUser">${options}</select>

      <label>Wallet Adjustment (+ / -)</label>
      <input type="number" id="adjustAmount" placeholder="50000 atau -2000">

      <label>Reason</label>
      <input type="text" id="adjustReason" placeholder="Detail alasan">

      <button id="saveAdjustment" class="admin-btn">Simpan Adjustment</button>
    </div>
  `;

  document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;
}

async function handleBalanceAdjustment() {

  const userId = document.getElementById("adjustUser").value;
  const walletAmount = Number(document.getElementById("adjustAmount").value || 0);
  const reason = document.getElementById("adjustReason").value;

  if (!walletAmount) return alert("Masukkan nominal adjustment.");

  const userRef = doc(db, "users", userId);
  const ledgerRef = doc(collection(db, "walletLedger"));

  await runTransaction(db, async (transaction) => {

    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error("User tidak ditemukan");

    const data = snap.data();
    const before = data.walletBalance || 0;
    const after = before + walletAmount;

    if (after < 0) throw new Error("Saldo tidak boleh minus");

    transaction.update(userRef, { walletBalance: after });

    transaction.set(ledgerRef, {
      userId,
      entryType: walletAmount > 0 ? "CREDIT" : "DEBIT",
      referenceType: "ADMIN_ADJUSTMENT",
      amount: walletAmount,
      balanceBefore: before,
      balanceAfter: after,
      description: reason,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });
  });

  alert("Adjustment berhasil");
  renderAdmin();
}


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
window.runMigration = runMigration

