import { auth, db } from "./firebase.js";
import { 
  collection,
  query,
  where,
  getDocs,
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

  let html = `<div class="admin-container">
                <h2>Pending Top Up</h2>`;

  snap.forEach(docSnap=>{
    const d = docSnap.data();

    html += `
      <div class="admin-trx">
        <div>
          <div>${d.uid}</div>
          <div>Rp ${d.amount.toLocaleString("id-ID")}</div>
        </div>
        <div>
          <button onclick="approveTopup('${docSnap.id}','${d.uid}',${d.amount})">
            Approve
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  content.innerHTML = html;
}

window.approveTopup = async function(trxId, uid, amount){

  await updateDoc(doc(db,"walletTransactions",trxId),{
    status:"APPROVED",
    approvedAt: serverTimestamp()
  });

  await updateDoc(doc(db,"users",uid),{
    walletBalance: increment(amount)
  });

  alert("Approved");
  renderAdmin();
};
