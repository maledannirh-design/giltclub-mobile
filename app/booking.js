import { createBooking } from "./services/bookingService.js";
import { auth } from "./firebase.js";

let bookingLock = false;

export async function handleBooking(scheduleId){

  if (bookingLock) return;

  const user = auth.currentUser;
  if (!user) return;

  bookingLock = true;

  try {

    await createBooking({
      userId: user.uid,
      scheduleId
    });

    alert("Booking success");

  } catch(e){

    alert(e.message);

  } finally {

    bookingLock = false;

  }
}
