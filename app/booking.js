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
  deleteDoc,
  onSnapshot,
  addDoc,
  runTransaction,   // ✅ TAMBAHKAN INI
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requestTransactionPin, validateTransactionPin } from "./pinTrx.js";
/* ===============================
   STATE
================================= */
let unsubscribeSchedules = null;
let bookingLock = false;
let allSchedules = [];
let userBookings = [];
let currentMonth = new Date();
let selectedSport = "all";
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

      <!-- 🔥 CABOR FILTER BAR -->
      <div class="sport-filter-bar">

        <div class="sport-item ${selectedSport==="all"?"active":""}" data-sport="all">All</div>

        <div class="sport-item ${selectedSport==="tennis"?"active":""}" data-sport="tennis">🎾 Tennis</div>
        <div class="sport-item ${selectedSport==="pound"?"active":""}" data-sport="pound">🥁 Pound</div>
        <div class="sport-item ${selectedSport==="dance"?"active":""}" data-sport="dance">💃 Tari</div>
        <div class="sport-item ${selectedSport==="golf"?"active":""}" data-sport="golf">⛳ Golf</div>
        <div class="sport-item ${selectedSport==="padel"?"active":""}" data-sport="padel">🏓 Padel</div>
        <div class="sport-item ${selectedSport==="run"?"active":""}" data-sport="run">🏃 Lari</div>
        <div class="sport-item ${selectedSport==="badminton"?"active":""}" data-sport="badminton">🏸 Badminton</div>
        <div class="sport-item ${selectedSport==="coffee"?"active":""}" data-sport="coffee">☕ Coffee</div>
        <div class="sport-item ${selectedSport==="science"?"active":""}" data-sport="science">🧠 Science</div>
        <div class="sport-item ${selectedSport==="counselling"?"active":""}" data-sport="counselling">🫂 Counselling</div>
        <div class="sport-item ${selectedSport==="swim"?"active":""}" data-sport="swim">🏊 Renang</div>

        <div class="sport-scroll-hint">⇄</div>

      </div>

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

    // 🔥 AMBIL SEMUA SESSION DI HARI INI
    const sessionsToday = allSchedules.filter(s => {

      if (s.date !== dateStr) return false;

      const sport = s.sportType || "tennis";

      if (selectedSport !== "all" && sport !== selectedSport) return false;

      return true;

    });

    // 🔥 UNIQUE SPORT
    const sportSet = new Set(
      sessionsToday.map(s => s.sportType || "tennis")
    );

    const sportsToday = Array.from(sportSet);

    const hasSession = sportsToday.length > 0;

    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 🔥 COLOR MAP DOT
    const sportColorMap = {
      tennis: "dot-tennis",
      coffee: "dot-coffee",
      golf: "dot-golf",
      swim: "dot-swim",
      pound: "dot-pound",
      dance: "dot-dance",
      counselling: "dot-counselling",
      science: "dot-science",
      run: "dot-run",
      badminton: "dot-badminton"
    };

    html += `
      <div class="month-day ${hasSession ? "has-session" : ""} ${isWeekend ? "weekend":""}"
           data-date="${dateStr}">

        <div class="day-number ${hasSession ? "active-day" : ""}">${d}</div>

        ${
          hasSession
            ? `
            <div class="day-dots">
              ${
                sportsToday.slice(0,3).map(sport=>{
                  const cls = sportColorMap[sport] || "dot-default";
                  return `<span class="day-dot ${cls}"></span>`;
                }).join("")
              }
              ${
                sportsToday.length > 3
                  ? `<span class="dot-more">+${sportsToday.length - 3}</span>`
                  : ""
              }
            </div>
            `
            : ""
        }

      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* ===============================
   CALENDAR POPUP COMPLETE VERSION (FINAL FIX CLEAN)
================================= */
async function openSessionPopup(dateStr) {

  const popup = document.getElementById("popupContainer");
  if (!popup) return;

  const currentUser = auth.currentUser;
  let currentUserRole = "MEMBER";

  if (currentUser) {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        currentUserRole = (userSnap.data().role || "MEMBER").toUpperCase();
      }
    } catch (e) {
      console.error("Failed to fetch role", e);
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

      const matches = await loadMatchesBySchedule(s.id);

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
        const b = docSnap.data();

        members.push({
          userId: b.userId,
          username:
            b.displayName ||
            b.username ||
            b.fullName ||
            "Member",
          avatarInitial: (b.displayName || "M")[0],
          photoURL: b.photoURL || null
        });
      }

      const isPrivileged =
        ["ADMIN","SUPERCOACH"].includes(currentUserRole) ||
        s.hostId === currentUser?.uid;

      const now = new Date();
      const sessionEnd = new Date(s.date + "T" + (s.endTime || "00:00"));
      const isFinished = now > sessionEnd;
      const isClosed = s.status === "closed";

      const sisaSlot = s.slots ?? 0;
      const isFull = sisaSlot <= 0;

      /* ===============================
         SLOT
      =============================== */
      let slotHtml = "";
      let pointer = 0;

      for (let i = 0; i < maxPlayers; i++) {

        const locked = lockedSlots.find(l => l.index === i);

        if (locked) {
          slotHtml += `<div class="slot locked">🔒 ${locked.label}</div>`;
          continue;
        }

        const m = members[pointer];

        if (m) {
          slotHtml += `<div class="slot filled">${m.username}</div>`;
          pointer++;
        } else {
          slotHtml += `<div class="slot empty">Kosong</div>`;
        }
      }

      /* ===============================
         WA PARSER
      =============================== */
      const phone = extractWhatsAppNumber(s.notes);

      html += `
        <div class="popup-session-card ${isClosed ? "session-closed" : ""}">

          <div><strong>Jam:</strong> ${s.startTime} - ${s.endTime}</div>
          <div><strong>Lapangan:</strong> ${s.court}</div>
          <div><strong>Sisa Slot:</strong> ${sisaSlot}</div>

          ${
            s.notes
              ? `<div class="session-notes">${s.notes}</div>`
              : ""
          }

          ${
            phone
              ? `<button class="wa-contact-btn" data-phone="${phone}">📞 Hubungi</button>`
              : ""
          }

          <div class="session-members">${slotHtml}</div>

          <!-- MATCHES -->
          <div class="session-matches">
            ${renderMatchesUI(matches, members)}
          </div>

          <!-- RANKING -->
          <div class="session-ranking">
            ${renderRankingUI(matches, members)}
          </div>

          ${
            isPrivileged
              ? `<button class="add-match-btn" data-id="${s.id}">+ Tambah Match</button>`
              : ""
          }

        </div>
      `;
    }
  }

  html += `</div></div>`;
  popup.innerHTML = html;

  /* ===============================
     SCORE CLICK
  =============================== */
  document.querySelectorAll(".editable-score").forEach(el=>{
    el.onclick = async ()=>{
      const matchId = el.closest(".match-card").dataset.id;
      const side = el.dataset.side;

      const value = Number(prompt("Score:"));
      if(isNaN(value)) return;

      const ref = doc(db,"matches",matchId);
      await updateDoc(ref, side==="A"?{scoreA:value}:{scoreB:value});

      renderBooking();
    };
  });

  /* ===============================
     ADD MATCH
  =============================== */
  document.querySelectorAll(".add-match-btn").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;

      const members = userBookings
        .filter(b=>b.scheduleId===id)
        .map(b=>({
          userId:b.userId,
          username:b.displayName||"Member"
        }));

      openAddMatchModal(id,members);
    };
  });

  attachSlotInteraction(currentUserRole);
}

  /* ===============================
     WA BUTTON HANDLER (SAFE)
  =============================== */
  document.querySelectorAll(".wa-contact-btn").forEach(btn => {

    btn.onclick = null;

    btn.addEventListener("click", () => {

      let phone = btn.dataset.phone;

      if(!phone){
        showToast("Nomor tidak tersedia","error");
        return;
      }

      phone = phone.replace(/\D/g, "");

      if(phone.length < 9){
        showToast("Nomor tidak valid","error");
        return;
      }

      const message = encodeURIComponent("Halo, saya tertarik dengan sesi ini");

      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");

    });

  });

  /* ===============================
     DELETE SESSION HANDLER
  =============================== */
  document.querySelectorAll(".delete-session-btn").forEach(btn => {

    btn.onclick = async () => {

      const scheduleId = btn.dataset.id;

      const confirmed = await showConfirm({
        title: "Hapus Sesi?",
        message: "Sesi akan dihapus permanen.",
        confirmText: "Ya, Hapus",
        cancelText: "Batal"
      });

      if (!confirmed) return;

      try {

        await deleteDoc(doc(db, "schedules", scheduleId));

        showToast("Sesi berhasil dihapus","success");

        const popup = document.getElementById("popupContainer");
        if(popup) popup.innerHTML = "";

      } catch (err) {
        console.error(err);
        showToast("Gagal menghapus sesi","error");
      }

    };

  });

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
    sessionStorage.setItem("checkinScheduleId", btn.dataset.id);
    window.location.href = "scan-checkin.html";
  };
});

/* ===============================
   JOIN BUTTON (FINAL PRO VERSION)
================================= */
document.querySelectorAll(".join-btn").forEach(btn => {

  btn.onclick = async () => {

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

      if (!s) {
        showToast("Sesi tidak ditemukan","error");
        bookingLock = false;
        return;
      }

      /* ===============================
         CANCEL JOIN
      =============================== */
      if (btn.innerText.includes("Cancel")) {

        const q = query(
          collection(db, "bookings"),
          where("userId", "==", currentUser.uid),
          where("scheduleId", "==", scheduleId),
          where("status", "==", "active")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          showToast("Booking tidak ditemukan","error");
          bookingLock = false;
          return;
        }

        const bookingDoc = snap.docs[0];
        const bookingData = bookingDoc.data();
        const bookingId = bookingDoc.id;

        const originalPrice = bookingData.price || 0;

        const sessionStart = new Date(
          s.date + "T" + s.startTime
        );

        const now = new Date();
        const diffHours =
          (sessionStart - now) / (1000 * 60 * 60);

        let penaltyAmount = 0;

        if (diffHours > 48) {
          penaltyAmount = originalPrice * 0.10;
        } else if (diffHours > 36) {
          penaltyAmount = originalPrice * 0.50;
        } else {
          penaltyAmount = originalPrice;
        }

        penaltyAmount = Math.floor(penaltyAmount);
        const refundAmount =
          Math.floor(originalPrice - penaltyAmount);

        const confirmed = await showConfirm({
          title: "Batalkan Sesi?",
          message: `
            Total penalty:
            <br><strong>Rp ${penaltyAmount.toLocaleString("id-ID")}</strong>
            <br><br>
            Total pengembalian dana:
            <br><strong>Rp ${refundAmount.toLocaleString("id-ID")}</strong>
          `,
          confirmText: "Ya, Batalkan",
          cancelText: "Tidak"
        });

        if (!confirmed) {
          bookingLock = false;
          return;
        }

        const pin = await requestTransactionPin();
        if (!pin) {
          bookingLock = false;
          return;
        }

        await cancelBooking({
          bookingId,
          pin
        });

        showToast("Booking dibatalkan","success");
        renderBooking();
        bookingLock = false;
        return;
      }

      /* ===============================
         JOIN FLOW
      =============================== */

      let racketQty = 0;
      let racketTotal = 0;

      if (s.racketStock && s.racketStock > 0) {

        const selectedQty = await window.openRacketSelector(s);

        if (selectedQty === null) {
          bookingLock = false;
          return;
        }

        racketQty = selectedQty;
        racketTotal = racketQty * (s.racketPrice || 0);
      }

      // HITUNG DURASI
      const [startH, startM] = s.startTime.split(":").map(Number);
      const [endH, endM] = s.endTime.split(":").map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const totalMinutes = endMinutes - startMinutes;

      const billedHours = Math.ceil(totalMinutes / 60);
      const sessionTotal =
        billedHours * (s.pricePerHour || 0);

      const totalPayment = sessionTotal + racketTotal;

      const confirmed = await showConfirm({
        title: "Konfirmasi Join Sesi",
        message: `
          Total sesi:
          <br><strong>Rp ${sessionTotal.toLocaleString("id-ID")}</strong>
          <br><br>
          Total raket:
          <br><strong>Rp ${racketTotal.toLocaleString("id-ID")}</strong>
          <br><br>
          Total pembayaran:
          <br><strong>Rp ${totalPayment.toLocaleString("id-ID")}</strong>
        `,
        confirmText: "Ya, Bayar",
        cancelText: "Tidak"
      });

      if (!confirmed) {
        bookingLock = false;
        return;
      }

      const pin = await requestTransactionPin();
      if (!pin) {
        bookingLock = false;
        return;
      }

      await createBooking({
        userId: currentUser.uid,
        scheduleId: scheduleId,
        racketQty: racketQty,
        pin: pin
      });

      showToast("Berhasil join sesi","success");
      renderBooking();

   } catch (err) {
  console.error(err);
  showToast(err.message || "Gagal", "error");
}

bookingLock = false;

} // ✅ TUTUP openSessionPopup DULU

/* ===============================
   SLOT INTERACTION
================================= */

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

    const confirmed = await showConfirm({
      title: "Gabung Sesi",
      message: "Lanjutkan booking sesi ini?",
      confirmText: "Ya",
      cancelText: "Batal"
    });

    if (!confirmed) return;

    const pin = await requestTransactionPin();
    if (!pin) return;

    await createBooking({
      userId: currentUser.uid,
      scheduleId: scheduleId,
      pin: pin
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
async function openCreateSessionSheet(){
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
      <div class="sheet-section">
  <label>Cashback Member</label>
  <input type="number" id="cashbackMember" step="1000">
</div>

<div class="sheet-section">
  <label>Cashback Verified</label>
  <input type="number" id="cashbackVerified" step="1000">
</div>

<div class="sheet-section">
  <label>Cashback VVIP</label>
  <input type="number" id="cashbackVVIP" step="1000">
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

    // ===== SPORT FILTER =====
    const sportItem = e.target.closest(".sport-item");
    if (sportItem) {
      selectedSport = sportItem.dataset.sport;
      renderFullUI();
      return;
    }

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
      openSportForm(selectedSport);
      return;
    }

  };

}

/* ===============================
   CREATE SESSION SUBMIT (FINAL CLEAN)
================================= */
export async function setupCreateSessionSubmit(){

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
      const cashbackMember   = Number(document.getElementById("cashbackMember").value);
      const cashbackVerified = Number(document.getElementById("cashbackVerified").value);
      const cashbackVVIP     = Number(document.getElementById("cashbackVVIP").value);

      // 🔥 NEW (AMBIL SPORT TYPE DARI FORM / DEFAULT TENNIS)
      const sportType = document.getElementById("sportType")?.value || "tennis";

      if(!date || !startTime || !endTime){
        showToast("Lengkapi tanggal dan jam","error");
        return;
      }

      if(!maxPlayers || maxPlayers <= 0){
        showToast("Isi maksimal pemain","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        // 🔥 CORE DATA
        sportType,

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
        createdAt: serverTimestamp(),

        cashbackMember: cashbackMember || 0,
        cashbackVerified: cashbackVerified || 0,
        cashbackVVIP: cashbackVVIP || 0,
        
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

  // 🔥 AMBIL SPORT TYPE
  const sportType = s.sportType || "tennis";

  // 🔥 ROUTE KE FORM SESUAI CABOR
  if(sportType === "tennis"){
    await openCreateSessionSheet(); // tetap pakai default tennis
  }else{
    await openSportForm(sportType); // cabor lain
  }

  setTimeout(()=>{

    // =========================
    // SAFE FILL (ANTI ERROR)
    // =========================

    const setVal = (id,val)=>{
      const el = document.getElementById(id);
      if(el) el.value = val;
    };

    // 🔥 COMMON FIELD (SEMUA CABOR)
    setVal("date", s.date);
    setVal("sessionDate", s.date);

    setVal("startTime", s.startTime);
    setVal("endTime", s.endTime);

    setVal("maxPlayers", s.maxPlayers);
    setVal("notes", s.notes);

    setVal("court", s.court);

    // 🔥 TENNIS ONLY (AUTO SAFE)
    setVal("tier", s.tier || "Newbie");
    setVal("sessionType", s.sessionType || "Mabar");
    setVal("sessionMode", s.mode || "reguler");

    setVal("ratePerHour", s.pricePerHour || 0);
    setVal("racketStock", s.racketStock || 0);
    setVal("racketRate", s.racketPrice || 0);

    setVal("cashbackMember", s.cashbackMember || 0);
    setVal("cashbackVerified", s.cashbackVerified || 0);
    setVal("cashbackVVIP", s.cashbackVVIP || 0);

    // =========================
    // BUTTON DETECTION (MULTI FORM)
    // =========================

    const submitBtn =
      document.getElementById("submitCreateSession") ||
      document.getElementById("submitPound") ||
      document.getElementById("submitPadel");

    if(!submitBtn) return;

    submitBtn.innerText = "Update Session";

    submitBtn.onclick = async ()=>{

      try{

        const newMaxPlayers =
          Number(document.getElementById("maxPlayers")?.value) || 0;

        if(!newMaxPlayers || newMaxPlayers <= 0){
          showToast("Maksimal pemain tidak valid","error");
          return;
        }

        // 🔥 HITUNG BOOKING AKTIF
        const bookingSnap = await getDocs(
          query(
            collection(db,"bookings"),
            where("scheduleId","==",scheduleId),
            where("status","==","active")
          )
        );

        const activeBookings = bookingSnap.size;

        // 🔥 HITUNG LOCKED SLOT
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

          // 🔥 CORE
          date: document.getElementById("date")?.value ||
                document.getElementById("sessionDate")?.value ||
                s.date,

          startTime: document.getElementById("startTime")?.value || s.startTime,
          endTime: document.getElementById("endTime")?.value || s.endTime,

          maxPlayers: newMaxPlayers,
          slots: newSlots,

          court: document.getElementById("court")?.value || s.court,
          notes: document.getElementById("notes")?.value || "",

          // 🔥 OPTIONAL (AUTO SAFE)
          tier: document.getElementById("tier")?.value || s.tier,
          sessionType: document.getElementById("sessionType")?.value || s.sessionType,
          mode: document.getElementById("sessionMode")?.value || s.mode,

          pricePerHour: Number(document.getElementById("ratePerHour")?.value) || s.pricePerHour || 0,
          racketStock: Number(document.getElementById("racketStock")?.value) || s.racketStock || 0,
          racketPrice: Number(document.getElementById("racketRate")?.value) || s.racketPrice || 0,

          cashbackMember: Number(document.getElementById("cashbackMember")?.value) || 0,
          cashbackVerified: Number(document.getElementById("cashbackVerified")?.value) || 0,
          cashbackVVIP: Number(document.getElementById("cashbackVVIP")?.value) || 0,

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

  },250);
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

window.openRacketSelector = function(scheduleData){

  return new Promise((resolve)=>{

    const existing = document.getElementById("racketModalOverlay");
    if(existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "racketModalOverlay";
    overlay.className = "racket-modal-overlay";

    const maxStock = scheduleData.racketStock || 0;
    const racketPrice = scheduleData.racketPrice || 0;

    // 🔥 HITUNG DURASI SAMA PERSIS SEPERTI ENGINE
    let basePrice = 0;

    if(scheduleData.startTime && scheduleData.endTime){

      const [startH,startM] = scheduleData.startTime.split(":").map(Number);
      const [endH,endM] = scheduleData.endTime.split(":").map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const totalMinutes = endMinutes - startMinutes;

      const billedHours = Math.ceil(totalMinutes / 60);
      basePrice = billedHours * (scheduleData.pricePerHour || 0);
    }

    overlay.innerHTML = `
      <div class="racket-modal">
        <h3>Jumlah Raket Disewa</h3>

        <select id="racketQtySelect" class="racket-select">
          ${Array.from({length:maxStock+1},(_,i)=>{
            return `<option value="${i}" ${i===0?"selected":""}>${i} Raket</option>`
          }).join("")}
        </select>

        <div id="racketTotalPreview" class="racket-total-preview">
          Total: Rp ${basePrice.toLocaleString("id-ID")}
        </div>

        <button class="racket-confirm-btn">Lanjutkan</button>
        <button class="racket-cancel-btn">Batal</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const select = overlay.querySelector("#racketQtySelect");
    const preview = overlay.querySelector("#racketTotalPreview");

    function updateTotal(){
      const qty = parseInt(select.value,10) || 0;
      const total = basePrice + (qty * racketPrice);
      preview.innerText = `Total: Rp ${total.toLocaleString("id-ID")}`;
    }

    select.onchange = updateTotal;

    // 🔥 FORCE INITIAL ZERO
    select.value = "0";
    updateTotal();

    overlay.querySelector(".racket-confirm-btn").onclick = ()=>{
      const qty = parseInt(select.value,10) || 0;
      overlay.remove();
      resolve(qty);
    };

    overlay.querySelector(".racket-cancel-btn").onclick = ()=>{
      overlay.remove();
      resolve(null);
    };

  });

};

function openSportForm(sportType){

  const map = {
    tennis: () => import("./sports/tennisForm.js"),
    dukun: () => import("./sports/dukunForm.js"),
    golf: () => import("./sports/golfForm.js"),
    run: () => import("./sports/runForm.js"),
    dance: () => import("./sports/danceForm.js"),
    pound: () => import("./sports/poundForm.js"),
    badminton: () => import("./sports/badmintonForm.js"),
    swim: () => import("./sports/swimForm.js"),
    coffee: () => import("./sports/coffeeForm.js"),
    science: () => import("./sports/scienceForm.js"),
    counselling: () => import("./sports/counsellingForm.js")
  };

  const loader = map[sportType];

  if(!loader){
    showToast("Pilih Cabor terlebih dahulu","warning");
    return;
  }

  loader()
    .then(module => {

      const fn = module[`open${capitalize(sportType)}Form`];

      if(typeof fn !== "function"){
        showToast("Form belum tersedia","error");
        return;
      }

      fn();

    })
    .catch(err => {
      console.error(err);
      showToast("Form belum dibuat","error");
    });
}

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}


function extractWhatsAppNumber(text){

  if(!text) return null;

  // ambil angka dari text
  const match = text.match(/(\+?\d{9,15})/);

  if(!match) return null;

  let number = match[1];

  // normalisasi: 08 → 628
  if(number.startsWith("0")){
    number = "62" + number.substring(1);
  }

  return number;
}
function renderUniversalSessionCard(s){

  return `
    <div class="popup-session-card">

      <div class="session-title">
        ${getSportIcon(s.sportType)} ${s.court || "Session"}
      </div>

      <div><strong>Jam:</strong> ${s.startTime || "-"} </div>
      <div><strong>Kapasitas:</strong> ${s.maxPlayers || 0}</div>
      <div><strong>Sisa Slot:</strong> ${s.slots ?? 0}</div>

      ${
        s.notes
        ? `
        <div class="session-notes">
          ${s.notes.replace(/\n/g,"<br>")}
        </div>
        `
        : ""
      }

      <button class="join-btn" data-id="${s.id}">
        Gabung Sesi
      </button>

    </div>
  `;
}

function getSportIcon(type){

  const map = {
    pound: "🥁",
    dance: "💃",
    golf: "⛳",
    run: "🏃",
    badminton: "🏸",
    swim: "🏊",
    coffee: "☕",
    science: "🧠",
    counselling: "🫂",
    padel: "🏓"
  };

  return map[type] || "🎯";
}


async function loadMatchesBySchedule(scheduleId){

  try{

    const q = query(
      collection(db,"matches"),
      where("scheduleId","==",scheduleId)
    );

    const snap = await getDocs(q);

    return snap.docs.map(doc=>({
      id: doc.id,
      ...doc.data()
    }));

  }catch(err){
    console.error("Load matches error:", err);
    return [];
  }

}

function renderMatchesUI(matches, members){

  if(!matches || matches.length === 0){
    return `
      <div class="matches-empty">
        Belum ada match
      </div>
    `;
  }

  const userMap = {};
  members.forEach(m=>{
    userMap[m.userId] = m.username;
  });

  let html = "";

  matches.forEach(match=>{

    const teamA = (match.teamA || [])
      .map(uid => userMap[uid] || "Player")
      .join(" / ");

    const teamB = (match.teamB || [])
      .map(uid => userMap[uid] || "Player")
      .join(" / ");

    html += `
      <div class="match-card" data-id="${match.id}">

        <div class="match-row">
          <div class="team">${teamA}</div>
          <div class="score editable-score" data-side="A">
            ${match.scoreA ?? "-"}
          </div>
        </div>

        <div class="match-row">
          <div class="team">${teamB}</div>
          <div class="score editable-score" data-side="B">
            ${match.scoreB ?? "-"}
          </div>
        </div>

      </div>
    `;
  });

  return html;
}

function openAddMatchModal(scheduleId, members){

  const existing = document.getElementById("matchModal");
  if(existing) existing.remove();

  if(!members || members.length < 4){
    showToast("Minimal 4 player untuk match","error");
    return;
  }

  const modal = document.createElement("div");
  modal.id = "matchModal";
  modal.className = "match-modal-overlay";

  modal.innerHTML = `
    <div class="match-modal">

      <h3>Buat Match</h3>

      <div class="match-player-list">
        ${members.map(m=>`
          <div class="player-item" data-uid="${m.userId}">
            ${m.username}
          </div>
        `).join("")}
      </div>

      <div class="match-selected">
        <div id="teamA">Team A: -</div>
        <div id="teamB">Team B: -</div>
      </div>

      <button id="saveMatchBtn">Simpan Match</button>
      <button id="closeMatchModal">Batal</button>

    </div>
  `;

  document.body.appendChild(modal);

  let selected = [];

  const playerItems = modal.querySelectorAll(".player-item");

  playerItems.forEach(el=>{

    el.onclick = ()=>{

      const uid = el.dataset.uid;

      if(selected.includes(uid)){
        selected = selected.filter(x=>x !== uid);
        el.classList.remove("selected");
      }else{

        if(selected.length >= 4){
          showToast("Maksimal 4 player","warning");
          return;
        }

        selected.push(uid);
        el.classList.add("selected");
      }

      updateTeamsPreview();
    };

  });

  function updateTeamsPreview(){

    const teamA = selected.slice(0,2);
    const teamB = selected.slice(2,4);

    const nameMap = {};
    members.forEach(m=>{
      nameMap[m.userId] = m.username;
    });

    document.getElementById("teamA").innerText =
      "Team A: " + teamA.map(id=>nameMap[id]).join(" / ");

    document.getElementById("teamB").innerText =
      "Team B: " + teamB.map(id=>nameMap[id]).join(" / ");
  }

  document.getElementById("saveMatchBtn").onclick = async ()=>{

    if(selected.length !== 4){
      showToast("Pilih 4 player","error");
      return;
    }

    const teamA = selected.slice(0,2);
    const teamB = selected.slice(2,4);

    try{

      await addDoc(collection(db,"matches"),{
        scheduleId,
        teamA,
        teamB,
        scoreA: 0,
        scoreB: 0,
        status: "ongoing",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      showToast("Match berhasil dibuat","success");

      modal.remove();
      renderBooking(); // refresh

    }catch(err){
      console.error(err);
      showToast("Gagal membuat match","error");
    }

  };

  document.getElementById("closeMatchModal").onclick = ()=>{
    modal.remove();
  };

}

function calculateRanking(matches, members){

  const table = {};

  // mapping user
  members.forEach(m=>{
    table[m.userId] = {
      uid: m.userId,
      name: m.username,
      played: 0,
      win: 0,
      lose: 0,
      point: 0,
      conceded: 0
    };
  });

  matches.forEach(match=>{

    const { teamA, teamB, scoreA, scoreB } = match;

    if(scoreA == null || scoreB == null) return;

    // team A
    teamA.forEach(uid=>{
      const p = table[uid];
      if(!p) return;

      p.played++;
      p.point += scoreA;
      p.conceded += scoreB;

      if(scoreA > scoreB){
        p.win++;
      }else{
        p.lose++;
      }
    });

    // team B
    teamB.forEach(uid=>{
      const p = table[uid];
      if(!p) return;

      p.played++;
      p.point += scoreB;
      p.conceded += scoreA;

      if(scoreB > scoreA){
        p.win++;
      }else{
        p.lose++;
      }
    });

  });

  const ranking = Object.values(table);

  ranking.sort((a,b)=>{

    if(b.win !== a.win){
      return b.win - a.win;
    }

    const diffA = a.point - a.conceded;
    const diffB = b.point - b.conceded;

    if(diffB !== diffA){
      return diffB - diffA;
    }

    return b.point - a.point;

  });

  return ranking;
}

function renderRankingUI(matches, members){

  const ranking = calculateRanking(matches, members);

  if(!ranking.length){
    return `<div class="ranking-empty">Belum ada data</div>`;
  }

  let html = `<div class="ranking-title">🏆 Ranking</div>`;

  ranking.forEach((p, i)=>{

    const diff = p.point - p.conceded;

    html += `
      <div class="ranking-row">
        <div class="rank-pos">${i+1}</div>
        <div class="rank-name">${p.name}</div>
        <div class="rank-stat">${p.win}W-${p.lose}L</div>
        <div class="rank-diff ${diff>=0?'pos':'neg'}">
          ${diff>=0?'+':''}${diff}
        </div>
      </div>
    `;
  });

  return html;
}
