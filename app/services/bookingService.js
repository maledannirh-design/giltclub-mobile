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

/* =====================================================
   CREATE BOOKING (FULL ATOMIC + WALLET LEDGER)
===================================================== */
export async function createBooking({ userId, scheduleId }) {

  const scheduleRef = doc(db, "schedules", scheduleId);
  const bookingsCol = collection(db, "bookings");
  const userRef = doc(db, "users", userId);
  const ledgerCol = collection(db, "wallet_transactions");

  await runTransaction(db, async (transaction) => {

    // 1️⃣ Get Schedule
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) {
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();
    const availableSlots = scheduleData.slots || 0;
    const price = scheduleData.price || 0;

    if (availableSlots <= 0) {
      throw new Error("Slot full");
    }

    // 2️⃣ Get User
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < price) {
      throw new Error("Insufficient balance");
    }

    // 3️⃣ Duplicate Booking Guard
    const duplicateQuery = query(
      bookingsCol,
      where("userId", "==", userId),
      where("scheduleId", "==", scheduleId),
      where("status", "==", "active")
    );

    const duplicateSnap = await getDocs(duplicateQuery);
    if (!duplicateSnap.empty) {
      throw new Error("You already booked this schedule");
    }

    // 4️⃣ Create Booking
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      createdAt: serverTimestamp(),
      status: "active",
      price
    });

    // 5️⃣ Reduce Slot
    transaction.update(scheduleRef, {
      slots: availableSlots - 1
    });

    // 6️⃣ Wallet Debit
    const newBalance = currentBalance - price;

    transaction.update(userRef, {
      walletBalance: newBalance
    });

    // 7️⃣ Ledger Entry
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


/* =====================================================
   CANCEL BOOKING (TIER REFUND + LEDGER + ATOMIC)
===================================================== */
export async function cancelBooking({ bookingId }) {

  const bookingRef = doc(db, "bookings", bookingId);
  const ledgerCol = collection(db, "wallet_transactions");

  await runTransaction(db, async (transaction) => {

    // 1️⃣ Get Booking
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error("Booking not found");
    }

    const bookingData = bookingSnap.data();

    if (bookingData.status !== "active") {
      throw new Error("Booking already cancelled");
    }

    // 2️⃣ Get Schedule
    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const scheduleSnap = await transaction.get(scheduleRef);

    if (!scheduleSnap.exists()) {
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();

    // 3️⃣ Get User
    const userRef = doc(db, "users", bookingData.userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();

    // 4️⃣ Deadline Check
    const scheduleDate = new Date(scheduleData.date);
    const now = new Date();
    const diffHours = (scheduleDate - now) / (1000 * 60 * 60);

    if (diffHours < CANCEL_POLICY.deadlineHours) {
      throw new Error("Cancel deadline passed");
    }

    // 5️⃣ Tier Refund Calculation
    let refundRate = 0;

    for (const tier of CANCEL_POLICY.tiers) {
      if (diffHours >= tier.minHoursBefore) {
        refundRate = tier.refundRate;
        break;
      }
    }

    const price = bookingData.price || scheduleData.price || 0;
    const refundAmount = price * refundRate;

    // 6️⃣ Update Booking Status
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      refundRate,
      refundAmount
    });

    // 7️⃣ Restore Slot
    const currentSlots = scheduleData.slots || 0;

    transaction.update(scheduleRef, {
      slots: currentSlots + 1
    });

    // 8️⃣ Wallet Refund + Ledger
    if (refundAmount > 0) {

      const currentBalance = userData.walletBalance || 0;
      const newBalance = currentBalance + refundAmount;

      transaction.update(userRef, {
        walletBalance: newBalance
      });

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
