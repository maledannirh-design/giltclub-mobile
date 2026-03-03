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
   CREATE BOOKING (FINAL CLEAN LEDGER VERSION)
===================================================== */
export async function createBooking({
  userId,
  scheduleId,
  racketQty = 0,
  pin
}) {

  // AUTO REQUEST PIN JIKA BELUM ADA
  if (!pin) {
    if (typeof window.requestTransactionPin === "function") {
      pin = await window.requestTransactionPin();
    }
  }

  if (!pin) {
    throw new Error("PIN transaksi diperlukan");
  }

  // 1. VALIDATE PIN
  const pinCheck = await validateTransactionPin(userId, pin);
  if (!pinCheck.valid) {
    throw new Error(pinCheck.reason);
  }

  const scheduleRef = doc(db, "schedules", scheduleId);
  const userRef = doc(db, "users", userId);
  const bookingsCol = collection(db, "bookings");
  const mutationsCol = collection(db, "walletMutations");

  await runTransaction(db, async (transaction) => {

    // 2. GET SCHEDULE
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error("Schedule not found");

    const scheduleData = scheduleSnap.data();
    const availableSlots =
      scheduleData.slots ?? scheduleData.maxPlayers ?? 0;

    if (availableSlots <= 0) {
      throw new Error("Slot penuh");
    }

    // 3. HITUNG DURASI
    const sessionPrice = calculateSessionPrice(scheduleData);

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

    // =========================
    // PRIVACY LOGIC
    // =========================
    const realName =
      userData.usernameID ||
      userData.fullName ||
      userData.username ||
      "Member";

    const showName =
      userData.privacy?.showNameInBooking === true;

    const displayName = showName ? realName : "Member";
    const avatarInitial = showName
      ? realName.charAt(0).toUpperCase()
      : "M";

    const photoURL = showName
      ? userData.photoURL || null
      : null;

    const isAnonymous = !showName;

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

      displayName,
      avatarInitial,
      photoURL,
      isAnonymous,

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

    // 8. UPDATE SCHEDULE
    transaction.update(scheduleRef, {
      slots: availableSlots - 1,
      racketStock: racketStock - safeRacketQty
    });

    // 9. UPDATE USER BALANCE SNAPSHOT
    const newBalance = currentBalance - totalPayment;

    transaction.update(userRef, {
      walletBalance: newBalance,
      totalPayment: (userData.totalPayment || 0) + totalPayment
    });

    // 10. FINAL LEDGER (walletMutations ONLY)
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
   CANCEL BOOKING (FINAL TRANSPARENT VERSION)
   FULL REFUND + PENALTY DEBIT
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

    /* ===============================
       HITUNG PENALTY
    =============================== */

    const originalPrice = bookingData.price || 0;
    const racketQty = bookingData.racketQty || 0;

    const diffHours =
      (sessionStart - now) / (1000 * 60 * 60);

    let penaltyAmount = 0;

    if (diffHours > 48) penaltyAmount = originalPrice * 0.10;
    else if (diffHours > 36) penaltyAmount = originalPrice * 0.50;
    else penaltyAmount = originalPrice;

    penaltyAmount = Math.floor(penaltyAmount);

    /* ===============================
       UPDATE BOOKING
    =============================== */

    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      penaltyAmount
    });

    /* ===============================
       RESTORE SLOT & RACKET
    =============================== */

    transaction.update(scheduleRef, {
      slots: (scheduleData.slots ?? 0) + 1,
      racketStock: (scheduleData.racketStock ?? 0) + racketQty
    });

    /* ===============================
       UPDATE USER WALLET
    =============================== */

    const balanceBefore =
      userData.walletBalance || 0;

    // FULL REFUND
    const afterFullRefund =
      balanceBefore + originalPrice;

    // AFTER PENALTY
    const finalBalance =
      afterFullRefund - penaltyAmount;

    transaction.update(userRef, {
      walletBalance: finalBalance,
      totalPayment:
        (userData.totalPayment || 0) - originalPrice
    });

    /* ===============================
       LEDGER REFUND (FULL)
    =============================== */

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

    /* ===============================
       LEDGER PENALTY
    =============================== */

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
