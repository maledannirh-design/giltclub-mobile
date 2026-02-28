import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "./firestore.js";
import { resolveMemberCard, renderMemberCard } from "./utils.js";
import { onSnapshot } from "./firestore.js";

let userUnsubscribe = null;
/* =========================================
   HOME DASHBOARD 
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  try{

    /* =============================
       USER DATA
    ============================= */
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const balance = userData.walletBalance || 0;
const today = new Date().toISOString().split("T")[0];
const alreadyClaimed = userData.lastCheckinDate === today;
    /* =============================
       CHAT ROOMS (UNREAD)
    ============================= */
    const roomsSnap = await getDocs(
      query(
        collection(db,"chatRooms"),
        where("participants","array-contains", user.uid)
      )
    );

    let unreadRooms = [];
    let totalUnread = 0;

    roomsSnap.forEach(docSnap=>{
      const data = docSnap.data();
      const unread = data.unreadCount?.[user.uid] || 0;

      if(unread > 0){
        totalUnread += unread;
        unreadRooms.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    unreadRooms.sort((a,b)=>{
      return (b.lastMessageAt?.seconds || 0) -
             (a.lastMessageAt?.seconds || 0);
    });

    /* =============================
       RENDER UI
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

          <div class="home-right-section">
            <div class="home-unread-icon">
              <div class="mail-icon">✉️</div>
              ${
                totalUnread > 0
                  ? `<div class="home-unread-badge">${totalUnread}</div>`
                  : ``
              }
            </div>
          </div>
        </div>

        <div id="homeUnreadScroll" class="home-unread-scroll"></div>

        <!-- WALLET CARD -->
        <div class="wallet-card-pink">

          <div class="wallet-card-header">
            <div class="wallet-title">G-WALLET</div>
            <div class="wallet-saldo-toggle">
              <span>G-Saldo</span>
              <span id="toggleSaldoBtn" class="eye-btn">
                ${eyeOpenSVG()}
              </span>
            </div>
          </div>

          <div class="wallet-main-content">

            <div class="wallet-left">
              <div id="walletAmount" class="wallet-amount">
                Rp ******
              </div>

              <button class="wallet-topup-btn">
                ➕ Top Up
              </button>
            </div>

            <div class="wallet-right" id="homeMemberCard"></div>

          </div>

        </div>

        <!-- ELITE DAILY CHECKIN (OUTSIDE WALLET) -->
        <div class="elite-zone">

          <div class="elite-header">
            <div class="elite-title">DAILY ELITE STREAK</div>
            <div class="elite-tier">${userData.membership || "MEMBER"}</div>
          </div>

          <div class="elite-countdown">
            Reset dalam <span id="resetTimer">--:--:--</span>
          </div>

          <div class="elite-days">
  ${[1,2,3,4,5,6,7].map(d=>`
    <div class="elite-day ${alreadyClaimed ? 'disabled' : ''}"
         ${alreadyClaimed ? '' : `onclick="openDailyScan(${d})"`}>
      H${d}
    </div>
  `).join("")}
</div>

        </div>

      </div>
    `;
/* =============================
   DAILY SUCCESS EFFECT
============================= */
const params = new URLSearchParams(window.location.search);

if(params.get("dailySuccess")){
  startCoinRain();

  // bersihkan query supaya tidak trigger ulang saat refresh
  window.history.replaceState({}, document.title, "index.html");
}
    /* =============================
       INSERT MEMBER CARD
    ============================= */
    const homeCardContainer = document.getElementById("homeMemberCard");
    if(homeCardContainer){
      homeCardContainer.innerHTML = renderMemberCard(userData);
    }

    /* =============================
       RENDER UNREAD PREVIEW
    ============================= */
    const scroll = document.getElementById("homeUnreadScroll");

    if (scroll) {

      scroll.innerHTML = "";

      for (const room of unreadRooms.slice(0,5)) {

        const otherUid = room.participants.find(p => p !== user.uid);
        let username = "User";

        if (otherUid) {
          const otherSnap = await getDoc(doc(db,"users",otherUid));
          if (otherSnap.exists()) {
            username = otherSnap.data().username || "User";
          }
        }

        const item = document.createElement("div");
        item.className = "home-unread-item";

        item.innerHTML = `
          <div class="unread-name">${username}</div>
          <div class="unread-text">${room.lastMessage || ""}</div>
        `;

        item.onclick = ()=>{
          window.renderChatUI(room.id, otherUid);
        };

        scroll.appendChild(item);
      }
    }

    /* =============================
       TOGGLE SALDO
    ============================= */
    let saldoVisible = false;

    const toggleBtn = document.getElementById("toggleSaldoBtn");
    const walletAmountEl = document.getElementById("walletAmount");

    if(toggleBtn){
      toggleBtn.onclick = ()=>{
        saldoVisible = !saldoVisible;

        walletAmountEl.innerText =
          saldoVisible
            ? `Rp ${balance.toLocaleString("id-ID")}`
            : "Rp ******";

        toggleBtn.innerHTML =
          saldoVisible ? eyeCloseSVG() : eyeOpenSVG();
      };
    }

    /* =============================
       HOME TOP UP BUTTON
    ============================= */
    const homeTopupBtn = document.querySelector(".wallet-topup-btn");

    if(homeTopupBtn){
      homeTopupBtn.onclick = async ()=>{
        const module = await import("./wallet.js");
        module.renderTopUpSheet();
      };
    }
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

  const todayNow = new Date().toISOString().split("T")[0];
  const claimed = data.lastCheckinDate === todayNow;

  document.querySelectorAll(".elite-day").forEach(el=>{
    if(claimed){
      el.classList.add("disabled");
    }else{
      el.classList.remove("disabled");
    }
  });

});
    /* =============================
       START COUNTDOWN
    ============================= */
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

function startCoinRain(){
  for(let i=0;i<25;i++){
    const coin = document.createElement("div");
    coin.className = "coin";
    document.body.appendChild(coin);

    coin.style.left = Math.random()*100+"vw";
    coin.style.animationDuration = (Math.random()*2+2)+"s";

    setTimeout(()=>coin.remove(),3000);
  }
}
/* =========================================
   SVG ICON
========================================= */
function eyeOpenSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
  <circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeCloseSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-7.94"/>
  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-2.06 3.19"/>
  <path d="M1 1l22 22"/></svg>`;
}

/* =========================================
   COUNTDOWN ENGINE (SAFE)
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
  window.location.href = "scanDaily.html";
}
