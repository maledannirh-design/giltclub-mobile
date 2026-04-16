import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  increment,
  doc,
  updateDoc,
  serverTimestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { sendAdminBroadcast } from "./broadcast.js";
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
    <h3>Export & Audit Tools</h3>

    <button onclick="exportOnlineLogs()" class="admin-btn" style="margin-top:10px;">
      Export Online Logs
    </button>

    <button onclick="exportMembersToCSV()" class="admin-btn" style="margin-top:10px;">
      Export Members
    </button>

    <button onclick="exportFullMutation()" class="admin-btn" style="margin-top:10px;">
      Export Full Wallet Mutations
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
  await initBroadcastUI();
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

async function initBroadcastUI(){

  const modeSelect = document.getElementById("broadcastMode");
  const memberListDiv = document.getElementById("memberSelectList");
  const btn = document.getElementById("sendBroadcastBtn");
  const textarea = document.getElementById("broadcastMessage");

  // 🔥 CACHE (manual only)
  let usersSnap = null;
  let usersLoaded = false;

  // =========================
  // MODE CHANGE
  // =========================
  modeSelect.onchange = async ()=>{

    // =========================
    // 🔹 MANUAL MODE
    // =========================
    if(modeSelect.value === "manual"){

      memberListDiv.style.display = "block";

      // 🔥 LOAD SEKALI SAJA (manual only)
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

    } 
    
    // =========================
    // 🔹 ALL MODE
    // =========================
    else {
      memberListDiv.style.display = "none";
    }
  };

  // =========================
  // SEND BUTTON
  // =========================
  btn.onclick = async ()=>{

    const message = textarea.value.trim();

    if(!message){
      alert("Message tidak boleh kosong");
      return;
    }

    if(btn.disabled) return;

    btn.disabled = true;
    btn.textContent = "Sending...";

    let targetUids = null; // 🔥 default = ALL

    try{

      console.log("MODE:", modeSelect.value);

      // =========================
      // 🔹 MANUAL MODE
      // =========================
      if(modeSelect.value === "manual"){

        targetUids = [];

        document
          .querySelectorAll(".broadcast-user-checkbox:checked")
          .forEach(cb=>{
            targetUids.push(cb.value);
          });

        if(targetUids.length === 0){
          throw new Error("Pilih minimal 1 member");
        }
      }

      // =========================
      // 🔹 ALL MODE
      // =========================
      else{
        // 🔥 tidak load users lagi
        targetUids = null;
      }

      console.log("TARGET:", targetUids ? targetUids.length : "ALL");

      // =========================
      // 🔥 TIMEOUT GUARD
      // =========================
      const timeout = new Promise((_, reject)=>
        setTimeout(()=>reject(new Error("Timeout kirim broadcast")), 15000)
      );

      await Promise.race([
        sendAdminBroadcast(message, targetUids),
        timeout
      ]);

      // =========================
      // SUCCESS
      // =========================
      textarea.value = "";
      btn.textContent = "Sent ✔";

      console.log("Broadcast success");

      setTimeout(()=>{
        btn.textContent = "Send Broadcast";
      },1500);

    }catch(err){

      console.error("Broadcast error:", err);

      alert(err.message || "Gagal kirim broadcast");

      btn.textContent = "Error";

      setTimeout(()=>{
        btn.textContent = "Send Broadcast";
      },2000);
    }

    btn.disabled = false;
  };

  // 🔥 AUTO TRIGGER FIRST STATE
  modeSelect.dispatchEvent(new Event("change"));
}

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

window.openFlashAdmin = async function(){
  const { renderFlashAdmin } =
    await import("./store/flash-admin.js");

  renderFlashAdmin();
};

window.openRewardAdmin = async function(){
  const { renderRewardAdmin } =
    await import("./store/reward-admin.js");

  renderRewardAdmin();
};
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
