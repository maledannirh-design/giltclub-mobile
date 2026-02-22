import { auth, db } from "./firebase.js";

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  getDoc,
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderWallet(){

  const uid = auth.currentUser.uid;
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  const balance = userSnap.data().walletBalance || 0;

  document.getElementById("content").innerHTML = `
  <div class="wallet-container">

    <div class="wallet-card">
      <div class="wallet-label">Total Balance</div>
      <div class="wallet-balance" id="wallet-balance">Rp 0</div>
    </div>

    <div class="wallet-actions">
      <button onclick="topUp()">Top Up</button>
      <button onclick="payNow()">Pay</button>
      <button onclick="transfer()">Transfer</button>
    </div>

    <div class="wallet-history" id="wallet-history"></div>

  </div>
`;
}
function renderTransaction(trx){

  return `
    <div class="trx-card">
      <div>
        <div class="trx-type">${trx.type}</div>
        <div class="trx-date">${new Date(trx.createdAt.seconds*1000).toLocaleDateString()}</div>
      </div>
      <div class="trx-amount ${trx.amount > 0 ? 'plus' : 'minus'}">
        Rp ${trx.amount.toLocaleString("id-ID")}
      </div>
    </div>
  `;
}

//migration balance//
export async function migrateOpeningBalance(){

  const usersSnap = await getDocs(collection(db, "users"));

  for (const userDoc of usersSnap.docs) {

    const userData = userDoc.data();
    const oldBalance = userData.balance || 0;

    if (oldBalance > 0) {

      const trxRef = doc(collection(db, "walletTransactions"));

      await setDoc(trxRef, {
        uid: userDoc.id,
        type: "OPENING",
        amount: oldBalance,
        balanceAfter: oldBalance,
        createdAt: new Date(),
        note: "Migrated Opening Balance"
      });

      await updateDoc(userDoc.ref, {
        walletBalance: oldBalance
      });
    }
  }

  console.log("Migration Done");
}
