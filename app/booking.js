import { db, auth } from "./firebase.js";
import { collection, getDocs } from "./firestore.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";

/* ===============================
   SCHEDULE CACHE
================================= */
let scheduleCache = null;
let scheduleCacheTime = 0;
const SCHEDULE_TTL = 60000; // 1 menit


/* ===============================
   RENDER BOOKING PAGE
================================= */
export async function renderBooking(){

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading schedules...
    </div>
  `;

  try {

    const schedules = await loadSchedules();

    if (!schedules.length){
      content.innerHTML = "<p>No schedules available.</p>";
      return;
    }

    let html = `<h2>Book Session</h2>`;

    schedules.forEach(schedule => {

      html += `
        <div class="schedule-card">
          <div><strong>${schedule.title || "Session"}</strong></div>
          <div>Date: ${schedule.date}</div>
          <div>Slots: ${schedule.slots}</div>
          <div>Price: ${schedule.price || 0}</div>
          <button onclick="handleBookingClick('${schedule.id}')">
            Book
          </button>
        </div>
      `;
    });

    content.innerHTML = html;

  } catch (error) {

    console.error(error);
    content.innerHTML = "<p>Error loading schedules.</p>";

  }
}


/* ===============================
   LOAD SCHEDULES WITH CACHE
================================= */
async function loadSchedules(){

  const now = Date.now();

  if (scheduleCache && (now - scheduleCacheTime) < SCHEDULE_TTL){
    return scheduleCache;
  }

  const snap = await getDocs(collection(db, "schedules"));

  const schedules = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  scheduleCache = schedules;
  scheduleCacheTime = now;

  return schedules;
}


/* ===============================
   HANDLE BOOKING
================================= */
let bookingLock = false;

export async function handleBookingClick(scheduleId){

  if (bookingLock) return;

  const user = auth.currentUser;
  if (!user){
    alert("Please login first.");
    return;
  }

  bookingLock = true;

  try {

    await createBooking({
      userId: user.uid,
      scheduleId
    });

    // invalidate cache
    scheduleCache = null;

    alert("Booking successful!");

    renderBooking();

  } catch (error) {

    alert(error.message);

  } finally {

    bookingLock = false;

  }
}


/* ===============================
   HANDLE CANCEL
================================= */
export async function handleCancelClick(bookingId){

  if (bookingLock) return;

  bookingLock = true;

  try {

    await cancelBooking({ bookingId });

    scheduleCache = null;

    alert("Booking cancelled!");

    renderBooking();

  } catch (error) {

    alert(error.message);

  } finally {

    bookingLock = false;

  }
}


window.handleBookingClick = handleBookingClick;
window.handleCancelClick = handleCancelClick;
