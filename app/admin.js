import { auth, db } from "./firebase.js";
import { 
  collection,
  query,
  where,
  getDocs,
  getDoc,          // ✅ INI YANG KURANG
  doc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { recalculateUserStats } from "./userStats.js";

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

    const userSnap = await getDoc(doc(db,"users", d.uid));
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
          <button onclick="approveTopup('${docSnap.id}','${d.uid}',${d.amount})">
            Approve
          </button>
        </div>
      </div>
    `;
  }

  html += `</div>`;

  content.innerHTML = html;
}

window.approveTopup = async function(trxId, uid, amount, btn){

  try{

    // 🔒 Disable button supaya tidak bisa double click
    if(btn){
      btn.disabled = true;
      btn.innerText = "Processing...";
    }

    const userRef = doc(db,"users",uid);
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

async function migrateOpeningBalance(dataList){

  for(const item of dataList){

    const userRef = doc(db,"users", item.uid);
    const trxRef  = doc(db,"walletTransactions", `${item.uid}_MIGRATION`);

    await setDoc(trxRef,{
      uid: item.uid,
      type: "PEMBUKAAN REKENING SALDO BARU",
      amount: item.amount,
      status: "APPROVED",
      balanceAfter: item.amount,
      createdAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      note: "Migrasi saldo awal dari sistem lama"
    });

    await updateDoc(userRef,{
      walletBalance: item.amount
    });

  }

  console.log("Migrasi selesai.");
}
