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
import { validateTransactionPin } from "../pinTrx.js";

/* =====================================================
   HELPER: HITUNG HARGA (CEIL PER JAM)
===================================================== */
function calculateSessionPrice(scheduleData){

  const [startH, startM] = scheduleData.startTime.split(":").map(Number);
  const [endH, endM] = scheduleData.endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const totalMinutes = endMinutes - startMinutes;

  if (totalMinutes <= 0) {
    throw new Error("Durasi sesi tidak valid");
  }

  // 🔥 1 menit pun dihitung 1 jam
  const billedHours = Math.ceil(totalMinutes / 60);

  return billedHours * (scheduleData.pricePerHour || 0);
}

/* =====================================================
   CREATE BOOKING (FINAL COMPLETE VERSION)
===================================================== */
export async function createBooking({
  userId,
  scheduleId,
  racketQty = 0,
  pin
}) {

  if (!pin) {
    throw new Error("PIN transaksi diperlukan");
  }

  // 1. VALIDATE PIN DULU (sebelum transaksi)
  const pinCheck = await validateTransactionPin(userId, pin);
  if (!pinCheck.valid) {
    throw new Error(pinCheck.reason);
  }

  const scheduleRef = doc(db, "schedules", scheduleId);
  const userRef = doc(db, "users", userId);
  const bookingsCol = collection(db, "bookings");
  const ledgerCol = collection(db, "walletTransactions");

  await runTransaction(db, async (transaction) => {

    // 2. GET SCHEDULE
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error("Schedule not found");

    const scheduleData = scheduleSnap.data();
    const availableSlots = scheduleData.slots ?? scheduleData.maxPlayers ?? 0;

    if (availableSlots <= 0) {
      throw new Error("Slot penuh");
    }

    // 3. HITUNG DURASI
    const [startH, startM] = scheduleData.startTime.split(":").map(Number);
    const [endH, endM] = scheduleData.endTime.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes;

    if (totalMinutes <= 0) {
      throw new Error("Durasi sesi tidak valid");
    }

    const billedHours = Math.ceil(totalMinutes / 60);

    const sessionPrice =
      billedHours * (scheduleData.pricePerHour || 0);

    // 4. RACKET
    const safeRacketQty = Number(racketQty) || 0;
    const racketStock = scheduleData.racketStock ?? 0;

    if (safeRacketQty > racketStock) {
      throw new Error("Stok raket tidak cukup");
    }

    const racketUnitPrice = scheduleData.racketPrice || 0;
    const racketTotal = safeRacketQty * racketUnitPrice;

    const totalPayment = sessionPrice + racketTotal;

    // 5. GET USER
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < totalPayment) {
      throw new Error("Saldo tidak cukup");
    }

    // 6. DUPLICATE GUARD
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

    // 7. CREATE BOOKING
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,

      sessionPrice,
      price: totalPayment,

      racketQty: safeRacketQty,
      racketUnitPrice,

      attendance: false,
      completed: false,

      status: "active",
      createdAt: serverTimestamp()
    });

    // 8. UPDATE SCHEDULE
    transaction.update(scheduleRef, {
      slots: availableSlots - 1,
      racketStock: racketStock - safeRacketQty
    });

    // 9. DEDUCT WALLET
    const newBalance = currentBalance - totalPayment;

    transaction.update(userRef, {
      walletBalance: newBalance,
      totalPayment: (userData.totalPayment || 0) + totalPayment
    });

    // 10. LEDGER
    const ledgerRef = doc(ledgerCol);

    transaction.set(ledgerRef, {
      userId,
      type: "booking_debit",
      amount: -totalPayment,
      balanceAfter: newBalance,
      referenceId: bookingRef.id,
      createdAt: serverTimestamp()
    });

  });

  return { success: true };
}

/* =====================================================
   CANCEL BOOKING (FINAL PRODUCTION VERSION)
===================================================== */
export async function cancelBooking({
  bookingId,
  pin
}) {

  if (!pin) {
    throw new Error("PIN transaksi diperlukan");
  }

  const bookingRef = doc(db, "bookings", bookingId);
  const ledgerCol = collection(db, "walletTransactions");

  await runTransaction(db, async (transaction) => {

    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found");

    const bookingData = bookingSnap.data();

    if (bookingData.status !== "active") {
      throw new Error("Booking already cancelled");
    }

    if (bookingData.attendance === true) {
      throw new Error("Tidak bisa cancel setelah check-in");
    }

    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const userRef = doc(db, "users", bookingData.userId);

    const scheduleSnap = await transaction.get(scheduleRef);
    const userSnap = await transaction.get(userRef);

    if (!scheduleSnap.exists()) throw new Error("Schedule not found");
    if (!userSnap.exists()) throw new Error("User not found");

    const scheduleData = scheduleSnap.data();
    const userData = userSnap.data();

    // Block jika sesi sudah selesai
    if (scheduleData.date && scheduleData.startTime) {
      const sessionStart = new Date(
        scheduleData.date + "T" + scheduleData.startTime
      );
      const now = new Date();
      if (now >= sessionStart) {
        throw new Error("Sesi sudah dimulai atau selesai");
      }
    }

    // VALIDATE PIN
    const pinCheck = await validateTransactionPin(
      bookingData.userId,
      pin
    );

    if (!pinCheck.valid) {
      throw new Error(pinCheck.reason);
    }

    const originalPrice = bookingData.price || 0;
    const racketQty = bookingData.racketQty || 0;

    // ===============================
    // HITUNG PENALTY
    // ===============================

    const sessionStart = new Date(
      scheduleData.date + "T" + scheduleData.startTime
    );
    const now = new Date();

    const diffMs = sessionStart - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    let refundAmount = 0;
    let penaltyAmount = 0;

    if (diffHours > 48) {
      penaltyAmount = originalPrice * 0.10;
      refundAmount = originalPrice - penaltyAmount;
    } else if (diffHours > 36) {
      penaltyAmount = originalPrice * 0.50;
      refundAmount = originalPrice - penaltyAmount;
    } else {
      penaltyAmount = originalPrice;
      refundAmount = 0;
    }

    refundAmount = Math.floor(refundAmount);
    penaltyAmount = Math.floor(penaltyAmount);

    // ===============================
    // UPDATE BOOKING
    // ===============================

    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp()
    });

    // ===============================
    // RESTORE SLOT & RACKET
    // ===============================

    const currentSlots = scheduleData.slots ?? 0;
    const currentRacketStock = scheduleData.racketStock ?? 0;

    transaction.update(scheduleRef, {
      slots: currentSlots + 1,
      racketStock: currentRacketStock + racketQty
    });

    // ===============================
    // UPDATE USER WALLET & TOTAL PAYMENT
    // ===============================

    const newBalance = (userData.walletBalance || 0) + refundAmount;

    transaction.update(userRef, {
      walletBalance: newBalance,
      totalPayment: (userData.totalPayment || 0) - originalPrice
    });

    // ===============================
    // LEDGER REFUND
    // ===============================

    if (refundAmount > 0) {

      const refundRef = doc(ledgerCol);

      transaction.set(refundRef, {
        userId: bookingData.userId,
        type: "refund",
        amount: refundAmount,
        balanceAfter: newBalance,
        referenceId: bookingId,
        createdAt: serverTimestamp()
      });
    }

    // ===============================
    // LEDGER PENALTY
    // ===============================

    if (penaltyAmount > 0) {

      const penaltyRef = doc(ledgerCol);

      transaction.set(penaltyRef, {
        userId: bookingData.userId,
        type: "cancel_penalty",
        amount: penaltyAmount,
        referenceId: bookingId,
        createdAt: serverTimestamp()
      });
    }

  });

  return { success: true };
}
