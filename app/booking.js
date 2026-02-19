import { createBooking } from "./services/bookingService.js";
import { auth } from "./firebase.js";

async function handleBooking(scheduleId){

  const user = auth.currentUser;
  if(!user) return;

  try {
    await createBooking({
      userId: user.uid,
      scheduleId
    });

    alert("Booking success");

  } catch(e){
    alert(e.message);
  }
}
