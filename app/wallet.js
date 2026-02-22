import {
  doc,
  runTransaction,
  collection,
  addDoc,
  serverTimestamp
} from "./firestore.js";
import { auth, db } from "./firebase.js";

export async function injectSaldo(amount){

  const user = auth.currentUser;
  if(!user) return;

  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {

    const userSnap = await transaction.get(userRef);

    if(!userSnap.exists()){
      throw new Error("User not found");
    }

    const currentBalance = userSnap.data().walletBalance || 0;
    const newBalance = currentBalance + amount;

    transaction.update(userRef, {
      walletBalance: newBalance
    });

  });

  // Simpan mutasi
  await addDoc(collection(db, "wallet_transactions"), {
    userId: user.uid,
    type: "topup",
    amount: amount,
    description: "Manual Inject",
    createdAt: serverTimestamp()
  });

}
