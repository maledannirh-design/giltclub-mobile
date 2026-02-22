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

  document.getElementById("wallet-balance").innerText =
    "Rp " + balance.toLocaleString("id-ID");
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
