import { db } from "../firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  increment,
  serverTimestamp
} from "../firestore.js";

export async function createBooking({ userId, scheduleId }){

  const scheduleRef = doc(db, "schedules", scheduleId);
  const scheduleSnap = await getDoc(scheduleRef);

  if (!scheduleSnap.exists()){
    throw new Error("Schedule not found");
  }

  const scheduleData = scheduleSnap.data();

  if ((scheduleData.slots || 0) <= 0){
    throw new Error("Slot full");
  }

  // Reduce slot safely
  await updateDoc(scheduleRef, {
    slots: increment(-1)
  });

  // Create booking record
  const bookingRef = doc(
    collection(db, "bookings")
  );

  await setDoc(bookingRef, {
    userId,
    scheduleId,
    createdAt: serverTimestamp(),
    status: "active"
  });

  return { success: true };
}
