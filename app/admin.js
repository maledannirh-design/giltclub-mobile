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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { runMigration } from "./migration.js";
import { deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
  <div id="adminBalanceAdjustment"></div>
  </div>
  `;

  content.innerHTML = html;

  await renderBalanceAdjustmentPanel();
} // ✅ renderAdmin sekarang sudah ditutup dengan benar


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

window.handleBalanceAdjustment = handleBalanceAdjustment;
window.runMigration = runMigration;
