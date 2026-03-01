import {
  STORE_PRODUCTS,
  STORE_REWARDS
} from "./store-data.js";

import { auth, db } from "../firebase.js";

import {
  doc,
  runTransaction,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
   FLASH DROP (FIRESTORE DRIVEN)
================================= */
async function renderFlash(){

  const flashSection = document.getElementById("flashSection");
  const container = document.getElementById("storeFlash");

  flashSection.style.display = "block";
  container.innerHTML = "";

  // 🔥 ambil semua flash dari Firestore
  const snap = await fetchFlashDrops();
  if (!snap.length){
    container.innerHTML = "<p>Tidak ada flash aktif.</p>";
    return;
  }

  snap.forEach(flash => {

    const remaining = flash.quota - flash.redeemedCount;

    container.innerHTML += `
      <div class="store-card flash-card">

        <div class="card-body">
          <span class="badge flash">FLASH</span>

          <h3>${flash.name}</h3>

          <div class="card-info">
            <span class="price gp">
              ${flash.flashPointCost.toLocaleString()} GP
            </span>
            <span class="stock">
              Remaining: ${remaining}
            </span>
          </div>

          <div 
            class="countdown"
            data-start="${flash.startTime.toDate()}"
            data-end="${flash.endTime.toDate()}"
            data-id="${flash.id}">
          </div>

          <button 
            class="btn-flash redeem-btn"
            data-id="${flash.id}"
            onclick="redeemFlash('${flash.id}')">
            Redeem Now
          </button>

        </div>
      </div>
    `;
  });

  startCountdown();
}


/* ===============================
   FETCH FLASH FROM FIRESTORE
================================= */
async function fetchFlashDrops(){

  const { collection, getDocs } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const snap = await getDocs(collection(db, "flashDrops"));

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(f => f.active);
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

    const interval = setInterval(() => {

      const now = new Date();

      let target;
      let label;
      let enable = false;

      if(now < startTime){
        target = startTime;
        label = "Voucher bisa diredeem dalam";
      }
      else if(now >= startTime && now <= endTime){
        target = endTime;
        label = "Voucher bisa diredeem";
        enable = true;
      }
      else{
        timer.innerHTML = `<div class="cd-label">Flash telah berakhir</div>`;
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

      timer.innerHTML = `
        <div class="cd-label">${label}</div>
        <div class="cd-time">
          ${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}
        </div>
      `;

      if(button) button.disabled = !enable;

    }, 1000);

  });
}


/* ===============================
   REDEEM ENGINE (WAR SAFE)
================================= */
async function redeemFlash(flashId){

  const user = auth.currentUser;
  if(!user) return alert("Login required.");

  const flashRef = doc(db, "flashDrops", flashId);
  const userRef  = doc(db, "users", user.uid);

  const button = document.querySelector(`.redeem-btn[data-id="${flashId}"]`);
  if(button) button.disabled = true;

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

      if(flash.redeemedCount >= flash.quota)
        throw "Quota habis";

      if(userData.gpoints < flash.flashPointCost)
        throw "GPoints tidak cukup";

      if(flash.winners?.includes(user.uid))
        throw "Sudah redeem";

      transaction.update(userRef, {
        gpoints: userData.gpoints - flash.flashPointCost
      });

      transaction.update(flashRef, {
        redeemedCount: flash.redeemedCount + 1,
        winners: arrayUnion(user.uid)
      });

    });

    alert("🔥 Kamu berhasil redeem!");

  }catch(err){
    console.log(err);
    alert("Kalah war atau quota habis.");
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
