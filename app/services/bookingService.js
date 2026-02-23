import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================
   CREATE BOOKING (ATOMIC CLEAN VERSION)
===================================================== */
export async function createBooking({ userId, scheduleId }) {

  const scheduleRef = doc(db, "schedules", scheduleId);
  const userRef = doc(db, "users", userId);
  const bookingsCol = collection(db, "bookings");
  const ledgerCol = collection(db, "walletTransactions");

  await runTransaction(db, async (transaction) => {

    // 1️⃣ Get Schedule
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error("Schedule not found");

    const scheduleData = scheduleSnap.data();
    const availableSlots = scheduleData.slots ?? scheduleData.maxPlayers ?? 0;
    const price = scheduleData.pricePerHour || 0;

    if (availableSlots <= 0) {
      throw new Error("Slot full");
    }

    // 2️⃣ Get User
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < price) {
      throw new Error("Saldo tidak cukup");
    }

    // 3️⃣ Duplicate Guard
    const duplicateQuery = query(
      bookingsCol,
      where("userId", "==", userId),
      where("scheduleId", "==", scheduleId),
      where("status", "==", "active")
    );

    const duplicateSnap = await getDocs(duplicateQuery);
    if (!duplicateSnap.empty) {
      throw new Error("Sudah booking sesi ini");
    }

    // 4️⃣ Create Booking
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      price,
      status: "active",
      createdAt: serverTimestamp()
    });

    // 5️⃣ Reduce Slot
    transaction.update(scheduleRef, {
      slots: availableSlots - 1
    });

    // 6️⃣ Deduct Wallet
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
   CANCEL BOOKING (SIMPLE REFUND VERSION)
===================================================== */
export async function cancelBooking({ bookingId }) {

  const bookingRef = doc(db, "bookings", bookingId);
  const ledgerCol = collection(db, "walletTransactions");

  await runTransaction(db, async (transaction) => {

    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found");

    const bookingData = bookingSnap.data();
    if (bookingData.status !== "active") {
      throw new Error("Booking already cancelled");
    }

    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const userRef = doc(db, "users", bookingData.userId);

    const scheduleSnap = await transaction.get(scheduleRef);
    const userSnap = await transaction.get(userRef);

    if (!scheduleSnap.exists()) throw new Error("Schedule not found");
    if (!userSnap.exists()) throw new Error("User not found");

    const scheduleData = scheduleSnap.data();
    const userData = userSnap.data();

    const price = bookingData.price || 0;

    // 1️⃣ Update Booking
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp()
    });

    // 2️⃣ Restore Slot
    const currentSlots = scheduleData.slots ?? 0;

    transaction.update(scheduleRef, {
      slots: currentSlots + 1
    });

    // 3️⃣ Refund Full (simple version)
    const newBalance = (userData.walletBalance || 0) + price;

    transaction.update(userRef, {
      walletBalance: newBalance
    });

    const ledgerRef = doc(ledgerCol);

    transaction.set(ledgerRef, {
      userId: bookingData.userId,
      type: "refund",
      amount: price,
      balanceAfter: newBalance,
      referenceId: bookingId,
      createdAt: serverTimestamp()
    });

  });

  return { success: true };
}
