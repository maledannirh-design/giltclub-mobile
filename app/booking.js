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
  runTransaction,   // ✅ TAMBAHKAN INI
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

  // Auto close session yang sudah lewat (engine level)
  await autoCloseFinishedSessions();

  if (unsubscribeSchedules) {
    unsubscribeSchedules();
    unsubscribeSchedules = null;
  }

  content.innerHTML = `<div style="padding:20px;text-align:center;opacity:.6;">Loading...</div>`;

  // 🔥 Ambil SEMUA session (open + closed)
  unsubscribeSchedules = onSnapshot(
    collection(db, "schedules"),
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
   CALENDAR POPUP COMPLETE VERSION
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

        const name =
          bookingData.displayName ||
          bookingData.username ||
          bookingData.fullName ||
          "Member";

        members.push({
          userId: bookingData.userId,
          username: name,
          avatarInitial: name.charAt(0).toUpperCase(),
          photoURL: bookingData.photoURL || null
        });
      }

      const alreadyJoined = currentUser
        ? members.some(m => m.userId === currentUser.uid)
        : false;

      const isPrivileged =
        ["ADMIN","SUPERCOACH"].includes(currentUserRole) ||
        s.hostId === currentUser?.uid;

      const now = new Date();
      const sessionStart = new Date(s.date + "T" + (s.startTime || "00:00"));
      const sessionEnd = new Date(s.date + "T" + (s.endTime || "00:00"));

      const isRunning = now >= sessionStart && now <= sessionEnd;
      const isFinished = now > sessionEnd;
      const isClosed = s.status === "closed";

      const sisaSlot = s.slots ?? 0;
      const isFull = sisaSlot <= 0;

      /* SLOT RENDER */

      let slotHtml = "";
      let memberPointer = 0;

      for (let i = 0; i < maxPlayers; i++) {

        const locked = lockedSlots.find(l => l.index === i);

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

        const member = members[memberPointer];

        if (member) {
          slotHtml += `
            <div class="member-wrapper slot filled-slot">
              <div class="member-avatar">
                ${
                  member.photoURL
                    ? `<img src="${member.photoURL}">`
                    : `<div class="avatar-initial">${member.avatarInitial}</div>`
                }
              </div>
              <div class="member-name">${member.username}</div>
            </div>
          `;
          memberPointer++;
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
        <div class="popup-session-card ${isClosed ? "session-closed" : ""}">

          ${isClosed ? `<div class="session-closed-label">SESSION CLOSED</div>` : ""}

          <div class="session-meta">
            <div><strong>Tier:</strong> ${s.tier || "-"}</div>
            <div><strong>Jenis:</strong> ${s.sessionType || "-"}</div>
            <div><strong>Tipe:</strong> ${s.mode || "-"}</div>
          </div>

          <div><strong>Jam:</strong> ${s.startTime || "-"} - ${s.endTime || "-"}</div>
          <div><strong>Lapangan:</strong> ${s.court || "-"}</div>
          <div><strong>Maks Pemain:</strong> ${maxPlayers}</div>
          <div><strong>Sisa Slot:</strong> ${sisaSlot}</div>
          <div><strong>Rate / Jam:</strong> Rp ${(s.pricePerHour || 0).toLocaleString("id-ID")}</div>

          ${
            s.racketStock > 0
              ? `
              <div class="racket-selector">
                <label>Raket Sewaan</label>
                <input type="number"
                  class="racket-input"
                  data-id="${s.id}"
                  min="0"
                  max="${s.racketStock}"
                  value="0">
                <div class="racket-price">
                  Rp ${(s.racketPrice || 0).toLocaleString("id-ID")} / sesi
                </div>
              </div>
              `
              : ""
          }

          ${
            currentUser
              ? `
              <button class="join-btn"
                data-id="${s.id}"
                ${isClosed || isFinished || (isFull && !alreadyJoined) ? "disabled" : ""}>
                ${
                  isClosed
                    ? "Session Closed"
                    : isFinished
                      ? "Sesi Selesai"
                      : isFull && !alreadyJoined
                        ? "Slot Penuh"
                        : alreadyJoined
                          ? "Cancel Join"
                          : "Gabung Sesi Ini"
                }
              </button>
              `
              : ""
          }

          ${
            isPrivileged
              ? `
              <div class="session-admin-actions">
                <button class="edit-session-btn" data-id="${s.id}">
                  ✏️ Edit Session
                </button>
              </div>
              `
              : ""
          }

          ${
            isPrivileged && isRunning && !isClosed
              ? `<button class="checkin-btn" data-id="${s.id}">Check In</button>`
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

  /* ===============================
     EDIT BUTTON
  =============================== */
  document.querySelectorAll(".edit-session-btn").forEach(btn=>{
    btn.onclick = ()=>{
      openEditSessionSheet(btn.dataset.id);
    };
  });

  /* ===============================
     CHECK IN BUTTON
  =============================== */
  document.querySelectorAll(".checkin-btn").forEach(btn=>{
    btn.onclick = ()=>{
      if (typeof window.openScanForCheckIn === "function") {
        window.openScanForCheckIn(btn.dataset.id);
      }
    };
  });

  /* ===============================
     JOIN BUTTON
  =============================== */
  document.querySelectorAll(".join-btn").forEach(btn=>{
    btn.onclick = async ()=>{
      if (btn.disabled) return;
      if (!currentUser) {
        showToast("Login terlebih dahulu","warning");
        return;
      }
      if (bookingLock) return;

      bookingLock = true;

      try {

        const scheduleId = btn.dataset.id;
        const s = sessions.find(x => x.id === scheduleId);

        if (!btn.innerText.includes("Cancel")) {

          const racketInput = document.querySelector(
            `.racket-input[data-id="${scheduleId}"]`
          );

          const racketQty = racketInput
            ? Number(racketInput.value || 0)
            : 0;

          const basePrice = s.pricePerHour || 0;
          const racketTotal = racketQty * (s.racketPrice || 0);
          const total = basePrice + racketTotal;

          const confirmPay = await showConfirm(
            `Total pembayaran Rp ${total.toLocaleString("id-ID")}`
          );

          if (!confirmPay) {
            bookingLock = false;
            return;
          }

          const pin = await window.requestTransactionPin();

          if (!pin) {
            bookingLock = false;
            return;
          }

          await createBooking({
            userId: currentUser.uid,
            scheduleId,
            racketQty,
            pin
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

  const slotElements = document.querySelectorAll(".slot");

  slotElements.forEach(slot => {

    slot.addEventListener("click", async () => {

      const scheduleId = slot.dataset.schedule;
      const index = Number(slot.dataset.index);

      if (!scheduleId || isNaN(index)) return;

      const scheduleRef = doc(db, "schedules", scheduleId);

      const scheduleSnap = await getDoc(scheduleRef);
      if (!scheduleSnap.exists()) return;

      const scheduleData = scheduleSnap.data();

      const isPrivileged =
        ["ADMIN","SUPERCOACH"].includes(currentUserRole) ||
        scheduleData.hostId === currentUser.uid;

      /* =================================================
         EMPTY SLOT
      ================================================= */
      if (slot.classList.contains("empty-slot")) {

        // MEMBER → BOOKING
        if (!isPrivileged) {

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

        // PRIVILEGED → LOCK SLOT
        const label = prompt("Masukkan label untuk lock slot:");
        if (!label) return;

        try {

          await runTransaction(db, async (transaction) => {

            const snap = await transaction.get(scheduleRef);
            if (!snap.exists()) throw new Error("Session tidak ditemukan");

            const data = snap.data();
            const currentSlots = data.slots ?? 0;
            const lockedSlots = data.lockedSlots || [];

            if (currentSlots <= 0) {
              throw new Error("Tidak ada slot tersisa");
            }

            const alreadyLocked =
              lockedSlots.some(l => l.index === index);

            if (alreadyLocked) {
              throw new Error("Slot sudah terkunci");
            }

            transaction.update(scheduleRef, {
              lockedSlots: [
                ...lockedSlots,
                { index, label }
              ],
              slots: currentSlots - 1
            });

          });

          showToast("Slot berhasil dikunci","success");
          renderBooking();

        } catch (err) {
          showToast(err.message || "Gagal lock slot","error");
        }

        return;
      }

      /* =================================================
         LOCKED SLOT
      ================================================= */
      if (slot.classList.contains("locked-slot")) {

        if (!isPrivileged) return;

        const confirmUnlock = confirm("Unlock slot ini?");
        if (!confirmUnlock) return;

        try {

          await runTransaction(db, async (transaction) => {

            const snap = await transaction.get(scheduleRef);
            if (!snap.exists()) throw new Error("Session tidak ditemukan");

            const data = snap.data();
            const lockedSlots = data.lockedSlots || [];
            const currentSlots = data.slots ?? 0;

            const updated = lockedSlots.filter(
              l => l.index !== index
            );

            if (updated.length === lockedSlots.length) {
              throw new Error("Slot tidak ditemukan");
            }

            transaction.update(scheduleRef, {
              lockedSlots: updated,
              slots: currentSlots + 1
            });

          });

          showToast("Slot berhasil dibuka","success");
          renderBooking();

        } catch (err) {
          showToast(err.message || "Gagal unlock slot","error");
        }

        return;
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

  <div class="coach-dropdown">

    <div class="coach-dropdown-trigger" id="coachDropdownTrigger">
      <span id="coachDropdownLabel">Tidak ada</span>
      <span class="coach-arrow">▾</span>
    </div>

    <div class="coach-dropdown-list" id="coachSelector"></div>

  </div>
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
  const dropdown = document.querySelector(".coach-dropdown");
  const trigger = document.getElementById("coachDropdownTrigger");

  if(!container || !dropdown || !trigger) return;

  // RESET GLOBAL STATE
  window.selectedCoaches = [];
  window.selectedCoachRates = [];

  // TOGGLE DROPDOWN
  trigger.onclick = ()=>{
    dropdown.classList.toggle("active");
  };

  // CLOSE IF CLICK OUTSIDE
  document.addEventListener("click",(e)=>{
    if(!dropdown.contains(e.target)){
      dropdown.classList.remove("active");
    }
  });

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
    const coachName = data.fullName || data.username || "Coach";

    const item = document.createElement("div");
    item.className = "coach-item";

    item.innerHTML = `
      <label>
        <input type="checkbox" value="${coachId}">
        <span>${coachName}</span>
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
          name: coachName,
          rate: data.coachRate || 0
        });

      }else{

        window.selectedCoaches =
          window.selectedCoaches.filter(c=>c.id !== coachId);

      }

      // Rebuild rate array (lebih aman daripada pop)
      window.selectedCoachRates =
        window.selectedCoaches.map(c=>c.rate);

      updateCoachDropdownLabel();
      updateCoachMetaDisplay();

    });

    container.appendChild(item);

  });

  updateCoachDropdownLabel();
}
function updateCoachDropdownLabel(){

  const label = document.getElementById("coachDropdownLabel");
  if(!label) return;

  if(!window.selectedCoaches.length){
    label.innerText = "Tidak ada";
    return;
  }

  label.innerText =
    window.selectedCoaches.map(c=>c.name).join(", ");
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


async function openEditSessionSheet(scheduleId){

  const scheduleRef = doc(db,"schedules",scheduleId);
  const snap = await getDoc(scheduleRef);

  if(!snap.exists()){
    showToast("Session tidak ditemukan","error");
    return;
  }

  const s = snap.data();

  await openCreateSessionSheet();

  setTimeout(()=>{

    document.getElementById("tier").value = s.tier || "Newbie";
    document.getElementById("sessionType").value = s.sessionType || "Mabar";
    document.getElementById("sessionMode").value = s.mode || "reguler";

    document.getElementById("sessionDate").value = s.date || "";
    document.getElementById("startTime").value = s.startTime || "";
    document.getElementById("endTime").value = s.endTime || "";

    document.getElementById("maxPlayers").value = s.maxPlayers || 0;
    document.getElementById("court").value = s.court || "";

    document.getElementById("ratePerHour").value = s.pricePerHour || 0;
    document.getElementById("racketStock").value = s.racketStock || 0;
    document.getElementById("racketRate").value = s.racketPrice || 0;

    document.getElementById("notes").value = s.notes || "";

    const submitBtn = document.getElementById("submitCreateSession");
    submitBtn.innerText = "Update Session";

    submitBtn.onclick = async ()=>{

      try{

        const newMaxPlayers = Number(document.getElementById("maxPlayers").value);

        if(!newMaxPlayers || newMaxPlayers <= 0){
          showToast("Maksimal pemain tidak valid","error");
          return;
        }

        // 🔥 Hitung booking aktif
        const bookingSnap = await getDocs(
          query(
            collection(db,"bookings"),
            where("scheduleId","==",scheduleId),
            where("status","==","active")
          )
        );

        const activeBookings = bookingSnap.size;

        // 🔥 Hitung locked slot
        const currentSnap = await getDoc(scheduleRef);
        const currentData = currentSnap.data();
        const lockedCount = (currentData.lockedSlots || []).length;

        const totalUsed = activeBookings + lockedCount;

        if(newMaxPlayers < totalUsed){
          showToast(
            `Tidak bisa mengurangi maksimal pemain. Sudah terisi ${totalUsed} slot.`,
            "error"
          );
          return;
        }

        const newSlots = newMaxPlayers - totalUsed;

        await updateDoc(scheduleRef,{

          tier: document.getElementById("tier").value,
          sessionType: document.getElementById("sessionType").value,
          mode: document.getElementById("sessionMode").value,

          date: document.getElementById("sessionDate").value,
          startTime: document.getElementById("startTime").value,
          endTime: document.getElementById("endTime").value,

          maxPlayers: newMaxPlayers,
          slots: newSlots,   // 🔥 sinkron ulang

          court: document.getElementById("court").value.trim(),

          pricePerHour: Number(document.getElementById("ratePerHour").value),
          racketStock: Number(document.getElementById("racketStock").value),
          racketPrice: Number(document.getElementById("racketRate").value),

          notes: document.getElementById("notes").value.trim(),
        });

        showToast("Session berhasil diperbarui","success");

        const sheet = document.getElementById("createSessionSheet");
        sheet.classList.remove("active");
        sheet.innerHTML = "";

        renderBooking();

      }catch(err){
        console.error(err);
        showToast("Gagal update session","error");
      }

    };

  },200);
}


/* ===============================
   AUTO CLOSE FINISHED SESSIONS
================================= */
async function autoCloseFinishedSessions() {

  const now = new Date();

  const q = query(
    collection(db, "schedules"),
    where("status", "==", "open")
  );

  const snap = await getDocs(q);

  for (const docSnap of snap.docs) {

    const data = docSnap.data();

    if (!data.date || !data.endTime) continue;

    const sessionEnd = new Date(
      data.date + "T" + data.endTime
    );

    if (now > sessionEnd) {

      await updateDoc(
        doc(db, "schedules", docSnap.id),
        {
          status: "closed"
        }
      );
    }
  }
}


/* ===============================
   OPEN SCAN FOR CHECK IN
================================= */
window.openScanForCheckIn = function(scheduleId) {

  const existing = document.getElementById("scanOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "scanOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "#000";
  overlay.style.zIndex = "9999";
  overlay.innerHTML = `
    <div style="position:absolute;top:20px;left:20px;z-index:10001;">
      <button id="closeScanBtn" style="
        background:#fff;
        border:none;
        padding:10px 15px;
        border-radius:8px;
        font-weight:bold;
      ">Tutup</button>
    </div>
    <div id="qr-reader" style="width:100%;height:100%;"></div>
  `;

  document.body.appendChild(overlay);

  const html5QrCode = new Html5Qrcode("qr-reader");

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    async (decodedText) => {

      try {

        const url = new URL(decodedText);
        const memberCode = url.searchParams.get("c");
        const issue = url.searchParams.get("i");
        const signature = url.searchParams.get("s");

        const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!userSnap.exists()) {
          showToast("User tidak ditemukan","error");
          return;
        }

        const currentUserData = {
          uid: auth.currentUser.uid,
          ...userSnap.data()
        };

        const result = await window.processCheckIn(
          memberCode,
          issue,
          signature,
          scheduleId,
          currentUserData
        );

        if (result.valid) {
          showToast("Check-in berhasil","success");
        } else {
          showToast(result.reason || "Check-in gagal","error");
        }

      } catch (err) {
        showToast("QR tidak valid","error");
      }

      await html5QrCode.stop();
      overlay.remove();
      renderBooking();

    },
    () => {}
  );

  document.getElementById("closeScanBtn").onclick = async () => {
    await html5QrCode.stop();
    overlay.remove();
  };
};


/* ===============================
   REQUEST TRANSACTION PIN (6 DIGIT)
================================= */
window.requestTransactionPin = function() {

  return new Promise(async (resolve) => {

    const existing = document.getElementById("pinTxOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "pinTxOverlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.bottom = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "flex-end";

    overlay.innerHTML = `
      <div style="
        width:100%;
        background:#fff;
        border-radius:20px 20px 0 0;
        padding:20px;
        animation: slideUp .2s ease-out;
      ">
        <div style="text-align:center;font-weight:bold;margin-bottom:10px;">
          Masukkan PIN Transaksi
        </div>

        <div id="pinDisplay" style="
          text-align:center;
          font-size:28px;
          letter-spacing:10px;
          margin:15px 0;
        ">● ● ● ● ● ●</div>

        <div id="pinError" style="
          text-align:center;
          color:red;
          font-size:14px;
          height:18px;
        "></div>

        <div id="pinPad" style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:10px;
          margin-top:15px;
        ">
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let pin = "";
    let attempts = 0;
    const maxAttempts = 3;

    const pinDisplay = document.getElementById("pinDisplay");
    const pinError = document.getElementById("pinError");
    const pinPad = document.getElementById("pinPad");

    function renderDots() {
      const dots = Array(6).fill("○");
      for (let i = 0; i < pin.length; i++) {
        dots[i] = "●";
      }
      pinDisplay.innerText = dots.join(" ");
    }

    function closePin(result) {
      overlay.remove();
      resolve(result);
    }

    function createButton(text, onClick) {
      const btn = document.createElement("button");
      btn.innerText = text;
      btn.style.padding = "15px";
      btn.style.fontSize = "18px";
      btn.style.borderRadius = "12px";
      btn.style.border = "1px solid #eee";
      btn.style.background = "#f7f7f7";
      btn.onclick = onClick;
      return btn;
    }

    for (let i = 1; i <= 9; i++) {
      pinPad.appendChild(
        createButton(i, () => {
          if (pin.length >= 6) return;
          pin += i;
          renderDots();
          if (pin.length === 6) verifyPin();
        })
      );
    }

    pinPad.appendChild(
      createButton("⌫", () => {
        pin = pin.slice(0, -1);
        renderDots();
      })
    );

    pinPad.appendChild(
      createButton("0", () => {
        if (pin.length >= 6) return;
        pin += "0";
        renderDots();
        if (pin.length === 6) verifyPin();
      })
    );

    pinPad.appendChild(
      createButton("Batal", () => {
        closePin(null);
      })
    );

    async function verifyPin() {

      const user = auth.currentUser;
      if (!user) {
        closePin(null);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        closePin(null);
        return;
      }

      const userData = snap.data();

      if (userData.pinTrx !== pin) {

        attempts++;
        pinError.innerText = "PIN salah";

        pin = "";
        renderDots();

        if (attempts >= maxAttempts) {
          pinError.innerText = "Terlalu banyak kesalahan";
          setTimeout(() => closePin(null), 1000);
        }

        return;
      }

      closePin(pin);
    }

    renderDots();
  });
};
