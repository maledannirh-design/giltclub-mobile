import { db, auth } from "./firebase.js";
import { collection, query, where, getDocs, onSnapshot } from "./firestore.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";
import { showToast, showConfirm } from "./ui.js";



/* ===============================
   REALTIME LISTENER CONTROL
================================= */
let unsubscribeSchedules = null;
let bookingLock = false;


/* ===============================
   RENDER BOOKING PAGE
================================= */
export async function renderBooking(){

  const content = document.getElementById("content");
  if (!content) return;

  // Stop previous listener if exists
  if (unsubscribeSchedules) {
    unsubscribeSchedules();
    unsubscribeSchedules = null;
  }

  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading...
    </div>
  `;

  try {

    const user = auth.currentUser;

    unsubscribeSchedules = query(collection(db,"schedules"), where("status","==","open")),
      async (snapshot) => {

        const schedules = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const userBookings = user
          ? await loadUserBookings(user.uid)
          : [];

        renderScheduleUI(schedules, userBookings);
      }
    );

  } catch (error) {

    console.error(error);
    content.innerHTML = "<p>Error loading schedules.</p>";

  }
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
   RENDER UI
================================= */
function renderScheduleUI(schedules, userBookings){

  const content = document.getElementById("content");
  if (!content) return;

  const bookingMap = {};
  userBookings.forEach(b => {
    bookingMap[b.scheduleId] = b;
  });

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

    if (!auth.currentUser) {

      html += `<div style="opacity:.6;">Login to join</div>`;

    } else if (existingBooking) {

      html += `
        <button class="btn btn-danger cancel-btn" data-id="${existingBooking.id}">
  Batalkan
</button>
      `;

    } else {

      html += `
        <button class="btn btn-primary book-btn" data-id="${schedule.id}">
  Gabung
</button>
      `;
    }

    html += `</div>`;
  });

  content.innerHTML = `
  <div class="page-fade">
    ${html}
  </div>
`;


  // Single event delegation
  content.onclick = async (e) => {

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

  };
}


/* ===============================
   HANDLE BOOKING
================================= */
async function handleBookingClick(scheduleId){

  if (bookingLock) return;

  const user = auth.currentUser;
  if (!user){
    showToast("Please login first.", "warning");
    return;
  }

  bookingLock = true;

  const button = document.querySelector(`.book-btn[data-id="${scheduleId}"]`);
  if (button){
    button.disabled = true;
    button.innerText = "Processing...";
  }

  try {

    await createBooking({
      userId: user.uid,
      scheduleId
    });

    showToast("Booking successful!", "success");

  } catch (error) {

    showToast(error.message, "error");

  } finally {

    bookingLock = false;
  }
}



/* ===============================
   HANDLE CANCEL
================================= */
async function handleCancelClick(bookingId){

  if (bookingLock) return;

  const confirmed = await showConfirm("Are you sure you want to cancel?");
  if (!confirmed) return;

  bookingLock = true;

  const button = document.querySelector(`.cancel-btn[data-id="${bookingId}"]`);
  if (button){
    button.disabled = true;
    button.innerText = "Processing...";
  }

  try {

    await cancelBooking({ bookingId });

    showToast("Booking cancelled!", "success");

  } catch (error) {

    showToast(error.message, "error");

  } finally {

    bookingLock = false;
  }
}

