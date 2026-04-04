import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  increment,
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { sendAdminBroadcast } from "./broadcast.js";
import { runMigration } from "./migration.js";
import { applyMutation } from "./services/mutationService.js";


/* =====================================================
   RENDER ADMIN PANEL (OPTIMIZED - NO QUOTA SPAM)
===================================================== */
export async function renderAdmin() {

  const content = document.getElementById("content");
  const user = auth.currentUser;
  
  if (!user) return;

  // 🔹 VALIDASI ROLE (1x read aman)
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    content.innerHTML = "User tidak ditemukan";
    return;
  }

  const userData = userSnap.data();

  if (userData.role !== "ADMIN" && userData.role !== "SUPERCOACH") {
    content.innerHTML =
      `<div style="padding:20px;">Akses ditolak.</div>`;
    return;
  }

  // 🔹 AMBIL TOPUP PENDING (1x query)
  const snap = await getDocs(
    query(
      collection(db, "walletTransactions"),
      where("status", "==", "PENDING")
    )
  );

  let html = `
    <div class="admin-container">
      <h2>Pending Top Up</h2>
  `;

  if (snap.empty) {

    html += `
      <div style="opacity:.6;margin-bottom:20px;">
        Tidak ada top up pending
      </div>
    `;

  } else {

    for (const docSnap of snap.docs) {

      const d = docSnap.data();

      // 🔥 NO QUERY USER (ANTI QUOTA)
      const username = d.userName || "User";

      html += `
        <div class="admin-trx" id="trx-${docSnap.id}">
          <div>
            <div>${username}</div>
            <div>
              Rp ${Number(d.amount || 0)
                .toLocaleString("id-ID")}
            </div>
          </div>
          <div>
            <button onclick="approveTopup('${docSnap.id}','${d.userId}')">
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
  <div class="admin-card">
    <h3>Admin Broadcast</h3>

    <select id="broadcastMode" style="
      width:100%;
      padding:10px;
      border-radius:10px;
      margin-top:10px;
    ">
      <option value="all">All Members</option>
      <option value="manual">Select Members</option>
    </select>

    <div id="memberSelectList" style="
      margin-top:10px;
      max-height:180px;
      overflow-y:auto;
      display:none;
      border:1px solid var(--color-border);
      border-radius:10px;
      padding:8px;
    "></div>

    <textarea 
      id="broadcastMessage" 
      placeholder="Type broadcast message..."
      style="
        width:100%;
        min-height:80px;
        padding:12px;
        border-radius:12px;
        border:1px solid var(--color-border);
        margin-top:12px;
        resize:none;
      "
    ></textarea>

    <button 
      id="sendBroadcastBtn"
      style="
        margin-top:12px;
        width:100%;
        padding:12px;
        border:none;
        border-radius:12px;
        font-weight:600;
        background:var(--color-primary);
        cursor:pointer;
      "
    >
      Send Broadcast
    </button>
  </div>

  <hr style="margin:30px 0;">

  <button id="openFlashAdmin" class="admin-btn">Flash Drop</button>
  <button id="openRewardAdmin" class="admin-btn">Reward GP</button>
  <button id="openProductAdmin" class="admin-btn">Store Products</button>

  <hr style="margin:30px 0;">

  <div class="admin-card">
    <h3>Store Applications</h3>

    <button onclick="exportStoreApplications()" class="admin-btn">
      Export Store Applications
    </button>

    <div id="adminStoreApps" style="margin-top:15px;"></div>
  </div>

  <hr style="margin:30px 0;">

  <div class="admin-card">
    <h3>Export & Audit Tools</h3>

    <button onclick="exportWalletTransactionsRaw()" class="admin-btn">
      Export WalletTransactions (RAW)
    </button>

    <button onclick="exportFullMutation()" class="admin-btn" style="margin-top:10px;">
      Export Full Mutation (Ledger)
    </button>

    <button onclick="exportTopupHistory()" class="admin-btn" style="margin-top:10px;">
      Export Topup History
    </button>

    <button onclick="exportBookingHistory()" class="admin-btn" style="margin-top:10px;">
      Export Booking History
    </button>

    <button onclick="exportOnlineLogs()" class="admin-btn" style="margin-top:10px;">
      Export Online Logs
    </button>

    <button onclick="exportAdjustmentHistory()" class="admin-btn" style="margin-top:10px;">
      Export Adjustment History
    </button>

    <button onclick="exportMembersToCSV()" class="admin-btn" style="margin-top:10px;">
      Export Members
    </button>

    <button onclick="exportFullMutation()" class="admin-btn" style="margin-top:10px;">
      Export Full Wallet Mutations
    </button>

    <button onclick="auditOldSystemReconciliation()" class="admin-btn" style="margin-top:10px;">
      Audit Old System
    </button>

    <button onclick="runMigration()" class="admin-btn" style="margin-top:10px;">
      Run Migration
    </button>

    <button onclick="massiveCleanupFields()" class="admin-btn"
            style="margin-top:10px;background:#b30000;color:#fff;">
      Massive Cleanup Fields
    </button>
  </div>

  <hr style="margin:30px 0;">
  <div id="adminBalanceAdjustment"></div>
  `;

  content.innerHTML = html;

  // 🔹 EVENT BINDING (AMAN)
  const flashBtn = document.getElementById("openFlashAdmin");
  if (flashBtn) flashBtn.onclick = openFlashAdmin;

  const rewardBtn = document.getElementById("openRewardAdmin");
  if (rewardBtn) rewardBtn.onclick = openRewardAdmin;

  const productBtn = document.getElementById("openProductAdmin");
  if(productBtn) productBtn.onclick = openProductAdmin;

  // 🔥 INI MASIH BERAT → next optimization layer
  // JANGAN AUTO LOAD
// await renderBalanceAdjustmentPanel();
// await initBroadcastUI();
  document.getElementById("adminBalanceAdjustment").innerHTML = `
  <div class="admin-card">
    <h3>Manual Adjustment</h3>

    <button id="loadUsersBtn" class="admin-btn">
      Load Users
    </button>

    <div id="adjustForm" style="display:none;"></div>
  </div>
`;

document.getElementById("loadUsersBtn").onclick = async () => {
  await renderBalanceAdjustmentPanel();
  document.getElementById("adjustForm").style.display = "block";
};
  await loadStoreApplications();
  
}
/* =====================================================
   BALANCE ADJUSTMENT (NEW ENGINE)
===================================================== */
async function renderBalanceAdjustmentPanel() {

  const container =
    document.getElementById("adminBalanceAdjustment");
  if (!container) return;

  const usersSnap = await getDocs(collection(db, "users"));

  let options = "";

  usersSnap.forEach(docSnap => {
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
      <select id="adjustUser">${options}</select>

      <label>Asset</label>
      <select id="adjustAsset">
        <option value="RUPIAH">Saldo (Rupiah)</option>
        <option value="GPOINT">GPoint</option>
      </select>

      <label>Adjustment (+ / -)</label>
      <input type="number" id="adjustAmount"
             placeholder="50000 atau -2000">

      <label>Reason</label>
      <input type="text" id="adjustReason"
             placeholder="Detail alasan">

      <button id="saveAdjustment"
              class="admin-btn">
        Simpan Adjustment
      </button>
    </div>
  `;

  document
    .getElementById("saveAdjustment")
    .onclick = handleBalanceAdjustment;
}

/* =====================================================
   HANDLE ADJUSTMENT (FINAL LEDGER ENGINE)
===================================================== */
async function handleBalanceAdjustment() {

  try {

    const userId =
      document.getElementById("adjustUser").value;

    const asset =
      document.getElementById("adjustAsset").value;

    const amount =
      Number(document.getElementById("adjustAmount").value || 0);

    const reason =
      document.getElementById("adjustReason").value;

    if (!amount)
      return alert("Masukkan nominal adjustment.");

    await applyMutation({
      userId,
      asset,
      mutationType: "ADMIN_ADJUSTMENT",
      amount,
      description: reason || "Manual Adjustment",
      createdBy: auth.currentUser.uid
    });

    alert("Adjustment berhasil");
    renderAdmin();

  } catch(error){
    alert(error.message || "Gagal adjustment");
  }
}

/* =====================================================
   APPROVE TOPUP (OPTIMIZED - NO QUOTA SPAM)
===================================================== */
window.approveTopup = async function(trxId, userId){

  try {

    const trxRef = doc(db,"walletTransactions", trxId);
    const trxSnap = await getDoc(trxRef);

    if(!trxSnap.exists())
      throw new Error("Transaksi tidak ditemukan");

    const trxData = trxSnap.data();

    if(trxData.status !== "PENDING")
      throw new Error("Sudah diproses");

    const amount = trxData.amount;

    /* =========================================
       APPLY MUTATION
    ========================================= */
    await applyMutation({
      userId,
      asset: "RUPIAH",
      mutationType: "TOPUP",
      amount: amount,
      referenceId: trxId,
      description: "Top Up Approved",
      createdBy: auth.currentUser.uid
    });

    /* =========================================
       UPDATE STATUS
    ========================================= */
    await updateDoc(trxRef,{
      status: "SUCCESS",
      processedAt: serverTimestamp(),
      processedBy: auth.currentUser.uid
    });

    /* =========================================
       UPDATE USER (NO READ - USE INCREMENT)
    ========================================= */
    const userRef = doc(db,"users", userId);

    await updateDoc(userRef,{
      totalTopup: increment(amount)
    });

    alert("Top up berhasil di-approve");

    /* =========================================
       ⚠️ JANGAN RELOAD SEMUA
       UPDATE UI SAJA
    ========================================= */

    // contoh: hapus row langsung
    const row = document.getElementById("trx-"+trxId);
    if(row) row.remove();

  } catch(error){
    alert(error.message || "Gagal approve");
  }
};

/* =====================================================
   REJECT TOPUP (OPTIMIZED)
===================================================== */
window.rejectTopup = async function(trxId){

  try {

    const trxRef = doc(db,"walletTransactions",trxId);
    const trxSnap = await getDoc(trxRef);

    if(!trxSnap.exists() ||
       trxSnap.data().status !== "PENDING"){
      alert("Sudah diproses");
      return;
    }

    await updateDoc(trxRef,{
      status: "REJECTED",
      rejectedAt: serverTimestamp()
    });

    alert("Top up ditolak");

    // hapus row langsung (NO renderAdmin)
    const row = document.getElementById("trx-"+trxId);
    if(row) row.remove();

  } catch(err){
    alert("Gagal reject");
  }
};

async function initBroadcastUI(){

  const modeSelect = document.getElementById("broadcastMode");
  const memberListDiv = document.getElementById("memberSelectList");
  const btn = document.getElementById("sendBroadcastBtn");
  const textarea = document.getElementById("broadcastMessage");

  // 🔥 CACHE (ANTI RE-FETCH)
  let usersSnap = null;
  let usersLoaded = false;

  // 🔧 HANDLE MODE CHANGE (LAZY LOAD)
  modeSelect.onchange = async ()=>{

    if(modeSelect.value === "manual"){

      memberListDiv.style.display = "block";

      // 🔥 LOAD SEKALI SAJA
      if(!usersLoaded){

        memberListDiv.innerHTML = "Loading members...";

        try{

          usersSnap = await getDocs(collection(db,"users"));

          let memberHTML = "";

          usersSnap.forEach(docSnap=>{
            const data = docSnap.data();
            const uid = docSnap.id;

            memberHTML += `
              <div style="margin-bottom:6px;">
                <label style="cursor:pointer;">
                  <input type="checkbox" value="${uid}" class="broadcast-user-checkbox" />
                  ${data.fullName || data.username || "User"}
                </label>
              </div>
            `;
          });

          memberListDiv.innerHTML = memberHTML;
          usersLoaded = true;

        }catch(err){
          console.error(err);
          memberListDiv.innerHTML = "Gagal load users";
        }
      }

    } else {

      memberListDiv.style.display = "none";
    }
  };

  // 🔧 HANDLE SEND
  btn.onclick = async ()=>{

    const message = textarea.value.trim();
    if(!message) return;

    btn.disabled = true;
    btn.textContent = "Sending...";

    let targetUids = [];

    try{

      if(modeSelect.value === "all"){

        // 🔥 LOAD SEKALI JIKA BELUM ADA
        if(!usersSnap){
          usersSnap = await getDocs(collection(db,"users"));
        }

        usersSnap.forEach(docSnap=>{
          targetUids.push(docSnap.id);
        });

      }else{

        document
          .querySelectorAll(".broadcast-user-checkbox:checked")
          .forEach(cb=>{
            targetUids.push(cb.value);
          });

        if(targetUids.length === 0){
          alert("Select at least one member.");
          btn.disabled = false;
          btn.textContent = "Send Broadcast";
          return;
        }
      }

      await sendAdminBroadcast(message, targetUids);

      textarea.value = "";
      btn.textContent = "Sent ✔";

      setTimeout(()=>{
        btn.textContent = "Send Broadcast";
      },1500);

    }catch(err){
      console.error(err);
      btn.textContent = "Error";
    }

    btn.disabled = false;
  };
}

export async function loadStoreApplications(){

  const container = document.getElementById("adminStoreApps");
  if(!container) return;

  container.innerHTML = "";

  try{

    const snap = await getDocs(collection(db,"storeApplications"));

    snap.forEach(docu=>{

      const d = docu.data();

      container.innerHTML += `
  <div class="admin-card">

    <b>${d.storeName || "-"}</b><br>
    ${d.fullName || d.name || "-"}<br>
    ${d.phone || "-"}<br>

    produk: ${d.productEstimate || "-"}<br>
    omzet: ${d.revenueEstimate || "-"}<br>

    status: ${d.status || "pending"}

  </div>
`;

    });

  }catch(err){
    console.error(err);
  }

}
window.exportStoreApplications = async function(){

  try{

    const snap = await getDocs(collection(db,"storeApplications"));

    let csv = "Nama,NamaToko,Phone,Produk,Omzet\n";

    snap.forEach(docu=>{

      const d = docu.data();

      csv += `${d.name || ""},${d.storeName || ""},${d.phone || ""},${d.productEstimate || ""},${d.revenueEstimate || ""}\n`;

    });

    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "storeApplications.csv";
    a.click();

  }catch(err){
    console.error(err);
  }

};



/* =====================================================
   EXPORT FUNCTIONS (RAPI & AMAN)
===================================================== */

function downloadCSV(filename, rows) {

  const csvContent = rows
    .map(row =>
      row
        .map(val => `"${String(val ?? "").replace(/"/g,'""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(
    [csvContent],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


/* =====================================================
   EXPORT TOPUP HISTORY (ALL TIME)
   Includes: username + email
===================================================== */

window.exportTopupHistory = async function(){

  const snap = await getDocs(collection(db,"walletMutations"));

  let rows = [[
    "Tanggal",
    "UID",
    "Username",
    "Email",
    "Amount",
    "BalanceAfter",
    "Status",
    "Source"
  ]];

  for (const docSnap of snap.docs){

    const d = docSnap.data();

    if (d.mutationType !== "TOPUP") continue;

    let username = "";
    let email = "";

    if (d.userId){

      try{

        const userRef = doc(db,"users",d.userId);
        const userSnap = await getDoc(userRef);

        if(userSnap.exists()){
          const u = userSnap.data();
          username = u.username || u.name || "";
          email = u.email || "";
        }

      }catch(e){
        console.warn("User fetch error", e);
      }

    }

    rows.push([
      d.createdAt?.toDate?.()?.toLocaleString("id-ID") || "",
      d.userId || "",
      username,
      email,
      d.amount || 0,
      d.balanceAfter ?? "",
      d.description || "",
      d.asset || ""
    ]);

  }

  downloadCSV("topup_history_all.csv", rows);
};
/* =====================================================
   EXPORT WALLET TRANSACTIONS (RAW – ALL FIELDS)
===================================================== */

window.exportWalletTransactionsRaw = async function(){

  const snap =
    await getDocs(collection(db,"walletTransactions"));

  if (snap.empty) {
    alert("Tidak ada data walletTransactions");
    return;
  }

  // Ambil semua possible field secara dinamis
  const allFields = new Set();

  snap.forEach(docSnap=>{
    const d = docSnap.data();
    Object.keys(d).forEach(key=>{
      allFields.add(key);
    });
  });

  const headers = ["docId", ...Array.from(allFields)];

  let rows = [headers];

  snap.forEach(docSnap=>{

    const d = docSnap.data();

    const row = [docSnap.id];

    headers.slice(1).forEach(field=>{

      let value = d[field];

      if (value?.toDate) {
        value = value.toDate().toLocaleString("id-ID");
      }

      row.push(value ?? "");
    });

    rows.push(row);
  });

  downloadCSV("walletTransactions_FULL_RAW.csv", rows);
};

/* =====================================================
   EXPORT BOOKING HISTORY
===================================================== */

window.exportBookingHistory = async function(){

  const snap =
    await getDocs(collection(db,"bookings"));

  let rows = [[
    "BookingID",
    "UID",
    "SessionPrice",
    "RacketTotal",
    "TotalPrice",
    "Status",
    "Attendance"
  ]];

  snap.forEach(docSnap => {

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


/* =====================================================
   EXPORT ADJUSTMENT HISTORY
===================================================== */

window.exportAdjustmentHistory = async function(){

  const snap =
    await getDocs(collection(db,"walletLedger"));

  let rows = [[
    "Tanggal",
    "UID",
    "EntryType",
    "Amount",
    "BalanceBefore",
    "BalanceAfter",
    "Note"
  ]];

  snap.forEach(docSnap => {

    const d = docSnap.data();

    if (d.referenceType !== "ADMIN_ADJUSTMENT")
      return;

    rows.push([
      d.createdAt?.toDate?.()
        ?.toLocaleString("id-ID") || "",
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



window.exportMembersToCSV = async function(){

  try{

    const snap = await getDocs(collection(db,"users"));

    if(snap.empty){
      alert("Tidak ada data user");
      return;
    }

    const fieldSet = new Set();

    snap.forEach(docSnap=>{
      const data = docSnap.data();
      Object.keys(data).forEach(k=>fieldSet.add(k));
    });

    const fields = Array.from(fieldSet).sort();

    const headers = ["UID", ...fields];

    let rows = [headers];

    snap.forEach(docSnap=>{

      const d = docSnap.data();

      const row = [docSnap.id];

      fields.forEach(f=>{

        let val = d[f];

        if(val?.toDate){
          val = val.toDate().toLocaleString("id-ID");
        }

        if(typeof val === "object" && val !== null){
          val = JSON.stringify(val);
        }

        if(val === true) val = "YES";
        if(val === false) val = "NO";

        row.push(val ?? "");

      });

      rows.push(row);

    });

    downloadCSV("giltclub_members_all_fields.csv", rows);

  }
  catch(err){
    console.error(err);
    alert("Gagal export members");
  }

};


/* =====================================================
   EXPORT FULL MUTATION
===================================================== */

window.exportFullMutation = async function(){

  const snap = await getDocs(collection(db,"walletMutations"));

  let rows = [[
    "CreatedAt",
    "UserId",
    "MutationType",
    "Asset",
    "Amount",
    "BalanceAfter",
    "ReferenceId",
    "Description",
    "CreatedBy"
  ]];

  snap.forEach(docSnap => {

    const d = docSnap.data();

    rows.push([
      d.createdAt?.toDate?.().toLocaleString("id-ID") || "",
      d.userId || "",
      d.mutationType || "",
      d.asset || "",
      d.amount || 0,
      d.balanceAfter ?? "",
      d.referenceId || "",
      d.description || "",
      d.createdBy || ""
    ]);

  });

  downloadCSV("wallet_mutations_full.csv", rows);

};


/* =====================================================
   AUDIT OLD SYSTEM RECONCILIATION
===================================================== */

window.auditOldSystemReconciliation = async function(){

  try {

    const usersSnap =
      await getDocs(collection(db,"users"));

    const trxSnap =
      await getDocs(collection(db,"walletTransactions"));

    if (usersSnap.empty) {
      alert("Tidak ada user");
      return;
    }

    const calculatedBalance = {};

    trxSnap.forEach(docSnap => {

      const d = docSnap.data();
      const uid = d.userId;

      if (!uid) return;

      if (d.status &&
          d.status !== "APPROVED" &&
          d.status !== "SUCCESS")
        return;

      if (!calculatedBalance[uid])
        calculatedBalance[uid] = 0;

      calculatedBalance[uid] +=
        Number(d.amount || 0);
    });

    let rows = [[
      "UID",
      "Username",
      "Stored WalletBalance",
      "Calculated From Transactions",
      "Difference"
    ]];

    usersSnap.forEach(userDoc => {

      const uid = userDoc.id;
      const userData = userDoc.data();

      const stored =
        Number(userData.walletBalance || 0);

      const calculated =
        Number(calculatedBalance[uid] || 0);

      const diff = stored - calculated;

      rows.push([
        uid,
        userData.username || "",
        stored,
        calculated,
        diff
      ]);
    });

    downloadCSV(
      "audit_reconciliation_old_system.csv",
      rows
    );

    alert("Audit Rekonsiliasi selesai");

  } catch(err) {

    console.error(err);
    alert("Gagal audit");
  }
};


/* =====================================================
   MASSIVE CLEANUP
===================================================== */

window.massiveCleanupFields = async function(){

  try {

    const usersSnap =
      await getDocs(collection(db,"users"));

    for (const docSnap of usersSnap.docs) {

      await updateDoc(
        doc(db,"users",docSnap.id),
        {
          points: deleteField(),
          usernameID: deleteField(),
          displayName: deleteField(),
          matches: deleteField(),
          verifiedApproved: deleteField(),
          wins: deleteField(),
          gPoints: deleteField()
        }
      );

      console.log("Cleaned:", docSnap.id);
    }

    console.log("Massive field cleanup DONE.");

  } catch(err) {

    console.error("Cleanup error:", err);
  }
};

window.openFlashAdmin = async function () {

  const { renderFlashAdmin } = await import("./store/flash-admin.js");
  renderFlashAdmin();

};
window.handleBalanceAdjustment = handleBalanceAdjustment;
window.runMigration = runMigration;

window.openRewardAdmin = async function () {

  const { renderRewardAdmin } =
    await import("./store/reward-admin.js");

  renderRewardAdmin();

};

/* =====================================================
   EXPORT ONLINE LOGS
===================================================== */

window.exportOnlineLogs = async function(){

  const snap =
    await getDocs(collection(db,"onlineLogs"));

  let rows = [[
    "Timestamp",
    "UID",
    "Username",
    "Device",
    "Page"
  ]];

  snap.forEach(docSnap => {

    const d = docSnap.data();

    rows.push([
      d.timestamp?.toDate?.()
        ?.toLocaleString("id-ID") || "",
      d.uid || "",
      d.username || "",
      d.device || "",
      d.page || ""
    ]);

  });

  downloadCSV("online_logs.csv", rows);

};


window.openProductAdmin = async function(){

  const { renderProductAdmin } =
    await import("./store/product-admin.js");

  renderProductAdmin();

};
