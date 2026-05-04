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

  const billedHours = Math.ceil(totalMinutes / 60);

  return billedHours * (scheduleData.pricePerHour || 0);
}


/* =====================================================
   CREATE BOOKING (UPDATED WITH MONTHLY PAYMENT)
===================================================== */
export async function createBooking({
  userId,
  scheduleId,
  racketQty = 0,
  pin
}) {

  if (!pin) {
    if (typeof window.requestTransactionPin === "function") {
      pin = await window.requestTransactionPin();
    }
  }

  if (!pin) {
    throw new Error("PIN transaksi diperlukan");
  }

  const pinCheck = await validateTransactionPin(userId, pin);
  if (!pinCheck.valid) {
    throw new Error(pinCheck.reason);
  }

  const scheduleRef = doc(db, "schedules", scheduleId);
  const userRef = doc(db, "users", userId);
  const bookingsCol = collection(db, "bookings");
  const mutationsCol = collection(db, "walletMutations");

  await runTransaction(db, async (transaction) => {

    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error("Schedule not found");

    const scheduleData = scheduleSnap.data();
    const availableSlots =
      scheduleData.slots ?? scheduleData.maxPlayers ?? 0;

    if (availableSlots <= 0) throw new Error("Slot penuh");

    const sessionPrice = calculateSessionPrice(scheduleData);

    const safeRacketQty = Number(racketQty) || 0;
    const racketStock = scheduleData.racketStock ?? 0;

    if (safeRacketQty > racketStock) {
      throw new Error("Stok raket tidak cukup");
    }

    const racketUnitPrice = scheduleData.racketPrice || 0;
    const racketTotal = safeRacketQty * racketUnitPrice;
    const totalPayment = sessionPrice + racketTotal;

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < totalPayment) {
      throw new Error("Saldo tidak cukup");
    }

    // =========================
    // 🔥 MONTHLY LOGIC
    // =========================
    const currentMonth = new Date().toISOString().slice(0,7);

    let newMonthlyPayment = totalPayment;

    if(userData.monthlyKey === currentMonth){
      newMonthlyPayment =
        (userData.monthlyPayment || 0) + totalPayment;
    }

    // =========================
    // BOOKING CREATE
    // =========================
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      sessionPrice,
      price: totalPayment,
      racketQty: safeRacketQty,
      racketUnitPrice,
      racketTotal,
      attendance: false,
      completed: false,
      status: "active",
      createdAt: serverTimestamp()
    });

    transaction.update(scheduleRef, {
      slots: availableSlots - 1,
      racketStock: racketStock - safeRacketQty
    });

    const newBalance = currentBalance - totalPayment;

    // =========================
    // 🔥 USER UPDATE (UPDATED)
    // =========================
    transaction.update(userRef, {
      walletBalance: newBalance,

      totalPayment: (userData.totalPayment || 0) + totalPayment,

      monthlyPayment: newMonthlyPayment,
      monthlyKey: currentMonth
    });

    const mutationRef = doc(mutationsCol);

    transaction.set(mutationRef, {
      userId,
      asset: "RUPIAH",
      mutationType: "BOOKING_PAYMENT",
      amount: -totalPayment,
      balanceAfter: newBalance,
      referenceId: bookingRef.id,
      description: "Pembayaran Booking",
      createdAt: serverTimestamp(),
      createdBy: userId
    });

  });

  return { success: true };
}


/* =====================================================
   CANCEL BOOKING (UPDATED WITH MONTHLY PAYMENT)
===================================================== */
export async function cancelBooking({
  bookingId,
  pin
}) {

  if (!pin) {
    throw new Error("PIN transaksi diperlukan");
  }

  const bookingRef = doc(db, "bookings", bookingId);
  const mutationsCol = collection(db, "walletMutations");

  await runTransaction(db, async (transaction) => {

    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error("Booking tidak ditemukan");
    }

    const bookingData = bookingSnap.data();

    if (bookingData.status !== "active") {
      throw new Error("Booking sudah dibatalkan");
    }

    if (bookingData.attendance === true) {
      throw new Error("Tidak bisa cancel setelah check-in");
    }

    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const userRef = doc(db, "users", bookingData.userId);

    const scheduleSnap = await transaction.get(scheduleRef);
    const userSnap = await transaction.get(userRef);

    if (!scheduleSnap.exists()) throw new Error("Schedule tidak ditemukan");
    if (!userSnap.exists()) throw new Error("User tidak ditemukan");

    const scheduleData = scheduleSnap.data();
    const userData = userSnap.data();

    const sessionStart = new Date(
      scheduleData.date + "T" + scheduleData.startTime
    );

    const now = new Date();

    if (now >= sessionStart) {
      throw new Error("Sesi sudah dimulai atau selesai");
    }

    const pinCheck = await validateTransactionPin(
      bookingData.userId,
      pin
    );

    if (!pinCheck.valid) {
      throw new Error(pinCheck.reason);
    }

    const originalPrice = bookingData.price || 0;
    const racketQty = bookingData.racketQty || 0;

    const diffHours =
      (sessionStart - now) / (1000 * 60 * 60);

    let penaltyAmount = 0;

    if (diffHours > 48) penaltyAmount = originalPrice * 0.10;
    else if (diffHours > 36) penaltyAmount = originalPrice * 0.50;
    else penaltyAmount = originalPrice;

    penaltyAmount = Math.floor(penaltyAmount);

    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      penaltyAmount
    });

    transaction.update(scheduleRef, {
      slots: (scheduleData.slots ?? 0) + 1,
      racketStock: (scheduleData.racketStock ?? 0) + racketQty
    });

    const balanceBefore = userData.walletBalance || 0;
    const afterFullRefund = balanceBefore + originalPrice;
    const finalBalance = afterFullRefund - penaltyAmount;

    // =========================
    // 🔥 MONTHLY ADJUST
    // =========================
    const currentMonth = new Date().toISOString().slice(0,7);

    let newMonthlyPayment = userData.monthlyPayment || 0;

    if(userData.monthlyKey === currentMonth){
      newMonthlyPayment = newMonthlyPayment - originalPrice;
    }

    transaction.update(userRef, {
      walletBalance: finalBalance,

      totalPayment:
        (userData.totalPayment || 0) - originalPrice,

      monthlyPayment: newMonthlyPayment,
      monthlyKey: currentMonth
    });

    const refundRef = doc(mutationsCol);

    transaction.set(refundRef, {
      userId: bookingData.userId,
      asset: "RUPIAH",
      mutationType: "BOOKING_REFUND",
      amount: originalPrice,
      balanceAfter: afterFullRefund,
      referenceId: bookingId,
      description: "Refund Pembatalan Booking",
      createdAt: serverTimestamp(),
      createdBy: bookingData.userId,
      status: "success"
    });

    if (penaltyAmount > 0) {

      const penaltyRef = doc(mutationsCol);

      transaction.set(penaltyRef, {
        userId: bookingData.userId,
        asset: "RUPIAH",
        mutationType: "BOOKING_PENALTY",
        amount: -penaltyAmount,
        balanceAfter: finalBalance,
        referenceId: bookingId,
        description: "Denda Pembatalan Booking",
        createdAt: serverTimestamp(),
        createdBy: bookingData.userId,
        status: "success"
      });
    }

  });

  return { success: true };
}
