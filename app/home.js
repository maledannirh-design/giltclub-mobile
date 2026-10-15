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
let dailyLock = false;
let broadcastStarted = false;


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
    ${await renderActivitySummaryCard()}

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



async function renderActivitySummaryCard(){
  try{
    const snap = await getDoc(doc(db,"websiteStats","ActivitySummary"));
    if(!snap.exists()) return `<section style="background:#fff;border-radius:20px;padding:20px;margin:18px 0;"><h3 style="color:#2E5D3A;margin:0 0 8px;">GMTC Activity Summary</h3><p style="color:#71816f;margin:0;">Ringkasan belum tersedia. Admin dapat menekan Refresh Statistic di menu Admin.</p></section>`;
    const d=snap.data(), fmt=n=>Number(n||0).toLocaleString("id-ID");
    return `<section style="background:#fff;border-radius:20px;padding:20px;margin:18px 0;box-shadow:0 8px 24px #0000000d;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><h3 style="margin:0;color:#2E5D3A;">GMTC Activity Summary</h3><span style="font-size:11px;color:#71816f;">Publik</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <div style="background:#F6F1E7;border-radius:14px;padding:14px;"><div style="font-size:12px;color:#71816f;">Sessions Hosted</div><strong style="display:block;font-size:24px;color:#2E5D3A;margin-top:5px;">${fmt(d.sessionsHosted)}</strong></div>
        <div style="background:#F6F1E7;border-radius:14px;padding:14px;"><div style="font-size:12px;color:#71816f;">Player Attendances</div><strong style="display:block;font-size:24px;color:#2E5D3A;margin-top:5px;">${fmt(d.playerAttendances)}</strong></div>
        <div style="background:#F6F1E7;border-radius:14px;padding:14px;grid-column:1/-1;"><div style="font-size:12px;color:#71816f;">Court Hours Played</div><strong style="display:block;font-size:24px;color:#2E5D3A;margin-top:5px;">${fmt(d.courtHoursPlayed)} jam</strong></div>
      </div><p style="font-size:11px;color:#879184;margin:12px 0 0;">Terakhir diperbarui: ${d.generatedDateWita||"-"} (WITA)</p></section>`;
  }catch(error){
    console.error("Activity Summary read failed:",error);
    return `<section style="background:#fff;border-radius:20px;padding:20px;margin:18px 0;"><h3 style="color:#2E5D3A;">GMTC Activity Summary</h3><p style="color:#71816f;">Ringkasan tidak dapat dimuat saat ini.</p></section>`;
  }
}
async function renderPublicActivitySummary(content){
  content.innerHTML=`<div class="home-container" style="padding:18px;"><div style="margin:8px 0 16px;"><h2 style="color:#2E5D3A;margin:0 0 6px;">Selamat datang di GMTC</h2><p style="color:#7d8b79;margin:0;">Ringkasan aktivitas komunitas dapat dilihat tanpa login.</p></div><div id="publicActivitySummary">${await renderActivitySummaryCard()}</div></div>`;
}

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
