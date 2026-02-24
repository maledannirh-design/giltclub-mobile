import { db, auth } from "./firebase.js";
import { createBooking, cancelBooking } from "./services/bookingService.js";
import { showToast, showConfirm } from "./ui.js";
import { 
  collection,
  query,
  where,
  getDoc,
  doc,
  getDocs,
  updateDoc,
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

  const currentUser = auth.currentUser;
  let currentUserRole = "member";

  if (currentUser) {
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (userSnap.exists()) {
      currentUserRole = (userSnap.data().role || "member").toUpperCase();
    }
  }

  const sessions = allSchedules
    .filter(s => s.date === dateStr)
    .sort((a,b)=> (a.startTime || "").localeCompare(b.startTime || ""));

  let html = `
    <div class="popup-overlay">
      <div class="popup-card premium-popup">
        <h3>${formatDisplayDate(dateStr)}</h3>
  `;

  if (!sessions.length) {

    html += `<div class="empty-session">Tidak ada sesi pada hari ini</div>`;

  } else {

    for (const s of sessions) {

      const bookingSnap = await getDocs(
        query(
          collection(db,"bookings"),
          where("scheduleId","==",s.id),
          where("status","==","active")
        )
      );

      const maxPlayers = s.maxPlayers || 0;
      const lockedSlots = s.lockedSlots || [];

      const members = [];

      for (const docSnap of bookingSnap.docs) {
        const bookingData = docSnap.data();
        const userSnap = await getDoc(doc(db,"users",bookingData.userId));
        if (userSnap.exists()) {
          const u = userSnap.data();
          members.push({
            userId: bookingData.userId,
            username: u.username || u.fullName || "Member",
            photoURL: u.photoURL || null
          });
        }
      }

      const alreadyJoined = currentUser
        ? members.some(m => m.userId === currentUser.uid)
        : false;

      const isPrivileged =
        ["ADMIN","SUPERCOACH","host"].includes(currentUserRole) ||
        s.hostId === currentUser?.uid;

      // ===== SLOT RENDER =====
      let slotHtml = "";

      for (let i = 0; i < maxPlayers; i++) {

        const locked = lockedSlots.find(l => l.index === i);
        const member = members[i];

        if (locked) {
          slotHtml += `
            <div class="member-wrapper slot locked-slot" 
                 data-schedule="${s.id}" 
                 data-index="${i}">
              <div class="member-avatar">
                <div class="avatar-initial">🔒</div>
              </div>
              <div class="member-name">${locked.label || "Locked"}</div>
            </div>
          `;
          continue;
        }

        if (member) {
          slotHtml += `
            <div class="member-wrapper slot filled-slot"
                 data-user="${member.userId}">
              <div class="member-avatar">
                ${
                  member.photoURL
                    ? `<img src="${member.photoURL}">`
                    : `<div class="avatar-initial">
                         ${member.username.charAt(0).toUpperCase()}
                       </div>`
                }
              </div>
              <div class="member-name">${member.username}</div>
            </div>
          `;
          continue;
        }

        slotHtml += `
          <div class="member-wrapper slot empty-slot"
               data-schedule="${s.id}" 
               data-index="${i}">
            <div class="member-avatar">
              <div class="avatar-initial">+</div>
            </div>
            <div class="member-name">Kosong</div>
          </div>
        `;
      }

      html += `
        <div class="popup-session-card">

          <div><strong>Tier:</strong> ${s.tier || "-"}</div>
          <div><strong>Jenis:</strong> ${s.sessionType || "-"}</div>
          <div><strong>Tipe:</strong> ${s.mode || "-"}</div>
          <div><strong>Jam:</strong> ${s.startTime || "-"} - ${s.endTime || "-"}</div>
          <div><strong>Lapangan:</strong> ${s.court || "-"}</div>
          <div><strong>Maks Pemain:</strong> ${maxPlayers}</div>
          <div><strong>Rate / Jam:</strong> Rp ${(s.pricePerHour || 0).toLocaleString("id-ID")}</div>
          <div><strong>Catatan:</strong> ${s.notes || "-"}</div>

          ${
            currentUser
              ? `<button class="join-btn" data-id="${s.id}">
                   ${alreadyJoined ? "Cancel Join" : "Gabung Sesi Ini"}
                 </button>`
              : ""
          }

          ${
            isPrivileged
              ? `<button class="edit-session-btn" data-id="${s.id}">
                   Edit Session
                 </button>`
              : ""
          }

          <div class="session-members">
            ${slotHtml}
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
  attachSlotInteraction(currentUserRole);
  // ===== JOIN BUTTON LOGIC =====
  document.querySelectorAll(".join-btn").forEach(btn=>{
    btn.onclick = async ()=>{
      if (!currentUser) {
        showToast("Login terlebih dahulu","warning");
        return;
      }

      if (bookingLock) return;
      bookingLock = true;

      try {

        if (btn.innerText.includes("Cancel")) {

          await cancelBooking({
            userId: currentUser.uid,
            scheduleId: btn.dataset.id
          });

          showToast("Booking dibatalkan","success");

        } else {

          await createBooking({
            userId: currentUser.uid,
            scheduleId: btn.dataset.id
          });

          showToast("Berhasil join sesi","success");
        }

        renderBooking();

      } catch(err){
        showToast(err.message || "Gagal","error");
      }

      bookingLock = false;
    };
  });

}



async function attachSlotInteraction(currentUserRole) {

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const isPrivileged =
    ["ADMIN","SUPERCOACH","host"].includes(currentUserRole);

  const slots = document.querySelectorAll(".slot");

  slots.forEach(slot => {

    slot.addEventListener("click", async () => {

      const scheduleId = slot.dataset.schedule;
      const index = Number(slot.dataset.index);

      if (!scheduleId && !slot.classList.contains("empty-slot")) {
        return;
      }

      // ===== EMPTY SLOT =====
      if (slot.classList.contains("empty-slot")) {

        if (!isPrivileged) {

          // MEMBER = JOIN
          try {
            await createBooking({
              userId: currentUser.uid,
              scheduleId
            });

            showToast("Berhasil join sesi","success");
            renderBooking();

          } catch (err) {
            showToast(err.message || "Gagal join","error");
          }

          return;
        }

        // ===== ADMIN LOCK SLOT =====
        const label = prompt("Masukkan label untuk lock slot:");

        if (!label) return;

        try {

          const scheduleRef = doc(db,"schedules",scheduleId);
          const scheduleSnap = await getDoc(scheduleRef);

          if (!scheduleSnap.exists()) return;

          const lockedSlots = scheduleSnap.data().lockedSlots || [];

          lockedSlots.push({
            index,
            label
          });

          await updateDoc(scheduleRef,{
            lockedSlots
          });

          showToast("Slot berhasil dikunci","success");
          renderBooking();

        } catch(err){
          showToast("Gagal lock slot","error");
        }

        return;
      }

      // ===== LOCKED SLOT CLICK =====
      if (slot.classList.contains("locked-slot")) {

        if (!isPrivileged) return;

        const confirmUnlock = confirm("Unlock slot ini?");

        if (!confirmUnlock) return;

        try {

          const scheduleRef = doc(db,"schedules",scheduleId);
          const scheduleSnap = await getDoc(scheduleRef);

          if (!scheduleSnap.exists()) return;

          const lockedSlots = scheduleSnap.data().lockedSlots || [];

          const updated = lockedSlots.filter(l => l.index !== index);

          await updateDoc(scheduleRef,{
            lockedSlots: updated
          });

          showToast("Slot berhasil dibuka","success");
          renderBooking();

        } catch(err){
          showToast("Gagal unlock slot","error");
        }

      }

    });

  });

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
   CREATE SESSION SUBMIT (FINAL CLEAN)
================================= */
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

      if(!maxPlayers || maxPlayers <= 0){
        showToast("Isi maksimal pemain","error");
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
        slots: maxPlayers,   // 🔥 penting

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

      showToast("Sesi berhasil dibuat","success");

      const sheet = document.getElementById("createSessionSheet");
      if(sheet){
        sheet.classList.remove("active");
        sheet.innerHTML = "";
      }

      renderBooking();

    }catch(err){
      showToast(err.message || "Gagal membuat sesi","error");
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
