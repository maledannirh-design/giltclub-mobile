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
