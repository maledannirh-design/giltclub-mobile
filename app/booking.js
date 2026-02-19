import { db, auth } from "./firebase.js";
import { collection, getDocs, query, where } from "./firestore.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";

/* ===============================
   CACHE
================================= */
let scheduleCache = null;
let scheduleCacheTime = 0;
const SCHEDULE_TTL = 60000;

let bookingLock = false;


/* ===============================
   RENDER BOOKING PAGE
================================= */
export async function renderBooking(){

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading...
    </div>
  `;

  try {

    const user = auth.currentUser;
    const schedules = await loadSchedules();
    const userBookings = user ? await loadUserBookings(user.uid) : [];

    const bookingMap = {};
    userBookings.forEach(b => {
      bookingMap[b.scheduleId] = b;
    });

    if (!schedules.length){
      content.innerHTML = "<p>No schedules available.</p>";
      return;
    }

    let html = `<h2>Book Session</h2>`;

    schedules.forEach(schedule => {

      const existingBooking = bookingMap[schedule.id];

      html += `
        <div class="schedule-card">
          <div><strong>${schedule.title || "Session"}</strong></div>
          <div>Date: ${schedule.date}</div>
          <div>Slots: ${schedule.slots}</div>
          <div>Price: ${schedule.price || 0}</div>
      `;

      if (!user) {

        html += `<div style="opacity:.6;">Login to join</div>`;

      } else if (existingBooking) {

        html += `
          <button class="cancel-btn" data-id="${existingBooking.id}">
            Batalkan
          </button>
        `;

      } else {

        html += `
          <button class="book-btn" data-id="${schedule.id}">
            Gabung
          </button>
        `;
      }

      html += `</div>`;
    });

    content.innerHTML = html;

    // EVENT DELEGATION
    content.addEventListener("click", async (e) => {

      const bookBtn = e.target.closest(".book-btn");
      if (bookBtn) {
        await handleBookingClick(bookBtn.dataset.id);
        return;
      }

      const cancelBtn = e.target.closest(".cancel-btn");
      if (cancelBtn) {
        await handleCancelClick(cancelBtn.dataset.id);
        return;
      }

    });

  } catch (error) {

    console.error(error);
    content.innerHTML = "<p>Error loading schedules.</p>";

  }
}


/* ===============================
   LOAD SCHEDULES (CACHE)
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
   LOAD USER BOOKINGS
================================= */
async function loadUserBookings(userId){

  const q = query(
    collection(db, "bookings"),
    where("userId", "==", userId),
    where("status", "==", "active")
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}


/* ===============================
   HANDLE BOOKING
================================= */
async function handleBookingClick(scheduleId){

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
async function handleCancelClick(bookingId){

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
