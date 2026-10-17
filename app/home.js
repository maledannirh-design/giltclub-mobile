import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "./firestore.js";
import { renderMemberCard } from "./utils.js";
import { onSnapshot } from "./firestore.js";
import { getVerifiedProgress } from "./verifiedlist/verifiedProgressEngine.js";
import { listenBroadcast } from "./broadcastListener.js";


let userUnsubscribe = null;

window.stopHomeListeners = function(){
  if(userUnsubscribe){
    userUnsubscribe();
    userUnsubscribe = null;
  }
};
let dailyLock = false;
let broadcastStarted = false;

// Reset the scan guard when the app is restored after cancelling the camera.
// Mobile browsers may restore the previous page from the back-forward cache.
window.addEventListener("pageshow", () => {
  dailyLock = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") dailyLock = false;
});


/* =========================================
   HOME DASHBOARD 
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content) return;
  if(!user){
    await renderPublicActivitySummary(content);
    return;
  }
  try{
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const today = new Date().toISOString().split("T")[0];
    const alreadyClaimed = userData.lastCheckinDate === today;

    const rewardMatrix = userData.membership === "VVIP"
      ? [15,15,15,15,15,15,200]
      : [10,10,10,10,10,10,150];

    const streak = userData.currentStreak || 0;

  /* =============================
   RENDER UI (CLEAN)
============================= */
content.innerHTML = `
  <div class="home-container">

    <div class="home-header">

      <div class="home-profile-left">
        <div class="home-avatar">
          ${
            userData.photoURL
              ? `<img src="${userData.photoURL}" />`
              : `<div class="avatar-placeholder">👤</div>`
          }
        </div>

        <div class="home-user-text">
          <div class="home-username">
            ${userData.username || "User"}
          </div>

          <div class="home-gpoint">
            ${userData.gPoint || 0} G-Point
          </div>
        </div>

      </div>

      <div class="home-profile-right">
        <div class="leaderboard-btn">
          <i class="fa-solid fa-crown"></i>
          <span>Leaderboard</span>
        </div>
        <div class="championclub-btn">
          <i class="fa-solid fa-trophy"></i>
          <span>Champion Club</span>
        </div>
      </div>

    </div>

    <!-- DAILY CHECK-IN -->
    <div class="home-progress-group">
    <div class="daily-card">

      <div class="daily-header">
        <div class="daily-title">Check-In Harian</div>
        <div class="daily-info">Informasi Check-In</div>
      </div>

      <div class="daily-days">
        ${rewardMatrix.map((reward, index)=>{
          const dayNumber = index + 1;
          const claimed = dayNumber <= streak;

          return `
            <div class="daily-box ${claimed ? 'claimed' : ''}"
                 ${alreadyClaimed ? '' : `onclick="openDailyScan(${dayNumber})"`}>
              <div class="daily-day">Hari ${dayNumber}</div>
              <div class="daily-reward">🪙 +${reward}</div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="daily-status ${alreadyClaimed ? 'done' : ''}">
        ${
          alreadyClaimed
            ? "Poin diterima, Check-In lagi besok ya!"
            : "Scan kartu Anda untuk check-in hari ini"
        }
      </div>

    </div>
    ${renderVerifiedProgress(userData)}
    </div>
    ${await renderActivitySummaryCard()}

  </div>
`;

  // =============================
  // NAVIGATION BUTTON
  // =============================
  document.querySelector(".leaderboard-btn")
    ?.addEventListener("click", ()=>{
      if (window.navigate) {
        window.navigate("leaderboard");
      }
    });

  document.querySelector(".championclub-btn")
    ?.addEventListener("click", ()=>{
      if (window.navigate) {
        window.navigate("championClub");
      }
    });

  /* =============================
     REALTIME GPOINT LISTENER
  ============================= */
  if(userUnsubscribe){
    userUnsubscribe();
  }

  userUnsubscribe = onSnapshot(doc(db,"users",user.uid),(snap)=>{
    if(!snap.exists()) return;

    const data = snap.data();

    const gPointEl = document.querySelector(".home-gpoint");
    if(gPointEl){
      gPointEl.textContent = `${data.gPoint || 0} G-Point`;
    }

    document.querySelectorAll(".daily-box").forEach((el, index) => {
      const dayNumber = index + 1;

      if (dayNumber <= (data.currentStreak || 0)) {
        el.classList.add("claimed");
      } else {
        el.classList.remove("claimed");
      }
    });

  }, (err)=>{
    if(err.code === "permission-denied" && !auth.currentUser){
      console.log("Home user listener stopped after logout");
      return;
    }
    console.error("Home user listener error:", err);
  });

  // =============================
  // SYSTEM INIT
  // =============================
  startResetCountdown();

  // 🔥 BROADCAST LISTENER (ANTI DOUBLE)
  if(!broadcastStarted){
    listenBroadcast();
    broadcastStarted = true;
  }

  }catch(error){

    console.error("Home error:", error);

    content.innerHTML = `
      ${await renderActivitySummaryCard()}
      <div style="padding:20px;color:#8b5e3c;">Beranda member gagal dimuat. Ringkasan aktivitas tetap ditampilkan.</div>
    `;
  }
}




async function renderPublicActivitySummary(content){
  // Guest sees the same TERAS layout as a logged-in member, with account values set to zero.
  // Protected actions open the member-access modal; no private user document/listener is read.
  const rewardMatrix = [10,10,10,10,10,10,150];
  content.innerHTML = `
    <div class="home-container guest-home-container">
      <div class="home-header">
        <div class="home-profile-left">
          <div class="home-avatar"><div class="avatar-placeholder">👤</div></div>
          <div class="home-user-text">
            <div class="home-username">Guest</div>
            <div class="home-gpoint">0 G-Point</div>
          </div>
        </div>
        <div class="home-profile-right">
          <div class="leaderboard-btn"><i class="fa-solid fa-crown"></i><span>Leaderboard</span></div>
          <div class="championclub-btn"><i class="fa-solid fa-trophy"></i><span>Champion Club</span></div>
        </div>
      </div>
      <div class="home-progress-group guest-progress-group"><div class="daily-card guest-protected-card">
        <div class="daily-header"><div class="daily-title">Check-In Harian</div><div class="daily-info">Informasi Check-In</div></div>
        <div class="daily-days">
          ${rewardMatrix.map((reward,index)=>`<div class="daily-box guest-checkin-box" role="button" tabindex="0" onclick="openGuestCheckinAccess()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openGuestCheckinAccess();}"><div class="daily-day">Hari ${index+1}</div><div class="daily-reward">🪙 +${reward}</div></div>`).join("")}
        </div>
        <div class="daily-status guest-checkin-box" role="button" tabindex="0" onclick="openGuestCheckinAccess()">Scan kartu Anda untuk check-in hari ini</div>
      </div>
      <div class="verified-progress-card guest-protected-card" role="button" tabindex="0" onclick="openGuestCheckinAccess()">
        <div class="verified-title">Progress Verified (Bulan Ini)</div>
        <div class="verified-row"><div>Kehadiran bulan ini</div><div>0 / 2</div></div>
        <div class="verified-bar"><div class="verified-fill" style="width:0%"></div></div>
        <div class="verified-row"><div>Kontribusi bulan ini</div><div>Rp 0 / Rp 250.000</div></div>
        <div class="verified-bar"><div class="verified-fill gold" style="width:0%"></div></div>
      </div></div>
      ${await renderActivitySummaryCard()}
    </div>
    <div id="guestCheckinAccessOverlay" class="member-access-overlay" onclick="if(event.target===this)closeGuestCheckinAccess()">
      <div class="member-access-card" role="dialog" aria-modal="true" aria-labelledby="guestCheckinAccessTitle">
        <button class="member-access-close" type="button" aria-label="Tutup" onclick="closeGuestCheckinAccess()">×</button>
        <div class="member-access-icon">🔒</div><h2 class="member-access-title" id="guestCheckinAccessTitle">Akses Khusus Member</h2>
        <div class="member-access-actions">
          <div class="member-access-option"><button type="button" class="member-access-register" onclick="closeGuestCheckinAccess();window.navigate('account');setTimeout(()=>document.getElementById('registerBtn')?.click(),150)">Daftar</button><p>Belum jadi anggota? Klik daftar</p></div>
          <div class="member-access-option"><button type="button" class="member-access-login" onclick="closeGuestCheckinAccess();window.navigate('account');setTimeout(()=>document.getElementById('loginBtn')?.click(),150)">Masuk</button><p>Sudah punya akun? Klik masuk</p></div>
        </div>
      </div>
    </div>
  `;
  document.querySelector(".leaderboard-btn")?.addEventListener("click",()=>window.navigate?.("leaderboard"));
  document.querySelector(".championclub-btn")?.addEventListener("click",()=>window.navigate?.("championClub"));
}
window.openGuestCheckinAccess = function(){document.getElementById("guestCheckinAccessOverlay")?.classList.add("show");};
window.closeGuestCheckinAccess = function(){document.getElementById("guestCheckinAccessOverlay")?.classList.remove("show");};

async function renderActivitySummaryCard(){
  let d = null;
  let readFailed = false;
  try{
    const snap = await getDoc(doc(db,"websiteStats","ActivitySummary"));
    d = snap.exists() ? snap.data() : null;
  }catch(error){
    console.error("Activity Summary read failed:",error);
    readFailed = true;
  }

  const fmt = n => Number(n || 0).toLocaleString("id-ID");
  const value = (key, suffix = "") => d ? `${fmt(d[key])}${suffix}` : "—";
  const updated = d?.generatedDateWita ? `${d.generatedDateWita} (WITA)` : "Belum diperbarui";

  return `
    <button type="button" onclick="openActivitySummaryModal()" aria-haspopup="dialog" style="
      width:100%;text-align:left;background:#fff;border:1px solid #e8eee7;
      border-radius:18px;padding:18px;margin:18px 0;box-shadow:0 8px 24px #0000000d;
      cursor:pointer;color:#355742;display:block;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7b8c78;margin-bottom:5px;">Community Statistics</div>
          <div style="font-size:18px;font-weight:800;color:#2E5D3A;">GMTC Activity Summary</div>
          <div style="font-size:12px;color:#71816f;margin-top:5px;">${d ? "Lihat statistik aktivitas komunitas" : "Statistik belum diperbarui"}</div>
        </div>
        <span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;flex-shrink:0;border-radius:50%;background:#edf4ec;color:#2E5D3A;font-size:22px;">›</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px;">
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Sessions Hosted</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("sessionsHosted")}</div>
        </div>
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Player Attendances</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("playerAttendances")}</div>
        </div>
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Court Hours</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("courtHoursPlayed"," jam")}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#879184;margin-top:12px;">Terakhir diperbarui: ${updated} <span style="float:right;color:#2E5D3A;font-weight:700;">Lihat detail ↗</span></div>
    </button>

    <div id="activitySummaryModal" role="dialog" aria-modal="true" aria-labelledby="activitySummaryModalTitle" style="
      display:none;position:fixed;inset:0;z-index:9999;background:rgba(18,34,22,.58);
      padding:18px;align-items:center;justify-content:center;box-sizing:border-box;
    " onclick="if(event.target===this)closeActivitySummaryModal()">
      <section style="width:100%;max-width:460px;max-height:85vh;overflow:auto;background:#fff;border-radius:22px;padding:22px;box-sizing:border-box;box-shadow:0 20px 60px #00000030;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px;">
          <div>
            <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#879184;">GMTC Community</div>
            <h2 id="activitySummaryModalTitle" style="margin:5px 0 0;color:#2E5D3A;font-size:22px;">Activity Summary</h2>
            <p style="font-size:12px;color:#71816f;margin:6px 0 0;">Ringkasan aktivitas komunitas</p>
          </div>
          <button type="button" onclick="closeActivitySummaryModal()" aria-label="Tutup" style="border:0;background:#f1f4ef;color:#355742;width:36px;height:36px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;">×</button>
        </div>
        ${readFailed ? '<p style="padding:14px;background:#fff6f0;border-radius:12px;color:#9a4b20;font-size:13px;">Ringkasan tidak dapat dimuat saat ini.</p>' : !d ? '<p style="padding:14px;background:#f7f8f4;border-radius:12px;color:#71816f;font-size:13px;">Belum ada data statistik. Ringkasan akan tampil setelah admin menjalankan Refresh Statistic.</p>' : `
          <div style="display:grid;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Sessions Hosted</span><strong style="font-size:22px;color:#2E5D3A;">${value("sessionsHosted")}</strong></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Player Attendances</span><strong style="font-size:22px;color:#2E5D3A;">${value("playerAttendances")}</strong></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Court Hours Played</span><strong style="font-size:22px;color:#2E5D3A;">${value("courtHoursPlayed"," jam")}</strong></div>
          </div>
          <p style="font-size:11px;color:#879184;margin:16px 0 0;">Terakhir diperbarui: ${updated}</p>
        `}
        <button type="button" onclick="closeActivitySummaryModal()" style="width:100%;margin-top:20px;padding:13px;border:0;border-radius:12px;background:#2E5D3A;color:#fff;font-weight:700;cursor:pointer;">Tutup</button>
      </section>
    </div>
  `;
}

window.openActivitySummaryModal = function(){
  const modal = document.getElementById("activitySummaryModal");
  if(!modal) return;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

window.closeActivitySummaryModal = function(){
  const modal = document.getElementById("activitySummaryModal");
  if(modal) modal.style.display = "none";
  document.body.style.overflow = "";
};

/* =========================================
   COUNTDOWN ENGINE
========================================= */
let countdownInterval = null;

function startResetCountdown(){

  if(countdownInterval){
    clearInterval(countdownInterval);
  }

  function update(){

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setHours(24,0,0,0);

    const diff = tomorrow - now;

    const hours = String(Math.floor(diff / (1000*60*60))).padStart(2,"0");
    const minutes = String(Math.floor((diff % (1000*60*60)) / (1000*60))).padStart(2,"0");
    const seconds = String(Math.floor((diff % (1000*60)) / 1000)).padStart(2,"0");

    const el = document.getElementById("resetTimer");
    if(el){
      el.textContent = `${hours}:${minutes}:${seconds}`;
    }
  }

  update();
  countdownInterval = setInterval(update,1000);
}

function renderVerifiedProgress(userData){

  const data = getVerifiedProgress(userData);
  if(!data) return "";

  // ✅ SAFE + CLAMP
  const attPercent = Math.min(
    data.attendance.max > 0
      ? (data.attendance.value / data.attendance.max) * 100
      : 0,
    100
  );

  const finPercent = Math.min(
    data.financial.max > 0
      ? (data.financial.value / data.financial.max) * 100
      : 0,
    100
  );

  const attendanceDone = data.attendance.value >= data.attendance.max;
  const financialDone = data.financial.value >= data.financial.max;

  return `
    <div class="verified-progress-card">

      <div class="verified-title">
        Progress Verified (Bulan Ini)
      </div>

      <!-- ATTENDANCE -->
      <div class="verified-row">
        <div>Kehadiran bulan ini (tanpa voucher)</div>
        <div>
          ${data.attendance.value} / ${data.attendance.max}
          ${attendanceDone ? '<span class="verified-check">✔</span>' : ''}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill ${attendanceDone ? 'full' : ''}"
             style="width:${attPercent}%">
        </div>
      </div>

      <!-- FINANCIAL -->
      <div class="verified-row">
        <div>Kontribusi bulan ini</div>
        <div>
          ${formatRupiah(data.financial.value)} /
          ${formatRupiah(data.financial.max)}
          ${financialDone ? '<span class="verified-check">✔</span>' : ''}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill ${
          financialDone ? 'full' : 'gold'
        }"
             style="width:${finPercent}%">
        </div>
      </div>

    </div>
  `;
}


function formatRupiah(num){
  return "Rp " + (num || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g,".");
}

window.openDailyScan = function(day){

  if(dailyLock) return;
  dailyLock = true;

  window.location.href = `scanDaily.html?day=${day}`;
};
