import { createBooking } from "./services/bookingService.js";
import { auth } from "./firebase.js";

let bookingLock = false;
let scheduleCache = null;
let scheduleCacheTime = 0;
const SCHEDULE_TTL = 60000; // 1 menit


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
import { cancelBooking } from "./services/bookingService.js";

async function handleCancel(bookingId){

  try {
    await cancelBooking({ bookingId });
    alert("Booking cancelled");
  } catch(e){
    alert(e.message);
  }
}
