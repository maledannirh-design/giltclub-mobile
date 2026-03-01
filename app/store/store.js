import {
  STORE_PRODUCTS,
  STORE_REWARDS
} from "./store-data.js";

import { auth, db } from "../firebase.js";

import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
  runTransaction,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FLASH_BASE_IMAGE_URL =
  "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/store/products/";

// 🔒 GLOBAL GUARD (taruh sekali saja di atas file)
let isRedeeming = false;
/* ===============================
   MAIN ENTRY
================================= */
export async function renderStore() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="store-page">

      <section id="flashSection">
        <h2 class="section-title">Flash Drop</h2>
        <div id="storeFlash" class="store-grid"></div>
      </section>

      <section>
        <h2 class="section-title">Merchandise</h2>
        <div id="storeProducts" class="store-grid"></div>
      </section>

      <section>
        <h2 class="section-title">Redeem Rewards</h2>
        <div id="storeRewards" class="store-grid"></div>
      </section>

      <div id="sizeModal" class="size-modal"></div>

    </div>
  `;

  renderProducts();
  renderRewards();
  renderFlash();
}


/* ===============================
   PRODUCTS
================================= */
function renderProducts(){

  const container = document.getElementById("storeProducts");
  container.innerHTML = "";

  STORE_PRODUCTS
    .filter(p => p.active)
    .forEach(product => {

      const soldOut = product.stock <= 0;

      container.innerHTML += `
        <div class="store-card">
          <div class="card-image">
            <img src="${product.image}">
          </div>
          <div class="card-body">
            <h3>${product.name}</h3>
            <div class="card-info">
              <span class="price">
                Rp ${product.price.toLocaleString()}
              </span>
              <span class="stock">
                ${soldOut ? "Sold Out" : `Stock: ${product.stock}`}
              </span>
            </div>
            ${
              soldOut
              ? `<button disabled>Unavailable</button>`
              : `<button class="btn-primary" onclick="openSizeModal('${product.id}')">Select Size</button>`
            }
          </div>
        </div>
      `;
    });
}


/* ===============================
   REWARDS
================================= */
function renderRewards(){

  const container = document.getElementById("storeRewards");
  container.innerHTML = "";

  STORE_REWARDS
    .filter(r => r.active)
    .forEach(reward => {

      const remaining = reward.quota - reward.redeemedCount;
      const soldOut = remaining <= 0;

      container.innerHTML += `
        <div class="store-card">
          <div class="card-body">
            <h3>${reward.name}</h3>
            <div class="card-info">
              <span class="price gp">
                ${reward.pointCost.toLocaleString()} GP
              </span>
              <span class="stock">
                Remaining: ${remaining}
              </span>
            </div>
            ${
              soldOut
              ? `<button disabled>Sold Out</button>`
              : `<button class="btn-gp">Redeem</button>`
            }
          </div>
        </div>
      `;
    });
}


/* ===============================
   FLASH DROP (ALWAYS SHOW + REALTIME)
================================= */
/* ===============================
   FLASH DROP (REALTIME + WINNER BANNER)
================================= */
function renderFlash(){

  const container = document.getElementById("storeFlash");
  if(!container) return;

  const q = query(
    collection(db,"flashDrops"),
    where("active","==",true)
  );

  onSnapshot(q, async (snapshot)=>{

    container.innerHTML = "";

    if(snapshot.empty){
      container.innerHTML = `
        <div style="opacity:.6;padding:10px;">
          Tidak ada flash aktif.
        </div>
      `;
      return;
    }

    for(const docSnap of snapshot.docs){

      const flash = { id: docSnap.id, ...docSnap.data() };
      const remaining = Math.max(0, flash.quota - flash.redeemedCount);

      const imageUrl = flash.image
        ? FLASH_BASE_IMAGE_URL + flash.image
        : "";

      const now = new Date();
      const startTime = flash.startTime.toDate();
      checkAndStartWarOverlay(startTime);
      const endTime   = flash.endTime.toDate();

      const canRedeem =
        flash.active &&
        now >= startTime &&
        now <= endTime &&
        remaining > 0;

      /* ===============================
         🔥 WINNER POP OUT LOGIC
      =============================== */

      let winnerBannerHTML = "";

      if(flash.winners && flash.winners.length > 0){

        const lastWinner = flash.winners
          .sort((a,b)=>b.time - a.time)[0];

        try{
          const userSnap = await getDoc(doc(db,"users",lastWinner.uid));
          if(userSnap.exists()){
            const username = userSnap.data().username || "Unknown";
            winnerBannerHTML = `
              <div class="winner-banner">
                🏆 WINNER: @${username}
              </div>
            `;
          }
        }catch(e){
          console.log("Winner fetch error:",e);
        }
      }

      container.innerHTML += `
        <div class="store-card flash-card ${remaining<=0?'sold-out':''}">

          ${winnerBannerHTML}

          <div class="card-image">
            ${imageUrl 
              ? `<img src="${imageUrl}" alt="flash-image">`
              : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;opacity:.5;">
                   No Image
                 </div>`
            }
            <span class="badge flash">FLASH</span>
          </div>

          <div class="card-body">

            <h3>${flash.name}</h3>

            <div class="card-info">
              <span class="price gp">
                ${flash.flashPointCost.toLocaleString()} GP
              </span>
              <span class="stock">
                ${remaining > 0 ? `Remaining: ${remaining}` : "Sold Out"}
              </span>
            </div>

            <div 
              class="countdown"
              data-start="${startTime}"
              data-end="${endTime}"
              data-id="${flash.id}">
            </div>

            <button 
              class="btn-flash redeem-btn"
              data-id="${flash.id}"
              onclick="redeemFlash('${flash.id}')"
              ${!canRedeem ? "disabled" : ""}>
              ${remaining <= 0 ? "Sold Out" : "Redeem"}
            </button>

            <div class="leaderboard">
              ${renderLeaderboardHTML(flash)}
            </div>

          </div>
        </div>
      `;
    }

    startCountdown();
  });
}

/* ===============================
   FORMAT WITA DATE
================================= */
function formatWitaDate(date){

  return date.toLocaleString("id-ID",{
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WITA";
}


/* ===============================
   LEADERBOARD
================================= */
function renderLeaderboardHTML(flash){

  if(!flash.winners || flash.winners.length === 0){
    return "";
  }

  const sorted = [...flash.winners]
    .sort((a,b)=>a.time - b.time)
    .slice(0,5);

  return `
    <div class="leader-title">Top Winners</div>
    ${sorted.map((w,i)=>`
      <div class="leader-item">
        ${i+1}. ${w.uid.substring(0,6)}...
      </div>
    `).join("")}
  `;
}


/* ===============================
   COUNTDOWN ENGINE (2 MODE)
================================= */
function startCountdown(){

  const timers = document.querySelectorAll(".countdown");

  timers.forEach(timer => {

    const startTime = new Date(timer.dataset.start);
    const endTime   = new Date(timer.dataset.end);
    const flashId   = timer.dataset.id;
    const button    = document.querySelector(`.redeem-btn[data-id="${flashId}"]`);
    const card      = timer.closest(".store-card");

    const interval = setInterval(() => {

      const now = new Date();

      let target;
      let enable = false;
      let label = "";

      if(now < startTime){
        target = startTime;
        label = "Live dalam:";
        card.classList.remove("live");
      }
      else if(now >= startTime && now <= endTime){
        target = endTime;
        label = "Berakhir dalam:";
        enable = true;
        card.classList.add("live"); // 🔥 glow live
      }
      else{
        timer.innerHTML = "Flash telah berakhir";
        card.classList.remove("live");
        if(button) button.disabled = true;
        clearInterval(interval);
        return;
      }

      const diff = target - now;
      const totalSeconds = Math.floor(diff / 1000);

      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = n => n.toString().padStart(2, "0");

      let timeString;

      if(days > 0){
        timeString = `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }else{
        timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }

      // 🔥 Last 10 seconds blink
      const dangerClass = totalSeconds <= 10 ? "blink" : "";

      timer.innerHTML = `
        <div class="cd-label">${label}</div>
        <div class="cd-time ${dangerClass}">${timeString}</div>
      `;

      if(button) button.disabled = !enable;

    }, 1000);
  });
}
function showConfetti(){

  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({length:150}).map(()=>({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height - canvas.height,
    r: Math.random()*6+4,
    d: Math.random()*canvas.height,
    color: `hsl(${Math.random()*360},100%,50%)`
  }));

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2,false);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    update();
  }

  function update(){
    pieces.forEach(p=>{
      p.y += 4;
      if(p.y > canvas.height){
        p.y = -10;
      }
    });
  }

  const interval = setInterval(draw,20);

  setTimeout(()=>{
    clearInterval(interval);
    canvas.remove();
  },3000);
}

/* ===============================
   FLOATING WAR COUNTDOWN (30s)
================================= */
let warOverlayActive = false;

function checkAndStartWarOverlay(startTime){

  if(warOverlayActive) return;

  const now = new Date();
  const diffMs = startTime - now;
  const diffSec = Math.floor(diffMs / 1000);

  if(diffSec > 30 || diffSec <= 0) return;

  warOverlayActive = true;

  const overlay = document.createElement("div");
  overlay.id = "warOverlay";
  overlay.innerHTML = `<div id="warNumber">${diffSec}</div>`;
  document.body.appendChild(overlay);

  let current = diffSec;

  const interval = setInterval(()=>{

    current--;

    const numberEl = document.getElementById("warNumber");
    if(!numberEl){
      clearInterval(interval);
      warOverlayActive = false;
      return;
    }

    if(current > 0){
      numberEl.innerText = current;
    }
    else if(current === 0){
      numberEl.innerText = "GO!";
      setTimeout(()=>{
        overlay.remove();
        warOverlayActive = false;
      },500);
    }
    else{
      clearInterval(interval);
    }

  },1000);
}
/* ===============================
   LOSE ANIMATION
================================= */
function showLoseAnimation(seconds){

  const div = document.createElement("div");
  div.className = "lose-overlay";
  div.innerHTML = `
    <div class="lose-box">
      <h2>Kalah War 😢</h2>
      <p>Kamu kalah ${seconds} detik.</p>
    </div>
  `;

  document.body.appendChild(div);
  setTimeout(()=> div.remove(), 2500);
}


/* ===============================
   REDEEM ENGINE (WAR SAFE FINAL + FAIR TIMESTAMP)
================================= */
async function redeemFlash(flashId){

  if(isRedeeming) return;
  isRedeeming = true;

  const user = auth.currentUser;
  if(!user){
    isRedeeming = false;
    return alert("Login required.");
  }

  const flashRef = doc(db, "flashDrops", flashId);
  const userRef  = doc(db, "users", user.uid);
  const userLedgerRef = doc(collection(db, "users", user.uid, "gpointLedger"));

  const button = document.querySelector(`.redeem-btn[data-id="${flashId}"]`);
  if(button) button.disabled = true;

  const clickStart = performance.now();

  try{

    await runTransaction(db, async (transaction) => {

      const flashSnap = await transaction.get(flashRef);
      const userSnap  = await transaction.get(userRef);

      if(!flashSnap.exists()) throw "Flash tidak ditemukan";
      if(!userSnap.exists()) throw "User tidak ditemukan";

      const flash = flashSnap.data();
      const userData = userSnap.data();

      const now = new Date();

      if(!flash.active) throw "Flash tidak aktif";
      if(now < flash.startTime.toDate()) throw "Belum mulai";
      if(now > flash.endTime.toDate()) throw "Sudah berakhir";
      if(flash.redeemedCount >= flash.quota) throw "Quota habis";
      if(!userData.gPoint || userData.gPoint < flash.flashPointCost) throw "GPoint tidak cukup";
      if(flash.winners?.some(w => w.uid === user.uid)) throw "Sudah redeem";

      const beforeBalance = userData.gPoint;
      const afterBalance  = beforeBalance - flash.flashPointCost;

      // 1️⃣ Update GPoint
      transaction.update(userRef,{
        gPoint: afterBalance,
        gPointLastUpdated: serverTimestamp()
      });

      // 2️⃣ Update Flash (server timestamp for fairness)
      transaction.update(flashRef,{
        redeemedCount: flash.redeemedCount + 1,
        winners: arrayUnion({
          uid: user.uid,
          time: serverTimestamp()
        })
      });

      // 3️⃣ Ledger Entry
      transaction.set(userLedgerRef,{
        type: "flash_redeem",
        referenceId: flashId,
        amount: -flash.flashPointCost,
        balanceBefore: beforeBalance,
        balanceAfter: afterBalance,
        createdAt: serverTimestamp(),
        description: "Flash Redeem"
      });

    });

    showConfetti();
    setTimeout(()=>{
      alert("🔥 Kamu berhasil redeem!");
    },500);

  }catch(err){

    const clickEnd = performance.now();
    const diff = ((clickEnd - clickStart)/1000).toFixed(2);
    showLoseAnimation(diff);

  }finally{
    isRedeeming = false;
    if(button) button.disabled = false;
  }
}

/* ===============================
   SIZE MODAL
================================= */
window.openSizeModal = function(productId){

  const product = STORE_PRODUCTS.find(p => p.id === productId);
  const modal = document.getElementById("sizeModal");

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Select Size</h3>
      <div class="size-options">
        ${product.sizes.map(s => `<button>${s}</button>`).join("")}
      </div>
      <button class="close-modal" onclick="closeModal()">Cancel</button>
    </div>
  `;

  modal.style.display = "flex";
}

window.closeModal = function(){
  document.getElementById("sizeModal").style.display = "none";
}

window.redeemFlash = redeemFlash;
