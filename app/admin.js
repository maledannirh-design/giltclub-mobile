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

const BASE_SCAN_URL =
  "https://maledannirh-design.github.io/giltclub-mobile/app/scan.html";

/* =====================================================
   RENDER ADMIN PANEL
===================================================== */
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

  if(snap.empty){
    html += `<div style="opacity:.6;margin-bottom:20px;">
      Tidak ada top up pending
    </div>`;
  }

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

  // 🔥 CONTAINER ADJUSTMENT
  html += `
      <div id="adminBalanceAdjustment" style="margin-top:40px;"></div>
    </div>
  `;

  content.innerHTML = html;

  // 🔥 WAJIB PANGGIL
  await renderBalanceAdjustmentPanel();
}

/* =====================================================
   APPROVE TOP UP
===================================================== */
window.approveTopup = async function(trxId, userId, amount, btn){

  try{

    if(btn){
      btn.disabled = true;
      btn.innerText = "Processing...";
    }

    const userRef = doc(db,"users", userId);
    const trxRef  = doc(db,"walletTransactions",trxId);

    const trxSnap = await getDoc(trxRef);
    if(!trxSnap.exists() || trxSnap.data().status !== "PENDING"){
      alert("Transaksi sudah diproses.");
      renderAdmin();
      return;
    }

    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const newBalance = (userData.walletBalance || 0) + amount;
    const newTopup = (userData.totalTopup || 0) + amount;

    const stats = recalculateUserStats({
      totalTopup: newTopup,
      totalPayment: userData.totalPayment || 0,
      membership: userData.membership
    });

    await updateDoc(userRef,{
      walletBalance: newBalance,
      totalTopup: newTopup,
      level: stats.level,
      exp: stats.expTotal,
      gPoint: stats.gPoint
    });

    await updateDoc(trxRef,{
      status:"APPROVED",
      approvedAt: serverTimestamp()
    });

    alert("Approved");
    renderAdmin();

  }catch(error){
    console.error(error);
    alert("Error approve");
    renderAdmin();
  }
};

/* =====================================================
   REJECT TOP UP
===================================================== */
window.rejectTopup = async function(trxId){

  try{

    const trxRef = doc(db,"walletTransactions",trxId);
    const trxSnap = await getDoc(trxRef);

    if(!trxSnap.exists() || trxSnap.data().status !== "PENDING"){
      alert("Transaksi sudah diproses.");
      renderAdmin();
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
  }
};

/* =====================================================
   RENDER BALANCE ADJUSTMENT PANEL
===================================================== */
async function renderBalanceAdjustmentPanel(){

  const container = document.getElementById("adminBalanceAdjustment");
  if (!container) return;

  const usersSnap = await getDocs(collection(db,"users"));

  let options = "";

  usersSnap.docs.forEach(docSnap=>{
    const u = docSnap.data();
    options += `
      <option value="${docSnap.id}">
        ${u.username || u.fullName || docSnap.id}
      </option>
    `;
  });

  container.innerHTML = `
    <div class="admin-card">

      <h3>Manual Balance Adjustment</h3>

      <label>User</label>
      <select id="adjustUser">
        ${options}
      </select>

      <label>Nominal (boleh minus)</label>
      <input type="number" id="adjustAmount" placeholder="50000 atau -20000">

      <label>Catatan</label>
      <input type="text" id="adjustNote" placeholder="Alasan adjustment">

      <button id="saveAdjustment" class="admin-btn">
        Simpan
      </button>

    </div>
  `;

  document.getElementById("saveAdjustment").onclick = handleBalanceAdjustment;
}

/* =====================================================
   HANDLE ADJUSTMENT
===================================================== */
async function handleBalanceAdjustment(){

  const userId = document.getElementById("adjustUser").value;
  const amount = Number(document.getElementById("adjustAmount").value);
  const note = document.getElementById("adjustNote").value.trim();

  if (!amount || isNaN(amount)) {
    alert("Nominal tidak valid");
    return;
  }

  try {

    const userRef = doc(db, "users", userId);
    const ledgerCol = collection(db, "walletTransactions");

    await runTransaction(db, async (transaction)=>{

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User tidak ditemukan");

      const currentBalance = userSnap.data().walletBalance || 0;
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error("Saldo tidak boleh minus");
      }

      transaction.update(userRef,{
        walletBalance: newBalance
      });

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

    alert("Adjustment berhasil");
    renderAdmin();

  } catch(err){
    alert(err.message || "Gagal adjustment");
  }
}

window.generateQrForAllUsers = async function(){

  const usersSnap = await getDocs(collection(db,"users"));

  if(usersSnap.empty){
    console.log("No users found");
    return;
  }

  for(const docSnap of usersSnap.docs){

    const uid = docSnap.id;

    try{

      await generateMemberCode(uid);
      await generateQrUrl(uid);

      console.log("Generated:", uid);

    }catch(err){
      console.error("Error on user:", uid, err);
    }
  }

  console.log("✅ All users processed");
};

window.generateQrUrl = async function(uid){

  const userRef = doc(db,"users",uid);
  const secureRef = doc(db,"users",uid,"private","secure");

  const userSnap = await getDoc(userRef);
  if(!userSnap.exists()){
    console.log("User not found");
    return;
  }

  const userData = userSnap.data();

  if(!userData.memberCode){
    console.log("MemberCode missing");
    return;
  }

  let secureSnap = await getDoc(secureRef);

  // Auto create secure if missing
  if(!secureSnap.exists()){

    const secretKey = crypto.randomUUID().replace(/-/g,"");
    const issue = 1;

    await setDoc(secureRef,{ secretKey, issue });
    secureSnap = await getDoc(secureRef);

    console.log("Private secure auto-created");
  }

  const { secretKey, issue } = secureSnap.data();

  const raw = userData.memberCode + issue + secretKey;

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray
    .map(b=>b.toString(16).padStart(2,"0"))
    .join("");

  const finalUrl =
    `${BASE_SCAN_URL}?c=${userData.memberCode}&i=${issue}&s=${signature}`;

  await updateDoc(userRef,{ qrUrl: finalUrl });

  console.log("QR URL:", finalUrl);
};


// expose
window.runMigration = runMigration;
