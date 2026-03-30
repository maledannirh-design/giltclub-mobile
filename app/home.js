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

let userUnsubscribe = null;
let dailyLock = false;


/* =========================================
   HOME DASHBOARD 
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

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
// 🔥 LETAKKAN DI SINI
document.querySelector(".leaderboard-btn")
  ?.addEventListener("click", ()=>{
    if (window.navigate) {
      window.navigate("leaderboard");
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

    startResetCountdown();
    

  }catch(error){

    console.error("Home error:", error);

    content.innerHTML = `
      <div style="padding:20px;color:red;">
        Failed to load home.
      </div>
    `;
  }
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

  const attPercent =
    (data.attendance.value / data.attendance.max) * 100;

  const finPercent =
    (data.financial.value / data.financial.max) * 100;

  return `
    <div class="verified-progress-card">

      <div class="verified-title">
        Progress menjadi Member "Verified"
      </div>

      <!-- ATTENDANCE -->
      <div class="verified-row">
        <div>Total kehadiran bulanan (tanpa voucher)</div>
        <div>
          ${data.attendance.value} / ${data.attendance.max}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill"
             style="width:${attPercent}%">
        </div>
      </div>

      <!-- FINANCIAL -->
      <div class="verified-row">
        <div>Financial Contribution</div>
        <div>
          ${formatRupiah(data.financial.value)} /
          ${formatRupiah(data.financial.max)}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill gold"
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
