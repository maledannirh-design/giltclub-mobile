import { db } from "../firebase.js";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from "../firestore.js";

export async function createBooking({ userId, scheduleId }){

  const scheduleRef = doc(db, "schedules", scheduleId);
  const bookingRef = doc(collection(db, "bookings"));

  await runTransaction(db, async (transaction) => {

    const scheduleSnap = await transaction.get(scheduleRef);

    if (!scheduleSnap.exists()){
      throw new Error("Schedule not found");
    }

    const scheduleData = scheduleSnap.data();

    if ((scheduleData.slots || 0) <= 0){
      throw new Error("Slot full");
    }

    // reduce slot atomically
    transaction.update(scheduleRef, {
      slots: scheduleData.slots - 1
    });

    // create booking
    transaction.set(bookingRef, {
      userId,
      scheduleId,
      createdAt: serverTimestamp(),
      status: "active"
    });

  });

  return { success: true };
}
