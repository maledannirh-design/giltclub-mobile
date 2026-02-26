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
   CREATE BOOKING (WITH RACKET SUPPORT) + SUPPORT ANONYM
===================================================== */
export async function createBooking({ userId, scheduleId, racketQty = 0 }) {

  const scheduleRef = doc(db, "schedules", scheduleId);
  const userRef = doc(db, "users", userId);
  const bookingsCol = collection(db, "bookings");
  const ledgerCol = collection(db, "walletTransactions");

  await runTransaction(db, async (transaction) => {

    // 1. GET SCHEDULE
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error("Schedule not found");

    const scheduleData = scheduleSnap.data();

    const availableSlots = scheduleData.slots ?? scheduleData.maxPlayers ?? 0;
    if (availableSlots <= 0) throw new Error("Slot penuh");

    const availableRacket = scheduleData.racketStock || 0;
    if (racketQty > availableRacket) {
      throw new Error("Stok raket tidak cukup");
    }

    // 2. HITUNG HARGA
    const sessionPrice = calculateSessionPrice(scheduleData);
    const racketPrice = scheduleData.racketPrice || 0;
    const racketTotal = racketQty * racketPrice;
    const totalPrice = sessionPrice + racketTotal;

    // 3. GET USER
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const currentBalance = userData.walletBalance || 0;

    if (currentBalance < totalPrice) {
      throw new Error("Saldo tidak cukup");
    }

    // 4. DUPLICATE GUARD
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

    // 5. PRIVACY
    const showName =
      userData.privacy &&
      userData.privacy.showNameInBooking === true;

    let publicName = "Member";

    if (typeof userData.username === "string" && userData.username.trim() !== "") {
      publicName = userData.username.trim();
    }

    const displayName = showName ? publicName : "Anonymous";
    const avatarInitial = showName
      ? publicName.charAt(0).toUpperCase()
      : "A";

    // 6. CREATE BOOKING
    const bookingRef = doc(bookingsCol);

    transaction.set(bookingRef, {
      userId,
      scheduleId,
      price: totalPrice,
      sessionPrice,
      racketQty,
      racketTotal,
      displayName,
      avatarInitial,
      isAnonymous: !showName,
      attendance: false,
      status: "active",
      createdAt: serverTimestamp()
    });

    // 7. UPDATE SLOT DAN RAKET
    transaction.update(scheduleRef, {
      slots: availableSlots - 1,
      racketStock: availableRacket - racketQty
    });

    // 8. DEDUCT WALLET
    const newBalance = currentBalance - totalPrice;

    transaction.update(userRef, {
      walletBalance: newBalance
    });

    // 9. LEDGER ENTRY
    const ledgerRef = doc(ledgerCol);

    transaction.set(ledgerRef, {
      userId,
      type: "booking_debit",
      amount: -totalPrice,
      balanceAfter: newBalance,
      referenceId: bookingRef.id,
      createdAt: serverTimestamp()
    });

  });

  return { success: true };
}

/* =====================================================
   CANCEL BOOKING (FINAL VERSION - WITH RACKET & GUARD)
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

    // Block jika sudah check-in
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
    if (scheduleData.date && scheduleData.endTime) {
      const sessionEnd = new Date(
        scheduleData.date + "T" + scheduleData.endTime
      );
      const now = new Date();
      if (now > sessionEnd) {
        throw new Error("Sesi sudah selesai");
      }
    }

    const price = bookingData.price || 0;
    const racketQty = bookingData.racketQty || 0;

    // 1. Update booking
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp()
    });

    // 2. Restore slot dan raket
    const currentSlots = scheduleData.slots ?? 0;
    const currentRacketStock = scheduleData.racketStock ?? 0;

    transaction.update(scheduleRef, {
      slots: currentSlots + 1,
      racketStock: currentRacketStock + racketQty
    });

    // 3. Refund wallet
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
