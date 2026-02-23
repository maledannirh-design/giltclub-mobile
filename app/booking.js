import { db, auth } from "./firebase.js";
import { collection, query, where, getDocs, onSnapshot } from "./firestore.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";
import { showToast, showConfirm } from "./ui.js";

/* ===============================
   STATE
================================= */
let unsubscribeSchedules = null;
let bookingLock = false;
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
   UPCOMING HERO
================================= */
function renderMyUpcomingHero(){
  return `
    <div class="my-upcoming-wrapper">
      <div class="my-upcoming-glass">
        <div class="my-upcoming-title">
          Jadwal Main Saya Terdekat
        </div>
        <div class="my-upcoming-scroll"></div>
      </div>
    </div>
  `;
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
   POPUP
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
          <div><strong>Jam:</strong> ${s.startTime} - ${s.endTime}</div>
          <div><strong>Lapangan:</strong> ${s.court || "-"}</div>
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
   CREATE SESSION CARD
================================= */
function renderCreateSessionCard(){
  return `
    <div class="create-session-card" id="openCreateSession">
      Buat Sesi
    </div>
    <div id="createSessionSheet"></div>
  `;
}

/* ===============================
   CREATE SESSION SHEET
================================= */
export function openCreateSessionSheet(){

  // reset state global
  window.selectedCoaches = [];
  window.selectedCoachRates = [];

  const sheet = document.getElementById("createSessionSheet");
  if(!sheet) return;

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div class="sheet-overlay" id="createSessionOverlay"></div>

    <div class="premium-sheet">

      <div class="sheet-handle"></div>
      <h2>Buat Sesi</h2>

      <!-- ROW 1 -->
      <div class="sheet-section">
        <label>Tier Sesi</label>
        <select id="tier">
          <option>Newbie</option>
          <option>Beginner</option>
          <option>Upper Beginner</option>
          <option>Intermediate</option>
        </select>
      </div>

      <!-- ROW 2 -->
      <div class="sheet-section">
        <label>Jenis Sesi</label>
        <select id="sessionType">
          <option value="Mabar">Mabar</option>
          <option value="Drill">Drill</option>
          <option value="Drill + Mabar">Drill + Mabar</option>
        </select>
      </div>

      <!-- ROW 3 -->
      <div class="sheet-section">
        <label>Tipe Sesi</label>
        <select id="sessionMode">
          <option value="reguler">Reguler</option>
          <option value="semi-private">Semi Private</option>
          <option value="private">Private</option>
        </select>
      </div>

      <!-- ROW 4 -->
      <div class="sheet-section">
        <label>Maksimal Pemain</label>
        <input type="number" id="maxPlayers" placeholder="Jumlah pemain">
      </div>

      <!-- ROW 5 -->
      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="sessionDate">
      </div>

      <!-- ROW 6 -->
      <div class="sheet-section">
        <div class="time-row">
          <div>
            <label>Jam Mulai</label>
            <input type="time" id="startTime">
          </div>
          <div>
            <label>Jam Selesai</label>
            <input type="time" id="endTime">
          </div>
        </div>
      </div>

      <!-- ROW 7 -->
      <div class="sheet-section">
        <label>Lapangan</label>
        <input type="text" id="court" placeholder="Nama lapangan">
      </div>

      <!-- ROW 8 -->
      <div class="sheet-section">
        <label>Pilih Coach (maksimal 2)</label>
        <div id="coachSelector"></div>
      </div>

      <!-- ROW 9 -->
      <div class="sheet-section">
        <label>Rate Coach / Jam</label>
        <div id="coachRateDisplay">-</div>
      </div>

      <!-- ROW 10 -->
      <div class="sheet-section">
        <label>Status Coach</label>
        <div id="coachStatusDisplay">none</div>
      </div>

      <!-- ROW 11 -->
      <div class="sheet-section">
        <label>Rate / Jam (Pemain)</label>
        <input type="number" id="ratePerHour" step="5000">
        <div id="rateWarning" class="rate-warning"></div>
      </div>

      <!-- ROW 12 -->
      <div class="sheet-section">
        <label>Raket Sewaan</label>
        <input type="number" id="racketStock">
      </div>

      <!-- ROW 13 -->
      <div class="sheet-section">
        <label>Rate Raket / Sesi</label>
        <input type="number" id="racketRate" step="5000">
      </div>

      <!-- ROW 14 -->
      <div class="sheet-section">
        <label>Catatan</label>
        <textarea id="notes" rows="3" placeholder="Tulis catatan sesi"></textarea>
      </div>

      <button class="btn-create-session" id="submitCreateSession">
        Buat Sesi
      </button>

    </div>
  `;

  document.getElementById("createSessionOverlay").onclick = closeCreateSessionSheet;

  setupSessionModeLogic();
  setupCreateSessionSubmit();
}

function closeCreateSessionSheet(){

  const sheet = document.getElementById("createSessionSheet");
  if(!sheet) return;

  sheet.classList.remove("active");
  sheet.innerHTML = "";

  document.body.classList.remove("no-scroll");
}
/* ===============================
   EVENTS
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

    if (e.target.id === "openCreateSession"){
      openCreateSessionSheet();
    }
   
     if (e.target.id === "createSessionOverlay") {
     closeCreateSessionSheet();
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
    await createBooking({ userId: auth.currentUser.uid, scheduleId });
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

function setupSessionModeLogic(){

  const mode = document.getElementById("sessionMode");

  if(!mode) return;

  mode.addEventListener("change", ()=>{
    // Tidak ada auto isi
    // Tidak ada disable
    // Hanya UI react jika nanti mau tambahkan warning
  });

}
async function setupCreateSessionSubmit(){

  const btn = document.getElementById("submitCreateSession");
  if(!btn) return;

  btn.onclick = async ()=>{

    try{

      const tier        = document.getElementById("tier").value;
      const sessionType = document.getElementById("sessionType").value;
      const mode        = document.getElementById("sessionMode").value;

      const date        = document.getElementById("sessionDate").value;
      const startTime   = document.getElementById("startTime").value;
      const endTime     = document.getElementById("endTime").value;

      const maxPlayers  = Number(document.getElementById("maxPlayers").value);
      const court       = document.getElementById("court").value.trim();

      const ratePerHour = Number(document.getElementById("ratePerHour").value);
      const racketStock = Number(document.getElementById("racketStock").value);
      const racketRate  = Number(document.getElementById("racketRate").value);

      const notes       = document.getElementById("notes").value.trim();

      if(!date || !startTime || !endTime){
        showToast("Lengkapi tanggal dan jam","error");
        return;
      }

      if(endTime <= startTime){
        showToast("Jam selesai harus lebih besar dari jam mulai","error");
        return;
      }

      if(!maxPlayers || maxPlayers <= 0){
        showToast("Isi maksimal pemain","error");
        return;
      }

      if(mode === "private" && maxPlayers > 4){
        showToast("Private maksimal 4 pemain","error");
        return;
      }

      if(mode === "semi-private" && maxPlayers > 8){
        showToast("Semi-private maksimal 8 pemain","error");
        return;
      }

      if(
        (sessionType === "Drill" || sessionType === "Drill + Mabar")
        && (!selectedCoaches || selectedCoaches.length === 0)
      ){
        showToast("Drill wajib memilih coach","error");
        return;
      }

      if(ratePerHour && ratePerHour % 5000 !== 0){
        showToast("Rate per jam harus kelipatan 5.000","error");
        return;
      }

      if(racketRate && racketRate % 5000 !== 0){
        showToast("Rate raket harus kelipatan 5.000","error");
        return;
      }

      const conflict = await checkCoachConflict(date,startTime,endTime);

      if(conflict){
        showToast("Coach sudah memiliki sesi di jam tersebut","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        date,
        startTime,
        endTime,

        tier,
        sessionType,
        mode,

        maxPlayers,
        court,

        hostId: auth.currentUser.uid,

        coaches: selectedCoaches
          ? selectedCoaches.map(id=>({
              id,
              approval: "pending"
            }))
          : [],

        pricePerHour: ratePerHour || 0,

        racketStock: racketStock || 0,
        racketPrice: racketRate || 0,

        notes: notes || "",

        status: "open",
        createdAt: serverTimestamp()
      });

      showToast("Sesi berhasil dibuat","success");
      closeCreateSessionSheet();

    }catch(err){
      showToast(err.message,"error");
    }

  };
}

async function checkCoachConflict(date, startTime, endTime){

  if(!selectedCoaches || selectedCoaches.length === 0){
    return false;
  }

  const q = query(
    collection(db,"schedules"),
    where("date","==",date),
    where("status","==","open")
  );

  const snap = await getDocs(q);

  for(const docSnap of snap.docs){

    const data = docSnap.data();

    if(!data.coaches || !Array.isArray(data.coaches)) continue;

    const existingStart = data.startTime;
    const existingEnd   = data.endTime;

    if(!existingStart || !existingEnd) continue;

    const overlap =
      (startTime < existingEnd) &&
      (endTime > existingStart);

    if(!overlap) continue;

    const coachConflict = data.coaches.some(c =>
      selectedCoaches.includes(c.id)
    );

    if(coachConflict){
      return true;
    }

  }

  return false;
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

function formatDate(d){
  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(d){
  return new Date(d).toLocaleDateString("id-ID",{weekday:"short",month:"short",day:"numeric"});
}
