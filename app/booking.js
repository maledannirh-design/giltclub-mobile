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
let currentMonth = new Date();
let slideDirection = "next";

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

  content.innerHTML = `
    ${renderMyUpcomingHero()}
    ${renderCalendarMonth()}
    ${renderCreateSessionCard()}
    <div id="popupContainer"></div>
  `;

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
function renderCalendarMonth() {

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const totalDays = lastDay.getDate();

  const monthName = currentMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric"
  });

  let html = `
    <div class="month-wrapper slide-${slideDirection}">
      <div class="month-header-row">
        <button id="prevMonth">‹</button>
        <div class="month-header">${monthName}</div>
        <button id="nextMonth">›</button>
      </div>

      <div class="week-labels">
        <div>Sen</div>
        <div>Sel</div>
        <div>Rab</div>
        <div>Kam</div>
        <div>Jum</div>
        <div class="weekend">Sab</div>
        <div class="weekend">Min</div>
      </div>

      <div class="month-grid">
  `;

  for (let i = 0; i < startDay; i++) {
    html += `<div class="month-day empty"></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {

    const dateObj = new Date(year, month, d);
    const dateStr = formatDate(dateObj);

    const sessions = allSchedules.filter(s => s.date === dateStr);

    const hasAdmin = sessions.some(s => s.role === "admin" || s.role === "supercoach");
    const hasMember = sessions.some(s => s.role === "MEMBER");

    let ringClass = "";
    if (hasAdmin && hasMember) ringClass = "ring-double";
    else if (hasAdmin) ringClass = "ring-admin";
    else if (hasMember) ringClass = "ring-member";

    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    html += `
      <div class="month-day ${ringClass} ${isWeekend ? "weekend":""}"
           data-date="${dateStr}">
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* ===============================
 POP UP THE DAY
================================= */
function openSessionPopup(dateStr) {

  const popup = document.getElementById("popupContainer");

  const sessions = allSchedules
    .filter(s => s.date === dateStr)
    .sort((a,b)=> (a.startTime||"").localeCompare(b.startTime||""));

  let html = `
    <div class="popup-overlay">
      <div class="popup-card premium-popup">
        <h3>${formatDisplayDate(dateStr)}</h3>
  `;

  if (!sessions.length) {

    html += `<div class="empty-session">Tidak ada sesi pada hari ini</div>`;

  } else {

    sessions.forEach(s=>{

      html += `
        <div class="popup-session-card">

          <div><strong>Sesi:</strong> ${s.level}</div>
          <div><strong>Jam Mulai:</strong> ${s.startTime}</div>
          <div><strong>Jam Selesai:</strong> ${s.endTime}</div>
          <div><strong>Lapangan:</strong> ${s.court || "-"}</div>

          <div><strong>Coach:</strong> ${
            (s.role === "coach" || s.role === "supercoach")
              ? s.hostName
              : "Tidak ada"
          }</div>

          <div><strong>Rate / Jam:</strong> Rp ${s.price}</div>
          <div><strong>Raket Sewaan:</strong> ${s.racketStock || 0}</div>
          <div><strong>Sewa Raket / Sesi:</strong> Rp ${s.racketPrice || 0}</div>

          <div class="popup-note">
            <strong>Catatan:</strong><br>
            ${s.notes || "-"}
          </div>

        </div>
      `;
    });
  }

  html += `
        <button id="closePopup" class="close-popup-btn">Tutup</button>
      </div>
    </div>
  `;

  popup.innerHTML = html;
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
   EVENTS CONTENT
================================= */
function attachGlobalEvents(){

  const content = document.getElementById("content");

  content.onclick = async (e) => {
   const monthDay = e.target.closest(".month-day");
if (monthDay && !monthDay.classList.contains("empty")) {
  openSessionPopup(monthDay.dataset.date);
}

if (e.target.id === "closePopup") {
  document.getElementById("popupContainer").innerHTML = "";
}
    if (e.target.id === "prevMonth") {
  slideDirection = "prev";
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderFullUI();
}

if (e.target.id === "nextMonth") {
  slideDirection = "next";
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderFullUI();
}
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
  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
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
