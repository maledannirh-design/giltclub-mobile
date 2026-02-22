import { db, auth } from "./firebase.js";
import { collection, query, where, getDocs, onSnapshot } from "./firestore.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";
import { showToast, showConfirm } from "./ui.js";

/* ===============================
   STATE
================================= */
let unsubscribeSchedules = null;
let bookingLock = false;
let currentWeekStart = startOfWeek(new Date());
let selectedDate = formatDate(new Date());
let allSchedules = [];
let userBookings = [];

/* ===============================
   ENTRY
================================= */
export async function renderBooking() {

  const content = document.getElementById("content");
  if (!content) return;

  if (unsubscribeSchedules) {
    unsubscribeSchedules();
    unsubscribeSchedules = null;
  }

  content.innerHTML = `<div style="padding:20px;text-align:center;opacity:.6;">Loading...</div>`;

  try {

    unsubscribeSchedules = onSnapshot(
      query(collection(db, "schedules"), where("status", "==", "open")),
      async (snapshot) => {

        allSchedules = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (auth.currentUser) {
          userBookings = await loadUserBookings(auth.currentUser.uid);
        } else {
          userBookings = [];
        }

        renderFullUI();
      }
    );

  } catch (err) {
    console.error(err);
    content.innerHTML = "Error loading booking page.";
  }
}

/* ===============================
   MAIN RENDER
================================= */
function renderFullUI() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
  ${renderMyUpcomingHero()}
  ${renderUpcoming()}
  ${renderCalendar()}
  <div id="sessionContainer"></div>
  ${renderCreateSessionCard()}
`;

  renderSessionsByDate(selectedDate);
  attachGlobalEvents();
}

/* ===============================
   UPCOMING EMERALD GLASS
================================= */
function renderUpcoming() {

  const upcoming = [...allSchedules]
    .filter(s => new Date(s.date) >= new Date())
    .sort((a,b)=> new Date(a.date) - new Date(b.date))
    .slice(0,6);

  let html = `
  <div class="upcoming-wrapper">
    <div class="upcoming-scroll">
  `;

  upcoming.forEach(s => {
    html += `
      <div class="upcoming-card ${isDominant(s) ? "dominant":""}">
        <div>${s.level || "Session"}</div>
        <div>${formatDisplayDate(s.date)}</div>
        <div>${s.startTime || ""} - ${s.endTime || ""}</div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/* ===============================
   CALENDAR
================================= */
function renderCalendar() {

  const todayStr = formatDate(new Date());
  if (!selectedDate) selectedDate = todayStr;

  const days = getWeekDays(currentWeekStart);

  let html = `
  <div class="calendar-wrapper">
    <div class="calendar-header">
      <button id="prevWeek" class="nav-btn">←</button>
      <div class="month-title">${formatMonth(currentWeekStart)}</div>
      <button id="nextWeek" class="nav-btn">→</button>
    </div>

    <div class="calendar-scroll">
  `;

  days.forEach(d => {
    const dateStr = formatDate(d);
    const isActive = dateStr === selectedDate;
    const isToday = dateStr === todayStr;

    html += `
      <div class="calendar-day ${isActive ? "active" : ""}" 
           data-date="${dateStr}">
        <div class="day-name">
          ${d.toLocaleDateString("en-US",{weekday:"short"})}
        </div>
        <div class="day-number">
          ${d.getDate()}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/* ===============================
   SESSIONS BY DATE
================================= */
function renderSessionsByDate(dateStr) {

  const container = document.getElementById("sessionContainer");
  if (!container) return;

  const sessions = allSchedules
    .filter(s => s.date === dateStr)
    .sort((a,b)=> (a.startTime||"").localeCompare(b.startTime||""));

  const dominant = sessions.filter(s => isDominant(s));
  const normal = sessions.filter(s => !isDominant(s));

  let html = "";

  if (dominant.length) {
    html += `<h3 style="padding:16px;">Club Sessions</h3>`;
    dominant.forEach(s => html += renderSessionCard(s,true));
  }

  if (normal.length) {
    html += `<h3 style="padding:16px;">Member Sessions</h3>`;
    normal.forEach(s => html += renderSessionCard(s,false));
  }

  if (!sessions.length) {
    html = `<div style="padding:20px;opacity:.6;">No session this day</div>`;
  }

  container.innerHTML = html;
}

/* ===============================
   SESSION CARD
================================= */
function renderSessionCard(s, dominant=false) {

  const existingBooking = userBookings.find(b => b.scheduleId === s.id);

  return `
    <div class="session-card ${dominant ? "dominant":""}">
      <div class="session-header">
        <div>${s.level || "Session"}</div>
        <div>${s.startTime || ""} - ${s.endTime || ""}</div>
      </div>
      <div>
        Court: ${s.court || "Tentative"}<br/>
        Rate: ${s.price || 0}<br/>
        Max Slot: ${s.maxSlot || 0}<br/>
        Sisa Slot: ${s.slots || 0}
      </div>
      <div style="margin-top:12px;">
        ${
          !auth.currentUser
          ? `<div style="opacity:.5;">Login to join</div>`
          : existingBooking
            ? `<button class="cancel-btn" data-id="${existingBooking.id}">Cancel</button>`
            : `<button class="book-btn" data-id="${s.id}">Join</button>`
        }
      </div>
    </div>
  `;
}

/* ===============================
   CREATE SESSION UI
================================= */
function renderCreateSessionCard(){
  return `
    <div class="create-session-card" id="openHostForm">
      Buat Sesi Mabar
    </div>
  `;
}

/* ===============================
   HOST FORM PAGE
================================= */
function renderHostForm(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <div style="padding:20px;">
      <h2>Create Session</h2>
      <input placeholder="Tanggal"/>
      <input placeholder="Lapangan"/>
      <input placeholder="Rate"/>
      <input placeholder="Max Player"/>
      <textarea placeholder="Catatan"></textarea>
      <button id="backBooking">Back</button>
    </div>
  `;
}

/* ===============================
   EVENTS
================================= */
function attachGlobalEvents(){

  const content = document.getElementById("content");

  content.onclick = async (e) => {

    if (e.target.id === "prevWeek"){
      currentWeekStart.setDate(currentWeekStart.getDate()-7);
      renderFullUI();
    }

    if (e.target.id === "nextWeek"){
      currentWeekStart.setDate(currentWeekStart.getDate()+7);
      renderFullUI();
    }

    const dayCard = e.target.closest(".day-card");
    if (dayCard){
      selectedDate = dayCard.dataset.date;
      renderFullUI();
    }

    const bookBtn = e.target.closest(".book-btn");
    if (bookBtn) await handleBookingClick(bookBtn.dataset.id);

    const cancelBtn = e.target.closest(".cancel-btn");
    if (cancelBtn) await handleCancelClick(cancelBtn.dataset.id);

    if (e.target.id === "openHostForm"){
      renderHostForm();
    }

    if (e.target.id === "backBooking"){
      renderFullUI();
    }

  };
}

/* ===============================
   BOOKING ENGINE
================================= */
async function handleBookingClick(scheduleId){

  if (bookingLock) return;
  if (!auth.currentUser){
    showToast("Login first","warning");
    return;
  }

  bookingLock = true;

  try {
    await createBooking({
      userId: auth.currentUser.uid,
      scheduleId
    });
    showToast("Booking success","success");
  } catch(err){
    showToast(err.message,"error");
  } finally {
    bookingLock = false;
  }
}

async function handleCancelClick(bookingId){

  if (bookingLock) return;

  const ok = await showConfirm("Cancel this session?");
  if (!ok) return;

  bookingLock = true;

  try {
    await cancelBooking({ bookingId });
    showToast("Cancelled","success");
  } catch(err){
    showToast(err.message,"error");
  } finally {
    bookingLock = false;
  }
}

/* ===============================
   UTILITIES
================================= */
async function loadUserBookings(userId){
  const q = query(
    collection(db,"bookings"),
    where("userId","==",userId),
    where("status","==","active")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

function isDominant(s){
  return s.role === "admin" || s.role === "supercoach";
}

function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6:1);
  return new Date(d.setDate(diff));
}

function getWeekDays(start){
  return [...Array(7)].map((_,i)=>{
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    return d;
  });
}

function formatDate(d){
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(d){
  return new Date(d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
}

function formatMonth(d){
  return d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
}

function renderMyUpcomingHero(){

  return `
    <div class="my-upcoming-wrapper">
      <div class="my-upcoming-glass">
        <div class="my-upcoming-title">
          Jadwal Main Saya Terdekat
        </div>

        <div class="my-upcoming-scroll">
          <!-- nanti isi dynamic session card -->
          <div class="mini-session-card">
            <div>Intermediate</div>
            <div>Sat • 08:00 - 10:00</div>
          </div>

          <div class="mini-session-card">
            <div>Beginner</div>
            <div>Sun • 15:00 - 17:00</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
