import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from "../firestore.js";

export async function applyWalletTransaction({
  userId,
  amount,
  type,
  referenceId
}){

  const userRef = doc(db, "users", userId);
  const ledgerRef = doc(collection(db, "wallet_transactions"));

  await runTransaction(db, async (transaction)=>{

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()){
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    const newBalance = currentBalance + amount;

    if (newBalance < 0){
      throw new Error("Insufficient balance");
    }

    // Update balance
    transaction.update(userRef, {
      walletBalance: newBalance
    });

    // Create ledger entry
    transaction.set(ledgerRef, {
      userId,
      type,
      amount,
      balanceAfter: newBalance,
      referenceId,
      createdAt: serverTimestamp()
    });

  });

  return { success: true };
}
