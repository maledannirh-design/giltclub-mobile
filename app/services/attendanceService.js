import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================
   CHECK-IN ATTENDANCE (LEDGER CLEAN VERSION)
===================================================== */
export async function checkInAttendance({
  bookingId,
  scannedUid
}) {

  const bookingRef = doc(db, "bookings", bookingId);
  const walletLedgerCol = collection(db, "walletTransactions");
  const gPointLedgerCol = collection(db, "gPointLedger");

  let cashback = 0;
  let earnedGPoint = 0;
  let role = "MEMBER";
  let sessionDate = null;

  await runTransaction(db, async (transaction) => {

    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking tidak ditemukan");

    const bookingData = bookingSnap.data();

    if (bookingData.status !== "active") {
      throw new Error("Booking tidak aktif");
    }

    if (bookingData.attendedAt) {
      throw new Error("Sudah check-in");
    }

    if (bookingData.userId !== scannedUid) {
      throw new Error("QR tidak sesuai booking");
    }

    const scheduleRef = doc(db, "schedules", bookingData.scheduleId);
    const userRef = doc(db, "users", bookingData.userId);

    const scheduleSnap = await transaction.get(scheduleRef);
    const userSnap = await transaction.get(userRef);

    if (!scheduleSnap.exists()) throw new Error("Schedule tidak ditemukan");
    if (!userSnap.exists()) throw new Error("User tidak ditemukan");

    const scheduleData = scheduleSnap.data();
    const userData = userSnap.data();

    role = userData.role || "MEMBER";
    sessionDate = scheduleData.date;

    const now = new Date();

    const sessionStart = new Date(
      scheduleData.date + "T" + scheduleData.startTime
    );

    const sessionEnd = new Date(
      scheduleData.date + "T" + scheduleData.endTime
    );

    if (now < sessionStart) {
      throw new Error("Sesi belum dimulai");
    }

    if (now > sessionEnd) {
      throw new Error("Sesi sudah selesai");
    }

    const sessionPrice = bookingData.sessionPrice || 0;

    /* ===============================
       HITUNG GPOINT
    =============================== */

    const baseUnit = Math.floor(sessionPrice / 500);

    let multiplier = 1;

    if (role === "VVIP") multiplier = 2.5;
    else if (role === "VERIFIED") multiplier = 1.5;

    earnedGPoint = Math.floor(baseUnit * multiplier);

    /* ===============================
       HITUNG CASHBACK
    =============================== */

    if (role === "VVIP") {
      cashback = scheduleData.cashbackVVIP || 0;
    } else if (role === "VERIFIED") {
      cashback = scheduleData.cashbackVerified || 0;
    } else {
      cashback = scheduleData.cashbackMember || 0;
    }

    const maxCashback = Math.floor(sessionPrice * 0.75);
    if (cashback > maxCashback) cashback = maxCashback;

    /* ===============================
       UPDATE BOOKING
    =============================== */

    transaction.update(bookingRef, {
      attendance: true,
      attendanceNotified: false,
      completed: true,
      attendedAt: serverTimestamp(),
      rewardCashback: cashback,
      rewardGPoint: earnedGPoint,
      rewardRole: userData.role || "MEMBER",
      rewardSessionDate: scheduleData.date
    });

    /* ===============================
       UPDATE USER
    =============================== */

    const balanceBefore = userData.walletBalance || 0;
    const newBalance = balanceBefore + cashback;

    const nowDate = new Date();
    const monthKey =
      nowDate.getFullYear() +
      "-" +
      String(nowDate.getMonth() + 1).padStart(2, "0");

    const monthAttendance = userData.monthAttendance || {};
    const currentMonthCount = monthAttendance[monthKey] || 0;

    transaction.update(userRef, {
      walletBalance: newBalance,
      gPoint: (userData.gPoint || 0) + earnedGPoint,
      totalAttendance: (userData.totalAttendance || 0) + 1,
      ["monthAttendance." + monthKey]: currentMonthCount + 1
    });

    /* ===============================
       LEDGER CASHBACK (RUPIAH)
    =============================== */

    if (cashback > 0) {

      const ledgerRef = doc(walletLedgerCol);

      transaction.set(ledgerRef, {
        userId: bookingData.userId,
        usernameSnapshot: userData.username || "",
        fullNameSnapshot: userData.fullName || "",

        entryType: "CREDIT",
        referenceType: "SESSION_CASHBACK",
        referenceId: bookingId,

        amount: cashback,
        balanceBefore,
        balanceAfter: newBalance,

        createdAt: serverTimestamp()
      });
    }

    /* ===============================
       LEDGER GPOINT (TERPISAH)
    =============================== */

    if (earnedGPoint > 0) {

      const gLedgerRef = doc(gPointLedgerCol);

      transaction.set(gLedgerRef, {
        userId: bookingData.userId,
        entryType: "CREDIT",
        referenceType: "SESSION_GPOINT",
        referenceId: bookingId,
        amount: earnedGPoint,
        createdAt: serverTimestamp()
      });
    }

  });

  return {
    success: true,
    cashback,
    earnedGPoint,
    role,
    sessionDate
  };
}
