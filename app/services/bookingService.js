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

  await runTransaction(db, async (transaction) => {

    const scheduleSnap = await transaction.get(scheduleRef);

    if (!scheduleSnap.exists()){
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();

    if ((scheduleData.slots || 0) <= 0){
      throw new Error("Slot full");
    }

    // 🔥 CHECK DUPLICATE BOOKING
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

    // Reduce slot atomically
    transaction.update(scheduleRef, {
      slots: scheduleData.slots - 1
    });

    // Create booking
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      createdAt: serverTimestamp(),
      status: "active"
    });

  });

  return { success: true };
}

export async function cancelBooking({ bookingId }){

  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async (transaction) => {

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
    // 1️⃣ DEADLINE CHECK
    // ============================

    const scheduleDate = new Date(scheduleData.date);
    const now = new Date();
    const diffHours = (scheduleDate - now) / (1000 * 60 * 60);

    if (diffHours < CANCEL_POLICY.deadlineHours){
      throw new Error("Cancel deadline passed");
    }

    // ============================
    // 2️⃣ TIER REFUND CALCULATION
    // ============================

    let refundRate = 0;

    for (const tier of CANCEL_POLICY.tiers){
      if (diffHours >= tier.minHoursBefore){
        refundRate = tier.refundRate;
        break;
      }
    }

    const price = scheduleData.price || 0;
    const refundAmount = price * refundRate;

    // ============================
    // 3️⃣ UPDATE BOOKING STATUS
    // ============================

    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      refundRate,
      refundAmount
    });

    // ============================
    // 4️⃣ RESTORE SLOT
    // ============================

    transaction.update(scheduleRef, {
      slots: (scheduleData.slots || 0) + 1
    });

    // ============================
    // 5️⃣ WALLET REFUND
    // ============================

    if (refundAmount > 0){
      transaction.update(userRef, {
        walletBalance: (userData.walletBalance || 0) + refundAmount
      });
    }

  });

  return { success: true };
}
