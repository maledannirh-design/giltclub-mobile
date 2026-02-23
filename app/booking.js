import { db, auth } from "./firebase.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";
import { showToast, showConfirm } from "./ui.js";

import { 
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
   RENDER BOOKING PAGE
================================= */
export async function renderBooking() {

  const content = document.getElementById("content");
  if (!content) return;

  if (unsubscribeSchedules) {
    unsubscribeSchedules();
    unsubscribeSchedules = null;
  }

  content.innerHTML = `<div style="padding:20px;text-align:center;opacity:.6;">Loading...</div>`;

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
}

/* ===============================
   FULL UI
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
   UPCOMING HERO JADWAL TERDEKAT
================================= */
function renderMyUpcomingHero(){

  if(!Array.isArray(userBookings) || !Array.isArray(allSchedules)){
    return "";
  }

  const now = new Date();

  const upcoming = userBookings
    .map(b => allSchedules.find(s => s.id === b.scheduleId))
    .filter(Boolean)
    .filter(s => {
      if(!s.date || !s.startTime) return false;
      return new Date(s.date + "T" + s.startTime) >= now;
    })
    .sort((a,b)=>{
      const dateA = new Date(a.date + "T" + (a.startTime || "00:00"));
      const dateB = new Date(b.date + "T" + (b.startTime || "00:00"));
      return dateA - dateB;
    })
    .slice(0,5);

  let contentHtml = "";

  if(!upcoming.length){

    contentHtml = `
      <div class="mini-session-empty">
        Belum ada jadwal main
      </div>
    `;

  } else {

    upcoming.forEach(s=>{
      contentHtml += `
        <div class="mini-session-card">
          <div class="mini-tier">
            ${s.tier || "Session"}
          </div>
          <div class="mini-time">
            ${formatDisplayDate(s.date)} • 
            ${s.startTime || ""} - ${s.endTime || ""}
          </div>
        </div>
      `;
    });

  }

  return `
    <div class="my-upcoming-wrapper">
      <div class="my-upcoming-glass">
        <div class="my-upcoming-title">
          Jadwal Main Saya Terdekat
        </div>
        <div class="my-upcoming-scroll">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

/* ===============================
   CALENDAR TAMPILAN (FINAL FIX)
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

    // 🔥 CUKUP CEK ADA SESSION ATAU TIDAK
    const hasSession = allSchedules.some(s => s.date === dateStr);

    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    html += `
      <div class="month-day ${hasSession ? "has-session" : ""} ${isWeekend ? "weekend":""}"
           data-date="${dateStr}">
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* ===============================
   CALENDAR POPUP (FINAL CLEAN)
================================= */
async function openSessionPopup(dateStr) {

  const popup = document.getElementById("popupContainer");
  if (!popup) return;

  const sessions = allSchedules
    .filter(s => s.date === dateStr)
    .sort((a,b)=> (a.startTime || "").localeCompare(b.startTime || ""));

  let html = `
    <div class="popup-overlay">
      <div class="popup-card premium-popup">
        <h3>${formatDisplayDate(dateStr)}</h3>
  `;

  if (!sessions.length) {

    html += `
      <div class="empty-session">
        Tidak ada sesi pada hari ini
      </div>
    `;

  } else {

    for (const s of sessions) {

      // ===== GET BOOKINGS (HITUNG SLOT + AVATAR) =====
      const bookingSnap = await getDocs(
        query(
          collection(db,"bookings"),
          where("scheduleId","==",s.id),
          where("status","==","active")
        )
      );

      const bookedCount = bookingSnap.size;
      const maxPlayers = s.maxPlayers || 0;
      const sisaSlot = Math.max(maxPlayers - bookedCount, 0);

      // ===== COACH NAME (USERNAME) =====
      const coachNames = (s.coaches && s.coaches.length)
        ? s.coaches.map(c => c.name).join(", ")
        : "-";

      // ===== AVATAR GRID =====
      const members = bookingSnap.docs.map(d => d.data());

      const memberAvatarsHtml = members.map(m => `
        <div class="member-avatar">
          <img src="${m.photoURL || '/default-avatar.png'}" alt="member">
        </div>
      `).join("");

      html += `
        <div class="popup-session-card session-detail-content">

          <div><strong>Tier:</strong> ${s.tier || "-"}</div>
          <div><strong>Jenis:</strong> ${s.sessionType || "-"}</div>
          <div><strong>Tipe:</strong> ${s.mode || "-"}</div>

          <div><strong>Jam:</strong> ${s.startTime || "-"} - ${s.endTime || "-"}</div>
          <div><strong>Lapangan:</strong> ${s.court || "-"}</div>

          <div><strong>Maks Pemain:</strong> ${maxPlayers}</div>
          <div><strong>Sisa Slot:</strong> ${sisaSlot}</div>

          <div><strong>Rate / Jam:</strong> Rp ${(s.pricePerHour || 0).toLocaleString("id-ID")}</div>

          <div><strong>Coach:</strong> ${coachNames}</div>

          <div><strong>Catatan:</strong> ${s.notes || "-"}</div>

          <button class="join-btn" data-id="${s.id}">
            Gabung Sesi Ini
          </button>

          <div class="session-members">
            ${memberAvatarsHtml}
          </div>

        </div>
      `;
    }
  }

  html += `
        <button id="closePopup" class="close-popup-btn">Tutup</button>
      </div>
    </div>
  `;

  popup.innerHTML = html;
  attachBookingButtons();
}

/* ===============================
   CREATE SESSION CARD
================================= */
function renderCreateSessionCard(){
  return `
    <div class="create-session-wrapper">
      <button class="premium-create-btn" id="openCreateSession">
        <span class="plus-icon">＋</span>
        Buat Sesi
      </button>
    </div>
  `;
}

/* ===============================
   CREATE SESSION SHEET
================================= */
export async function openCreateSessionSheet(){
 if(!auth.currentUser){
    showToast("Login terlebih dahulu","error");
    return;
  }

  const userSnap = await getDocs(
    query(collection(db,"users"), where("__name__","==",auth.currentUser.uid))
  );

  if(userSnap.empty){
    showToast("User tidak ditemukan","error");
    return;
  }

  const userData = userSnap.docs[0].data();

  if(!userData.verified){
    showToast("Akun harus verified untuk membuat sesi","warning");
    return;
  }
  window.selectedCoaches = [];
  window.selectedCoachRates = [];

  const sheet = document.getElementById("createSessionSheet");
  if(!sheet) return;

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div id="createSessionOverlay"></div>

    <div class="premium-sheet">
      <div class="sheet-handle"></div>
      <h2>Buat Sesi</h2>

      <div class="sheet-section">
        <label>Tier Sesi</label>
        <select id="tier">
          <option>Newbie</option>
          <option>Beginner</option>
          <option>Upper Beginner</option>
          <option>Intermediate</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Jenis Sesi</label>
        <select id="sessionType">
          <option value="Mabar">Mabar</option>
          <option value="Drill">Drill</option>
          <option value="Drill + Mabar">Drill + Mabar</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Tipe Sesi</label>
        <select id="sessionMode">
          <option value="reguler">Reguler</option>
          <option value="semi-private">Semi Private</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Maksimal Pemain</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="sessionDate">
      </div>

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

      <div class="sheet-section">
        <label>Lapangan</label>
        <input type="text" id="court">
      </div>

      <div class="sheet-section">
        <label>Pilih Coach (maksimal 2)</label>
        <div id="coachSelector"></div>
      </div>

      <div class="sheet-section">
        <label>Rate Coach / Jam</label>
        <div id="coachRateDisplay">-</div>
      </div>

      <div class="sheet-section">
        <label>Status Coach</label>
        <div id="coachStatusDisplay">none</div>
      </div>

      <div class="sheet-section">
        <label>Rate / Jam (Pemain)</label>
        <input type="number" id="ratePerHour" step="5000">
      </div>

      <div class="sheet-section">
        <label>Raket Sewaan</label>
        <input type="number" id="racketStock">
      </div>

      <div class="sheet-section">
        <label>Rate Raket / Sesi</label>
        <input type="number" id="racketRate" step="5000">
      </div>

      <div class="sheet-section">
        <label>Catatan</label>
        <textarea id="notes" rows="3"></textarea>
      </div>

      <button class="btn-create-session" id="submitCreateSession">
        Buat Sesi
      </button>
    </div>
  `;

  // 🔥 CLOSE VIA OVERLAY (DIRECT BIND)
  const overlay = document.getElementById("createSessionOverlay");

  overlay.addEventListener("click", () => {
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  });

  setupCreateSessionSubmit();
  setupCoachSelector();
}

/* ===============================
   EVENTS
================================= */
function attachGlobalEvents(){

  const content = document.getElementById("content");
  if(!content) return;

  content.onclick = async (e) => {

    // ===== Klik tanggal kalender =====
    const monthDay = e.target.closest(".month-day");
    if (monthDay && !monthDay.classList.contains("empty")) {
      openSessionPopup(monthDay.dataset.date);
      return;
    }

    // ===== Tutup popup sesi =====
    if (e.target.id === "closePopup") {
      const popup = document.getElementById("popupContainer");
      if(popup) popup.innerHTML = "";
      return;
    }

    // ===== Prev Month =====
    if (e.target.id === "prevMonth") {
      slideDirection = "prev";
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderFullUI();
      return;
    }

    // ===== Next Month =====
    if (e.target.id === "nextMonth") {
      slideDirection = "next";
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderFullUI();
      return;
    }

    // ===== Open Create Session =====
    if (e.target.id === "openCreateSession"){
      openCreateSessionSheet();
      return;
    }

  };
  
}

/* ===============================
   BOOKING UI HANDLER
================================= */

function attachBookingButtons(){

  const joinButtons = document.querySelectorAll(".join-btn");

  joinButtons.forEach(btn=>{
    btn.addEventListener("click", async ()=>{

      if(!auth.currentUser){
        showToast("Login terlebih dahulu","warning");
        return;
      }

      if(bookingLock) return;

      bookingLock = true;

      try{

        await createBooking({
          userId: auth.currentUser.uid,
          scheduleId: btn.dataset.id
        });

        showToast("Booking berhasil","success");
        renderBooking(); // refresh UI

      }catch(err){
        showToast(err.message || "Booking gagal","error");
      }

      bookingLock = false;

    });
  });

}

/* ===============================
   CREATE SESSION (USERNAME FIXED)
================================= */
await addDoc(collection(db,"schedules"),{

  date,
  startTime,
  endTime,

  tier,
  sessionType,
  mode,

  maxPlayers,
  slots: maxPlayers,   // pastikan ini ada

  court,

  hostId: auth.currentUser.uid,

  coaches: (window.selectedCoaches || []).map(c => ({
    id: c.id,
    name: c.name,
    rate: c.rate,
    approval: "pending"
  })),

  pricePerHour: ratePerHour || 0,
  racketStock: racketStock || 0,
  racketPrice: racketRate || 0,

  notes: notes || "",
  status: "open",
  createdAt: serverTimestamp()

});

// ✅ SUCCESS
showToast("Sesi berhasil dibuat","success");

// ✅ TUTUP SHEET
const sheet = document.getElementById("createSessionSheet");
if(sheet){
  sheet.classList.remove("active");
  sheet.innerHTML = "";
}

// ✅ REFRESH UI
renderBooking();

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

async function setupCoachSelector(){

  const container = document.getElementById("coachSelector");
  if(!container) return;

  window.selectedCoaches = [];
  window.selectedCoachRates = [];

  const q = query(
    collection(db,"users"),
    where("role","in",["coach","supercoach","SUPERCOACH","COACH"])
  );

  const snap = await getDocs(q);

  if(snap.empty){
    container.innerHTML = `<div style="opacity:.6;">Tidak ada coach tersedia</div>`;
    return;
  }

  container.innerHTML = "";

  snap.docs.forEach(docSnap=>{

    const data = docSnap.data();
    const coachId = docSnap.id;

    const item = document.createElement("div");
    item.className = "coach-item";
    item.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" value="${coachId}">
        <span>${data.fullName || data.username}</span>
      </label>
    `;

    const checkbox = item.querySelector("input");

    checkbox.addEventListener("change", ()=>{

      if(checkbox.checked){

        if(window.selectedCoaches.length >= 2){
          showToast("Maksimal 2 coach","error");
          checkbox.checked = false;
          return;
        }

        window.selectedCoaches.push({
  id: coachId,
  name: data.fullName || data.username,
  rate: data.coachRate || 0
});
        window.selectedCoachRates.push(data.coachRate || 0);

      }else{

        window.selectedCoaches =
          window.selectedCoaches.filter(id=>id!==coachId);

        window.selectedCoachRates.pop();
      }

      updateCoachMetaDisplay();

    });

    container.appendChild(item);

  });

}

function updateCoachMetaDisplay(){

  const rateDisplay = document.getElementById("coachRateDisplay");
  const statusDisplay = document.getElementById("coachStatusDisplay");

  if(!rateDisplay || !statusDisplay) return;

  if(!window.selectedCoachRates.length){
    rateDisplay.innerText = "-";
    statusDisplay.innerText = "none";
    return;
  }

  const totalRate =
    window.selectedCoachRates.reduce((a,b)=>a+b,0);

  rateDisplay.innerText =
    "Rp " + totalRate.toLocaleString("id-ID");

  statusDisplay.innerText = "pending";
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
