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

window.approveTopup = async function(trxId, uid, amount){

  const userRef = doc(db,"users", uid);
  const trxRef  = doc(db,"walletTransactions", trxId);

  const userSnap = await getDoc(userRef);
  const currentBalance = userSnap.data().walletBalance || 0;

  const newBalance = currentBalance + amount;

  // update transaction (WITH RUNNING BALANCE)
  await updateDoc(trxRef,{
    status:"APPROVED",
    approvedAt: serverTimestamp(),
    balanceAfter: newBalance
  });

  // update user balance
  await updateDoc(userRef,{
    walletBalance: newBalance
  });

  alert("Approved");
  renderAdmin();
};
