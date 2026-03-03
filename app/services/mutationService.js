import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================
   APPLY MUTATION (FINAL LEDGER ENGINE)
========================================= */

export async function applyMutation({
  userId,
  asset,            // "RUPIAH" | "GPOINT"
  mutationType,     // ex: TOPUP, BOOKING_PAYMENT
  amount,           // + or -
  referenceId = null,
  description = "",
  createdBy = "system"
}){

  if(!userId) throw new Error("userId required");
  if(!asset) throw new Error("asset required");
  if(!mutationType) throw new Error("mutationType required");
  if(!amount) throw new Error("amount required");

  const userRef = doc(db,"users", userId);
  const mutationRef = doc(collection(db,"walletMutations"));

  await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(userRef);

    if(!snap.exists()){
      throw new Error("User not found");
    }

    const userData = snap.data();

    // Determine balance field
    const balanceField =
      asset === "RUPIAH" ? "walletBalance" : "gPoint";

    const currentBalance = userData[balanceField] || 0;
    const newBalance = currentBalance + amount;

    if(newBalance < 0){
      throw new Error("Insufficient balance");
    }

    // Update balance
    transaction.update(userRef,{
      [balanceField]: newBalance
    });

    // Write ledger
    transaction.set(mutationRef,{
      userId,
      asset,
      mutationType,
      amount,
      balanceAfter: newBalance,
      referenceId,
      description,
      createdAt: serverTimestamp(),
      createdBy
    });

  });

  return { success:true };
}
