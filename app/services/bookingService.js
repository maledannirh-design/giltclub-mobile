import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs
} from "../firestore.js";
import { CANCEL_POLICY } from "../config.js";

export async function createBooking({ userId, scheduleId }){

  const scheduleRef = doc(db, "schedules", scheduleId);
  const bookingsCol = collection(db, "bookings");
  const userRef = doc(db, "users", userId);
  const ledgerCol = collection(db, "wallet_transactions");

  await runTransaction(db, async (transaction) => {

    // ============================
    // 1️⃣ GET SCHEDULE
    // ============================
    const scheduleSnap = await transaction.get(scheduleRef);

    if (!scheduleSnap.exists()){
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();

    if ((scheduleData.slots || 0) <= 0){
      throw new Error("Slot full");
    }

    const price = scheduleData.price || 0;

    // ============================
    // 2️⃣ GET USER
    // ============================
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()){
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < price){
      throw new Error("Insufficient balance");
    }

    // ============================
    // 3️⃣ CHECK DUPLICATE BOOKING
    // ============================
    const duplicateQuery = query(
      bookingsCol,
      where("userId", "==", userId),
      where("scheduleId", "==", scheduleId),
      where("status", "==", "active")
    );

    const duplicateSnap = await getDocs(duplicateQuery);

    if (!duplicateSnap.empty){
      throw new Error("You already booked this schedule");
    }

    // ============================
    // 4️⃣ CREATE BOOKING
    // ============================
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      createdAt: serverTimestamp(),
      status: "active",
      price
    });

    // ============================
    // 5️⃣ REDUCE SLOT
    // ============================
    transaction.update(scheduleRef, {
      slots: scheduleData.slots - 1
    });

    // ============================
    // 6️⃣ WALLET DEBIT
    // ============================
    const newBalance = currentBalance - price;

    transaction.update(userRef, {
      walletBalance: newBalance
    });

    // ============================
    // 7️⃣ LEDGER ENTRY
    // ============================
    const ledgerRef = doc(ledgerCol);

    transaction.set(ledgerRef, {
      userId,
      type: "booking_debit",
      amount: -price,
      balanceAfter: newBalance,
      referenceId: bookingRef.id,
      createdAt: serverTimestamp()
    });

  });

  return { success: true };
}

export async function cancelBooking({ bookingId }){

  const bookingRef = doc(db, "bookings", bookingId);
  const ledgerCol = collection(db, "wallet_transactions");

  await runTransaction(db, async (transaction) => {

    // ============================
    // 1️⃣ GET BOOKING
    // ============================
    const bookingSnap = await transaction.get(bookingRef);

    if (!bookingSnap.exists()){
      throw new Error("Booking not found");
    }

    const bookingData = bookingSnap.data();

    if (bookingData.status !== "active"){
      throw new Error("Booking already cancelled");
    }

    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const scheduleSnap = await transaction.get(scheduleRef);

    if (!scheduleSnap.exists()){
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();

    const userRef = doc(db, "users", bookingData.userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()){
      throw new Error("User not found");
    }

    const userData = userSnap.data();

    // ============================
    // 2️⃣ DEADLINE CHECK
    // ============================
    const scheduleDate = new Date(scheduleData.date);
    const now = new Date();
    const diffHours = (scheduleDate - now) / (1000 * 60 * 60);

    if (diffHours < CANCEL_POLICY.deadlineHours){
      throw new Error("Cancel deadline passed");
    }

    // ============================
    // 3️⃣ TIER REFUND CALCULATION
    // ============================
    let refundRate = 0;

    for (const tier of CANCEL_POLICY.tiers){
      if (diffHours >= tier.minHoursBefore){
        refundRate = tier.refundRate;
        break;
      }
    }

    const price = bookingData.price || scheduleData.price || 0;
    const refundAmount = price * refundRate;

    // ============================
    // 4️⃣ UPDATE BOOKING STATUS
    // ============================
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      refundRate,
      refundAmount
    });

    // ============================
    // 5️⃣ RESTORE SLOT
    // ============================
    transaction.update(scheduleRef, {
      slots: (scheduleData.slots || 0) + 1
    });

    // ============================
    // 6️⃣ WALLET REFUND (LEDGER SYSTEM)
    // ============================

    if (refundAmount > 0){

      const currentBalance = userData.walletBalance || 0;
      const newBalance = currentBalance + refundAmount;

      // Update balance
      transaction.update(userRef, {
        walletBalance: newBalance
      });

      // Create ledger entry
      const ledgerRef = doc(ledgerCol);

      transaction.set(ledgerRef, {
        userId: bookingData.userId,
        type: "refund",
        amount: refundAmount,
        balanceAfter: newBalance,
        referenceId: bookingId,
        createdAt: serverTimestamp()
      });

    }

  });

  return { success: true };
}

