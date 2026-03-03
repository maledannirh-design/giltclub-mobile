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

      </div>
    `;

    /* =============================
       FLOATING TROPHY
    ============================= */
    createFloatingTrophy();

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
   FLOATING LEADERBOARD (CROWN - PREMIUM)
========================================= */
function createFloatingTrophy(){

  const old = document.getElementById("floatingLeaderboard");
  if(old) old.remove();

  const btn = document.createElement("div");
  btn.id = "floatingLeaderboard";

  btn.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <i class="fa-solid fa-crown"></i>
      <span>Leaderboard</span>
    </div>
  `;

  btn.style.position = "fixed";
  btn.style.top = "100px";
  btn.style.left = "10px";
  btn.style.zIndex = "9999";
  btn.style.cursor = "grab";
  btn.style.userSelect = "none";

  btn.style.padding = "8px 16px";
  btn.style.borderRadius = "40px";
  btn.style.background = "rgba(0,0,0,.35)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.color = "#E3C565";
  btn.style.fontWeight = "600";
  btn.style.fontSize = "16px";
  btn.style.boxShadow = "0 4px 20px rgba(0,0,0,.4)";

  // Perbesar crown
  const icon = btn.querySelector("i");
  icon.style.fontSize = "28px";

  document.body.appendChild(btn);

  btn.onclick = ()=>{
    window.navigate("leaderboard");
  };

  /* ================= DRAG SUPPORT ================= */
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function startDrag(clientX, clientY){
    isDragging = true;
    offsetX = clientX - btn.offsetLeft;
    offsetY = clientY - btn.offsetTop;
  }

  function moveDrag(clientX, clientY){
    if(!isDragging) return;
    btn.style.left = (clientX - offsetX) + "px";
    btn.style.top = (clientY - offsetY) + "px";
  }

  function endDrag(){
    isDragging = false;
  }

  // Desktop
  btn.addEventListener("mousedown",(e)=>{
    startDrag(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove",(e)=>{
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", endDrag);

  // Mobile
  btn.addEventListener("touchstart",(e)=>{
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchmove",(e)=>{
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchend", endDrag);
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

window.openDailyScan = function(day){

  if(dailyLock) return;
  dailyLock = true;

  window.location.href = `scanDaily.html?day=${day}`;
};
