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
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { recalculateUserStats } from "./userStats.js";

// ✅ IMPORT FUNCTION SECARA BENAR
import { runMigration } from "./migration.js";
export async function renderAdmin(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!user) return;

  const userSnap = await getDoc(doc(db,"users",user.uid));
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
          <div>Rp ${d.amount.toLocaleString("id-ID")}</div>
        </div>
        <div>
  <button onclick="approveTopup('${docSnap.id}','${d.userId}',${d.amount}, this)">
    Approve
  </button>

  <button style="margin-left:6px;"
    onclick="rejectTopup('${docSnap.id}', this)">
    Reject
  </button>
</div>
      </div>
    `;
  }

  html += `</div>`;

  content.innerHTML = html;
}

window.approveTopup = async function(trxId, userId, amount, btn){

  try{

    // 🔒 Disable button supaya tidak bisa double click
    if(btn){
      btn.disabled = true;
      btn.innerText = "Processing...";
    }

   const userRef = doc(db,"users", userId);
    const trxRef  = doc(db,"walletTransactions",trxId);

    // =============================
    // CEK STATUS TRANSAKSI DULU
    // =============================

    const trxSnap = await getDoc(trxRef);
    const trxData = trxSnap.data();

    if(!trxSnap.exists() || trxData.status !== "PENDING"){
      alert("Transaksi sudah diproses.");
      if(btn){
        btn.disabled = false;
        btn.innerText = "Approve";
      }
      return;
    }

    // =============================
    // AMBIL USER DATA
    // =============================

    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const currentTopup = userData.totalTopup || 0;
    const currentPayment = userData.totalPayment || 0;
    const currentBalance = userData.walletBalance || 0;

    const newTopup = currentTopup + amount;
    const newBalance = currentBalance + amount;

    // =============================
    // HITUNG ULANG STATS
    // =============================

    const stats = recalculateUserStats({
      totalTopup: newTopup,
      totalPayment: currentPayment,
      membership: userData.membership
    });

    // =============================
    // UPDATE USER
    // =============================

    await updateDoc(userRef,{
      walletBalance: newBalance,
      totalTopup: newTopup,
      level: stats.level,
      exp: stats.expTotal,
      gPoint: stats.gPoint
    });

    // =============================
    // UPDATE TRANSACTION
    // =============================

    await updateDoc(trxRef,{
      status:"APPROVED",
      approvedAt: serverTimestamp()
    });

    alert("Approved");
    renderAdmin();

  }catch(error){
    console.error(error);
    alert("Error approve");

    if(btn){
      btn.disabled = false;
      btn.innerText = "Approve";
    }
  }
};
window.rejectTopup = async function(trxId, btn){

  try{

    if(btn){
      btn.disabled = true;
      btn.innerText = "Processing...";
    }

    const trxRef = doc(db,"walletTransactions",trxId);

    const trxSnap = await getDoc(trxRef);

    if(!trxSnap.exists() || trxSnap.data().status !== "PENDING"){
      alert("Transaksi sudah diproses.");
      if(btn){
        btn.disabled = false;
        btn.innerText = "Reject";
      }
      return;
    }

    await updateDoc(trxRef,{
      status: "REJECTED",
      rejectedAt: serverTimestamp()
    });

    alert("Top up ditolak.");
    renderAdmin();

  }catch(error){
    console.error(error);
    alert("Error reject");

    if(btn){
      btn.disabled = false;
      btn.innerText = "Reject";
    }
  }
};

async function renderBalanceAdjustmentPanel() {

  const container = document.getElementById("adminBalanceAdjustment");
  if (!container) return;

  const usersSnap = await getDocs(collection(db,"users"));

  let options = "";

  usersSnap.docs.forEach(docSnap=>{
    const u = docSnap.data();
    options += `<option value="${docSnap.id}">
      ${u.username || u.fullName || docSnap.id}
    </option>`;
  });

  container.innerHTML = `
    <div class="admin-card">

      <h3>Manual Balance Adjustment</h3>

      <label>User</label>
      <select id="adjustUser">
        ${options}
      </select>

      <label>Nominal (boleh minus)</label>
      <input type="number" id="adjustAmount" placeholder="contoh: 50000 atau -20000">

      <label>Catatan</label>
      <input type="text" id="adjustNote" placeholder="Alasan adjustment">

      <button id="saveAdjustment" class="admin-btn">
        Simpan
      </button>

    </div>
  `;

  document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;

}

async function handleBalanceAdjustment(){

  const userId = document.getElementById("adjustUser").value;
  const amount = Number(document.getElementById("adjustAmount").value);
  const note = document.getElementById("adjustNote").value.trim();

  if (!amount || isNaN(amount)) {
    showToast("Nominal tidak valid","error");
    return;
  }

  try {

    const userRef = doc(db, "users", userId);
    const ledgerCol = collection(db, "walletTransactions");

    await runTransaction(db, async (transaction)=>{

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User tidak ditemukan");
      }

      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error("Saldo tidak boleh minus");
      }

      // Update wallet
      transaction.update(userRef,{
        walletBalance: newBalance
      });

      // Create ledger entry
      const ledgerRef = doc(ledgerCol);

      transaction.set(ledgerRef,{
        userId,
        type: "admin_adjustment",
        amount,
        balanceAfter: newBalance,
        note: note || "",
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });

    });

    showToast("Adjustment berhasil","success");

    document.getElementById("adjustAmount").value = "";
    document.getElementById("adjustNote").value = "";

  } catch(err){
    showToast(err.message || "Gagal adjustment","error");
  }

}


// expose ke console
window.runMigration = runMigration;
