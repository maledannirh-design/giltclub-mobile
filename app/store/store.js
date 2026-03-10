import {
  STORE_PRODUCTS
} from "./store-data.js";

import { auth, db } from "../firebase.js";
import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
  runTransaction,
  arrayUnion,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  increment,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  requestTransactionPin,
  validateTransactionPin
} from "../pinTrx.js";

import { applyMutation } from "../services/mutationService.js";

const FLASH_BASE_IMAGE_URL =
  "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/store/products/";

// 🔒 GLOBAL GUARD
let isRedeeming = false;
let inboxBadgeWatcherStarted = false;

// 🔥 WAR STATE
let warOverlayActive = false;
let warWatcherStarted = false;
let currentFlashList = [];

let productsWatcher = null;

/* ===============================
   MAIN ENTRY
================================= */
export async function renderStore() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
 <div class="gilt-store-banner">

  <div class="gilt-store-title">
    GILT STORE
  </div>

  <div class="store-menu">

    <div class="store-menu-item" onclick="openStoreInbox()">
      <div class="menu-icon">📦</div>
      <div class="menu-label">Inbox</div>
    </div>

    <div class="store-menu-item" onclick="openRedeemPage()">
      <div class="menu-icon">🎁</div>
      <div class="menu-label">Tukar GP</div>
    </div>

    <div class="store-menu-item" onclick="openCartCheckout()">

  <div class="menu-icon" style="position:relative;">
    🛒
    <span id="cartBadge" class="inbox-badge hidden"></span>
  </div>

  <div class="menu-label">Checkout</div>

</div>

    <div class="store-menu-item" onclick="openMyStore()">
      <div class="menu-icon">🏪</div>
      <div class="menu-label">Toko Saya</div>
    </div>

  </div>

</div>

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

<!-- STORE APPLICATION -->
<div id="storeApplicationSheet" class="store-sheet hidden"></div>

<!-- FLASH IMAGE MODAL -->
<div id="flashImageModal" class="flash-image-modal hidden">
  <div class="flash-image-bg" onclick="closeFlashImage()"></div>
  <img id="flashImagePreview">
</div>

<!-- CART DRAWER -->
<div id="cartDrawer" class="cart-drawer hidden">

  <div class="cart-backdrop" onclick="closeCartDrawer()"></div>

  <div class="cart-panel">

    <div class="cart-header">
      <h3>Cart</h3>
      <span onclick="closeCartDrawer()">✕</span>
    </div>

    <div id="cartDrawerContent"></div>

  </div>

</div>
`;

  renderProducts();
  renderRewards();
  renderFlash();
  checkStoreApplication();
  watchInboxBadge();
  updateCartBadge();
}

async function checkStoreApplication(){

  const user = auth.currentUser;
  if(!user) return;

  try{

    const q = query(
      collection(db,"storeApplications"),
      where("uid","==",user.uid)
    );

    const snap = await getDocs(q);

    if(!snap.empty){

      const banner = document.querySelector(".gilt-store-right");

      if(banner){
        banner.innerText = "Pengajuan terkirim";
        banner.style.opacity = "0.6";
        banner.onclick = null;
      }

    }

  }catch(err){
    console.error(err);
  }

}

/* ===============================
   PRODUCTS
================================= */
function renderProducts(){

  const container = document.getElementById("storeProducts");
  if(!container) return;

  container.innerHTML = "Loading...";

  // stop old listener jika ada
  if(productsWatcher){
    productsWatcher();
    productsWatcher = null;
  }

  const q = query(
    collection(db,"products"),
    where("active","==",true)
  );

  productsWatcher = onSnapshot(q,(snapshot)=>{

    container.innerHTML = "";

    if(snapshot.empty){
      container.innerHTML =
        "<div style='opacity:.6'>Belum ada product.</div>";
      return;
    }

    snapshot.forEach(docSnap=>{

      const p = docSnap.data();

      const normal = Number(p.normalPrice || 0);
      const discount = Number(p.discountPrice || 0);

      const finalPrice =
        discount > 0 ? discount : normal;

      const discountPercent =
        discount > 0
          ? Math.round((1 - discount/normal)*100)
          : 0;

      let stock = 0;

      if(p.sizeEnabled && p.sizes){

        Object.values(p.sizes).forEach(v=>{
          stock += Number(v || 0);
        });

      }else{

        stock = Number(p.stock || 0);

      }

      const soldOut = stock <= 0;

      const priceHTML = `

        <div class="flash-price">

          ${
            discount > 0
            ? `<div class="price-normal">
                Rp ${normal.toLocaleString()}
               </div>`
            : ""
          }

          <div class="price-flash">
            Rp ${finalPrice.toLocaleString()}
          </div>

          ${
            discountPercent > 0
            ? `<div class="flash-discount">
                 -${discountPercent}%
               </div>`
            : ""
          }

        </div>
      `;

      container.innerHTML += `

        <div class="store-card">

          <!-- IMAGE PREVIEW -->
          <div class="card-image"
               ${p.image ? `onclick="openImagePreview('${FLASH_BASE_IMAGE_URL}${p.image}')"` : ""}>

            ${
              p.image
              ? `<img src="${FLASH_BASE_IMAGE_URL}${p.image}" loading="lazy">`
              : `<div style="
                    height:100%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:12px;
                    opacity:.5;">
                   No Image
                 </div>`
            }

          </div>

          <div class="card-body">

            <h3>${p.name}</h3>

            ${priceHTML}

            <div class="card-info">

              <span class="stock">
                ${
                  soldOut
                  ? "Sold Out"
                  : `Stock: ${stock}`
                }
              </span>

            </div>

            ${
              soldOut
              ? `<button disabled>
                   Sold Out
                 </button>`
              : `<button class="btn-primary"
                         onclick="openProductSelector('${docSnap.id}')">
                   Add To Cart
                 </button>`
            }

          </div>

        </div>

      `;

    });

  });

}

// ===============================
// CART ENGINE
// ===============================

let cartItems = JSON.parse(
  localStorage.getItem("storeCart") || "[]"
);

function saveCart(){
  localStorage.setItem(
    "storeCart",
    JSON.stringify(cartItems)
  );
  updateCartBadge();
}

function updateCartBadge(){

  const badge =
    document.getElementById("cartBadge");

  if(!badge) return;

  let total = 0;

  cartItems.forEach(i=>{
    total += Number(i.qty || 0);
  });

  if(total > 0){
    badge.innerText = total;
    badge.classList.remove("hidden");
  }else{
    badge.classList.add("hidden");
  }

}


// ===============================
// PRODUCT SELECTOR MODAL
// ===============================

window.openProductSelector = async function(productId){

  const snap =
    await getDoc(doc(db,"products",productId));

  if(!snap.exists()) return;

  const p = snap.data();

  const normal = Number(p.normalPrice || 0);
  const discount = Number(p.discountPrice || 0);

  const price =
    discount > 0 ? discount : normal;

  const modal = document.createElement("div");
  modal.className = "reward-confirm-modal";

  let sizeHTML = "";

  if(p.sizeEnabled && p.sizes){

    sizeHTML += `<label>Select Size</label>`;

    Object.keys(p.sizes).forEach(s=>{

      const qty = Number(p.sizes[s] || 0);

      sizeHTML += `
        <button class="size-btn"
          data-size="${s}"
          ${qty<=0?"disabled":""}>
          ${s}
          (${qty})
        </button>
      `;

    });

  }else{

    sizeHTML =
      `<div style="margin:10px 0;">All Size</div>`;

  }

  modal.innerHTML = `

    <div class="reward-confirm-bg"
         onclick="this.parentElement.remove()"></div>

    <div class="reward-confirm-box">

      <h3>${p.name}</h3>

      <img src="${FLASH_BASE_IMAGE_URL}${p.image}"
           style="width:100%;border-radius:10px;margin-bottom:10px;">

      <div style="margin-bottom:10px;">

        ${
          discount>0
          ? `<div style="text-decoration:line-through;opacity:.6">
               Rp ${normal.toLocaleString()}
             </div>`
          : ""
        }

        <div style="font-weight:700;font-size:18px;">
          Rp ${price.toLocaleString()}
        </div>

      </div>

      ${sizeHTML}

      <label style="margin-top:12px;">Qty</label>

      <input id="cartQty"
             type="number"
             value="1"
             min="1"
             style="width:100%;padding:8px;border-radius:8px;">

      <div class="reward-actions">

        <button class="btn-cancel"
          onclick="this.closest('.reward-confirm-modal').remove()">
          Cancel
        </button>

        <button class="btn-redeem"
          id="addCartBtn">
          Add To Cart
        </button>

      </div>

    </div>

  `;

  document.body.appendChild(modal);

  let selectedSize = null;

  document.querySelectorAll(".size-btn")
    .forEach(btn=>{

      btn.onclick = ()=>{

        document
          .querySelectorAll(".size-btn")
          .forEach(b=>b.classList.remove("active"));

        btn.classList.add("active");

        selectedSize = btn.dataset.size;

      };

    });


  document.getElementById("addCartBtn")
    .onclick = ()=>{

      const qty =
        Number(document.getElementById("cartQty").value);

      if(p.sizeEnabled && !selectedSize){
        alert("Pilih size terlebih dahulu");
        return;
      }

      addToCart({
        productId,
        name:p.name,
        image:p.image,
        size:selectedSize,
        qty,
        price
      });

      modal.remove();

    };

};



// ===============================
// ADD TO CART
// ===============================

function addToCart(item){

  const existing =
    cartItems.find(i=>
      i.productId===item.productId &&
      i.size===item.size
    );

  if(existing){

    existing.qty += item.qty;

  }else{

    cartItems.push(item);

  }

  saveCart();

  showToast("Item added to cart");

}
/* ===============================
   REWARDS
================================= */

async function renderRewards(){

  const container = document.getElementById("storeRewards");
  if(!container) return;

  container.innerHTML = "";

  try{

    const snap = await getDocs(collection(db,"rewards"));

    if(snap.empty){

      container.innerHTML = `
        <div style="opacity:.6;padding:20px;">
          Belum ada reward.
        </div>
      `;

      return;
    }

    snap.forEach(docSnap=>{

      const reward = docSnap.data();
      const rewardId = docSnap.id;

      const quota = Number(reward.quota || 0);
      const redeemed = Number(reward.redeemedCount || 0);
      const remaining = quota - redeemed;

      const soldOut = remaining <= 0;

      const pointCost = Number(reward.pointCost || 0);

      const imageUrl =
        reward.image
        ? `/app/store/products/${reward.image}`
        : null;

      container.innerHTML += `

        <div class="store-card reward-card">

          <!-- IMAGE PREVIEW -->
          <div class="card-image"
               ${imageUrl ? `onclick="openImagePreview('${imageUrl}')"` : ""}>

            ${
              imageUrl
              ? `<img src="${imageUrl}" loading="lazy">`
              : `<div class="no-image">No Image</div>`
            }

          </div>

          <div class="card-body">

            <h3>${reward.name || "Reward"}</h3>

            <div class="card-info">

              <span class="price gp">
                ${pointCost.toLocaleString()} GP
              </span>

              <span class="stock">
                ${
                  soldOut
                  ? "Sold Out"
                  : `Remaining: ${remaining}`
                }
              </span>

            </div>

            ${
              soldOut
              ? `<button disabled>Sold Out</button>`
              : `<button class="btn-gp"
                        onclick="openRewardConfirm('${rewardId}')">
                        Redeem
                 </button>`
            }

          </div>

        </div>

      `;

    });

  }catch(err){

    console.error("Render rewards error:", err);

    container.innerHTML = `
      <div style="color:red;padding:20px;">
        Gagal memuat rewards.
      </div>
    `;

  }

}
/* ===============================
   FLASH DROP
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

    currentFlashList = snapshot.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a,b)=>{
    const at = a.startTime?.toMillis ? a.startTime.toMillis() : 0;
    const bt = b.startTime?.toMillis ? b.startTime.toMillis() : 0;
    return bt - at; // flash terbaru di atas
  });
    startWarWatcher();

    for(const flash of currentFlashList){

      const remaining = Math.max(0, flash.quota - flash.redeemedCount);

      const imageUrl = flash.image
        ? FLASH_BASE_IMAGE_URL + flash.image
        : "";

      const now = new Date();
      const startTime = flash.startTime.toDate();
      const endTime   = flash.endTime.toDate();

      const canRedeem =
        flash.active &&
        now >= startTime &&
        now <= endTime &&
        remaining > 0;

      /* ===============================
         FLASH PRICE CALCULATION
      ================================= */

      const normalPrice =
        flash.normalPointCost || flash.flashPointCost;

      const flashPrice =
        flash.flashPointCost;

      const discount =
        normalPrice > flashPrice
          ? Math.round((1 - flashPrice / normalPrice) * 100)
          : 0;

      const priceHTML = `
        <div class="flash-price">

          ${
            discount > 0
            ? `<div class="price-normal">
                 ${normalPrice.toLocaleString()} GP
               </div>`
            : ``
          }

          <div class="price-flash">
            ${flashPrice.toLocaleString()} GP
          </div>

          ${
            discount > 0
            ? `<div class="flash-discount">
                 -${discount}%
               </div>`
            : ``
          }

        </div>
      `;

      /* ===============================
         WINNER BANNER
      ================================= */

      let winnerBannerHTML = "";

      if(flash.winners && flash.winners.length > 0){

        const sorted = [...flash.winners]
          .sort((a,b)=>{
            const at = a.time?.toMillis ? a.time.toMillis() : 0;
            const bt = b.time?.toMillis ? b.time.toMillis() : 0;
            return bt - at;
          });

        const lastWinner = sorted[0];

        try{

          const userSnap =
            await getDoc(doc(db,"users",lastWinner.uid));

          if(userSnap.exists()){

            const username =
              userSnap.data().username || "Unknown";

            winnerBannerHTML = `
              <div class="winner-banner">
                🏆 WINNER: @${username}
              </div>
            `;

          }

        }catch(e){}
      }

      /* ===============================
         FLASH CARD
      ================================= */

      container.innerHTML += `
        <div class="store-card flash-card ${remaining<=0?'sold-out':''}">

          ${winnerBannerHTML}

          <div class="card-image">

            ${
              imageUrl
              ? `<img src="${imageUrl}" alt="flash-image"
                     onclick="openFlashImage('${imageUrl}')">`
              : `<div style="
                    height:100%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:12px;
                    opacity:.5;">
                   No Image
                 </div>`
            }

            <span class="badge flash">FLASH</span>

          </div>

          <div class="card-body">

            <h3>${flash.name}</h3>

            ${priceHTML}

            <div class="card-info">

              <span class="stock">
                ${remaining > 0
                  ? `Remaining: ${remaining}`
                  : "Sold Out"}
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

            <div class="leaderboard" id="leader-${flash.id}">
            </div>

          </div>

        </div>
      `;

      const leaderboardContainer =
        document.getElementById(`leader-${flash.id}`);

      if(leaderboardContainer){
        leaderboardContainer.innerHTML =
          await renderLeaderboardHTML(flash);
      }

    }

    startCountdown();

  });
}
/* ===============================
   WAR WATCHER (STABLE 30 DETIK)
================================= */
function startWarWatcher(){

  if(warWatcherStarted) return;
  warWatcherStarted = true;

  setInterval(()=>{

    currentFlashList.forEach(flash=>{
      const startTime = flash.startTime.toDate();
      checkAndStartWarOverlay(startTime);
    });

  },1000);
}

/* ===============================
   FLOATING WAR COUNTDOWN
================================= */
function checkAndStartWarOverlay(startTime){

  if(warOverlayActive) return;

  const now = new Date();
  const diffSec = Math.floor((startTime - now)/1000);

  if(diffSec > 30 || diffSec <= 0) return;

  warOverlayActive = true;

  const overlay = document.createElement("div");
  overlay.id = "warOverlay";
  overlay.innerHTML = `<div id="warNumber">${diffSec}</div>`;
  document.body.appendChild(overlay);

  let current = diffSec;

  const interval = setInterval(()=>{

    current--;

    const el = document.getElementById("warNumber");
    if(!el){
      clearInterval(interval);
      warOverlayActive = false;
      return;
    }

    if(current > 0){
      el.innerText = current;
    }
    else if(current === 0){
      el.innerText = "GO!";
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
   FLASH REDEEM ENGINE (FINAL)
================================= */

async function redeemFlash(flashId){

  if(isRedeeming) return;
  isRedeeming = true;

  const user = auth.currentUser;

  if(!user){
    isRedeeming = false;
    return alert("Login required.");
  }

  const flashRef = doc(db,"flashDrops",flashId);

  const button =
    document.querySelector(`.redeem-btn[data-id="${flashId}"]`);

  if(button) button.disabled = true;

  try{

    const flashSnap = await getDoc(flashRef);

    if(!flashSnap.exists())
      throw "Flash tidak ditemukan";

    const flash = flashSnap.data();

    const now = new Date();

    if(!flash.active)
      throw "Flash tidak aktif";

    if(now < flash.startTime.toDate())
      throw "Belum mulai";

    if(now > flash.endTime.toDate())
      throw "Sudah berakhir";

    if((flash.redeemedCount || 0) >= flash.quota)
      throw "Quota habis";

    /* ==========================
       POTONG GP (LEDGER ENGINE)
    ========================== */

    await applyMutation({

      userId: user.uid,
      asset: "GPOINT",
      mutationType: "FLASH_REDEEM",
      amount: -flash.flashPointCost,
      referenceId: flashId,
      description: flash.name

    });

    /* ==========================
       UPDATE FLASH
    ========================== */

    await runTransaction(db, async (transaction)=>{

      const snap = await transaction.get(flashRef);

      if(!snap.exists())
        throw "Flash tidak ditemukan";

      const data = snap.data();

      if((data.redeemedCount || 0) >= data.quota)
        throw "Quota habis";

      const winners = data.winners || [];

      if(winners.some(w => w.uid === user.uid))
        throw "Sudah redeem";

      transaction.update(flashRef,{

        redeemedCount: (data.redeemedCount || 0) + 1,

        winners: [
          ...winners,
          {
            uid:user.uid,
            time: Date.now()
          }
        ]

      });

    });

    /* ==========================
       INBOX ITEM
    ========================== */

    await createInboxItem({

      uid: user.uid,
      type: "voucher",
      source: "flash",
      name: flash.name,
      image: flash.image,
      flashId: flashId,
      expireDays: 365

    });

    /* ==========================
       UI
    ========================== */

    showConfetti();

    showToast("Flash berhasil didapat!");

    setTimeout(()=>{
      renderStore();
    },800);

  }catch(err){

    console.log("FLASH ERROR:", err);
    showToast(err);

  }finally{

    isRedeeming = false;

    if(button) button.disabled = false;

  }

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
   CREATE INBOX ITEM (UNIVERSAL)
================================= */

async function createInboxItem(data){

  try{

    if(!data || !data.uid){
      throw "UID tidak ditemukan untuk inbox item";
    }

    const inboxRef =
      doc(collection(db,"users",data.uid,"storeInbox"));

    /* ==========================
       EXPIRE DATE
    ========================== */

    let expiresAt = null;

    if(data.expireDays){

      const expireDate = new Date();

      expireDate.setDate(
        expireDate.getDate() + Number(data.expireDays)
      );

      expiresAt = Timestamp.fromDate(expireDate);
    }

    /* ==========================
       PAYLOAD
    ========================== */

    const payload = {

      uid: data.uid,

      type: data.type || "voucher",

      source: data.source || "store",

      name: data.name || "Item",

      image: data.image || "",

      productId: data.productId || null,

      flashId: data.flashId || null,

      rewardId: data.rewardId || null,

      sessionId: data.sessionId || null,

      status: "unused",

      createdAt: serverTimestamp(),

      expiresAt: expiresAt

    };

    /* ==========================
       SAVE
    ========================== */

    await setDoc(inboxRef, payload);

  }catch(err){

    console.log("INBOX CREATE ERROR:", err);

  }

}
/* ===============================
   LEADERBOARD (USERNAME BASED)
================================= */
async function renderLeaderboardHTML(flash){

  if(!flash.winners || flash.winners.length === 0){
    return "";
  }

  const sorted = [...flash.winners]
    .sort((a,b)=>{
      const at = a.time?.toMillis ? a.time.toMillis() : 0;
      const bt = b.time?.toMillis ? b.time.toMillis() : 0;
      return at - bt;
    })
    .slice(0,5);

  let html = `<div class="leader-title">Top Winners</div>`;

  for(let i=0;i<sorted.length;i++){

    const winner = sorted[i];

    try{
      const userSnap = await getDoc(doc(db,"users",winner.uid));
      const username = userSnap.exists()
        ? userSnap.data().username
        : "Unknown";

      html += `
        <div class="leader-item">
          ${i+1}. @${username}
        </div>
      `;
    }catch(e){
      html += `
        <div class="leader-item">
          ${i+1}. Unknown
        </div>
      `;
    }
  }

  return html;
}


/* ===============================
   COUNTDOWN ENGINE (LIVE & END + WAR 30s TRIGGER)
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

        // 🔥 WAR OVERLAY TRIGGER (30 → 0)
        const secondsToStart = Math.floor((startTime - now) / 1000);
        if(secondsToStart <= 30 && secondsToStart > 0){
          checkAndStartWarOverlay(startTime);
        }
      }
      else if(now >= startTime && now <= endTime){
        target = endTime;
        label = "Berakhir dalam:";
        enable = true;
        card.classList.add("live");
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

      const dangerClass = totalSeconds <= 10 ? "blink" : "";

      timer.innerHTML = `
        <div class="cd-label">${label}</div>
        <div class="cd-time ${dangerClass}">${timeString}</div>
      `;

      if(button) button.disabled = !enable;

    }, 1000);
  });
}

/* ===============================
   CONFETTI
================================= */
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
    color: `hsl(${Math.random()*360},100%,50%)`
  }));

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2,false);
      ctx.fillStyle = p.color;
      ctx.fill();
      p.y += 4;
      if(p.y > canvas.height) p.y = -10;
    });
  }

  const interval = setInterval(draw,20);

  setTimeout(()=>{
    clearInterval(interval);
    canvas.remove();
  },3000);
}


/* ==============================
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

/* ==============================
  inbox badge
================================= */
async function watchInboxBadge(){

  if(inboxBadgeWatcherStarted) return;
  inboxBadgeWatcherStarted = true;

  const user = auth.currentUser;
  if(!user) return;

  const badge = document.getElementById("inboxBadge");
  if(!badge) return;

  const q = query(
    collection(db,"users",user.uid,"storeInbox"),
    where("status","==","unused")
  );

  onSnapshot(q,(snap)=>{

    const count = snap.size;

    if(count > 0){
      badge.innerText = count;
      badge.classList.remove("hidden");
    }
    else{
      badge.classList.add("hidden");
    }

  });

}

function showToast(message){

  const toast = document.createElement("div");

  toast.className = "app-toast";
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(()=>{
    toast.classList.add("show");
  },50);

  setTimeout(()=>{
    toast.remove();
  },3000);

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

window.openCreateStore = function(){

  const user = auth.currentUser;
  if(!user){
    alert("Login required.");
    return;
  }

  const sheet = document.getElementById("storeApplicationSheet");
  if(!sheet) return;

  sheet.innerHTML = `
  <div class="sheet-backdrop" onclick="closeStoreSheet()"></div>

  <div class="sheet-container">

    <div class="sheet-header">
      <h3>Pengajuan Toko Baru</h3>
    </div>

    <div class="sheet-body">

      <input id="appFullName" placeholder="Nama lengkap">

      <input id="appStoreName" placeholder="Nama toko">

      <textarea id="appAddress" placeholder="Alamat toko / rumah"></textarea>

      <input id="appPhone" placeholder="No. HP toko">

      <label>Jenis toko</label>
      <select id="appStoreType">
        <option value="">Pilih</option>
        <option>Barang</option>
        <option>Jasa Konsultasi</option>
        <option>Counselling</option>
        <option>Sports Coaching</option>
      </select>

      <label>Jenis barang</label>
      <select id="appProductCategory">
        <option value="">Pilih</option>
        <option>FNB</option>
        <option>Apparel</option>
        <option>Alat Masak</option>
        <option>Lainnya</option>
      </select>

      <label>Kondisi produk</label>
      <select id="appCondition">
        <option value="">Pilih</option>
        <option>Baru</option>
        <option>Bekas</option>
        <option>Baru & Bekas</option>
      </select>

      <input id="appProductCount" type="number" placeholder="Perkiraan jumlah produk">

      <input id="appRevenue" placeholder="Perkiraan omzet per bulan">

      <label class="tos-check">
        <input type="checkbox" id="appAgree">
        Saya menyetujui syarat dan ketentuan Club
      </label>

      <button class="btn-primary" onclick="submitStoreApp()">
        Kirim Pengajuan
      </button>

    </div>

  </div>
  `;

  sheet.classList.remove("hidden");
};


window.closeStoreSheet = function(){

  const sheet = document.getElementById("storeApplicationSheet");
  if(!sheet) return;

  sheet.classList.add("hidden");
  sheet.innerHTML = "";

};

window.submitStoreApp = async function(){

  const user = auth.currentUser;
  if(!user){
    alert("Login required.");
    return;
  }

  const name  = document.getElementById("appFullName").value.trim();
  const store = document.getElementById("appStoreName").value.trim();
  const addr  = document.getElementById("appAddress").value.trim();
  const phone = document.getElementById("appPhone").value.trim();

  const storeType = document.getElementById("appStoreType").value;
  const category  = document.getElementById("appProductCategory").value;
  const condition = document.getElementById("appCondition").value;

  const prod  = document.getElementById("appProductCount").value;
  const rev   = document.getElementById("appRevenue").value;

  const agree = document.getElementById("appAgree").checked;

  if(
    !name ||
    !store ||
    !addr ||
    !phone ||
    !storeType ||
    !category ||
    !condition ||
    !prod ||
    !rev
  ){
    alert("Semua field harus diisi.");
    return;
  }

  if(!agree){
    alert("Anda harus menyetujui syarat dan ketentuan.");
    return;
  }

  try{

    const q = query(
      collection(db,"storeApplications"),
      where("uid","==",user.uid)
    );

    const snap = await getDocs(q);

    if(!snap.empty){
      alert("Anda sudah pernah mengajukan toko.");
      return;
    }

    await addDoc(
      collection(db,"storeApplications"),
      {
        uid:user.uid,
        name:name,
        storeName:store,
        address:addr,
        phone:phone,
        storeType:storeType,
        productCategory:category,
        productCondition:condition,
        estimatedProductCount:prod,
        estimatedRevenue:rev,
        status:"pending",
        createdAt:serverTimestamp()
      }
    );

    alert("Pengajuan berhasil dikirim.");

    closeStoreSheet();
    checkStoreApplication();

  }catch(err){

    console.error(err);
    alert("Terjadi kesalahan.");

  }

};


/* ===============================
   REWARD CONFIRM MODAL
================================= */

window.openRewardConfirm = async function(rewardId){

  const snap = await getDoc(doc(db,"rewards",rewardId));
  if(!snap.exists()) return;

  const reward = snap.data();

  const modal = document.createElement("div");
  modal.className = "reward-confirm-modal";

  modal.innerHTML = `

    <div class="reward-confirm-bg"
         onclick="this.parentElement.remove()"></div>

    <div class="reward-confirm-box">

      <h3>${reward.name}</h3>

      <p>
        Anda akan menukar
        <b>${reward.pointCost.toLocaleString()} GP</b>
        untuk item ini.
      </p>

      <div class="reward-actions">

        <button class="btn-cancel"
                onclick="this.closest('.reward-confirm-modal').remove()">
          Batal
        </button>

        <button class="btn-redeem"
                onclick="confirmRewardRedeem('${rewardId}')">
          Redeem
        </button>

      </div>

    </div>

  `;

  document.body.appendChild(modal);

};

/* ===============================
   REDEEM REWARD ENGINE (FINAL)
================================= */

window.confirmRewardRedeem = async function(rewardId){

  const user = auth.currentUser;
  if(!user) return alert("Login required.");

  try{

    /* ==========================
       PIN TRANSACTION
    ========================== */

    const pin = await requestTransactionPin();
    if(!pin) return;

    const checkPin = await validateTransactionPin(user.uid, pin);

    if(!checkPin.valid){
      alert(checkPin.reason);
      return;
    }

    const rewardRef = doc(db,"rewards",rewardId);

    const rewardSnap = await getDoc(rewardRef);

    if(!rewardSnap.exists())
      throw "Reward tidak ditemukan";

    const reward = rewardSnap.data();

    const remaining =
      reward.quota - (reward.redeemedCount || 0);

    if(!reward.active)
      throw "Reward tidak aktif";

    if(remaining <= 0)
      throw "Reward sudah habis";

    /* ==========================
       POTONG GP (LEDGER ENGINE)
    ========================== */

    await applyMutation({

      userId: user.uid,
      asset: "GPOINT",
      mutationType: "REWARD_REDEEM",
      amount: -reward.pointCost,
      referenceId: rewardId,
      description: reward.name

    });

    /* ==========================
       UPDATE QUOTA
    ========================== */

    await runTransaction(db, async (transaction)=>{

      const snap = await transaction.get(rewardRef);

      if(!snap.exists())
        throw "Reward tidak ditemukan";

      const data = snap.data();

      const redeemed =
        data.redeemedCount || 0;

      if(redeemed >= data.quota)
        throw "Reward habis";

      transaction.update(rewardRef,{
        redeemedCount: redeemed + 1
      });

    });

    /* ==========================
       INBOX ITEM
    ========================== */

    await createInboxItem({

      uid: user.uid,
      type: "voucher",
      source: "reward",
      name: reward.name,
      image: reward.image,
      rewardId: rewardId,
      expireDays: reward.expireDays || 30

    });

    /* ==========================
       UI FEEDBACK
    ========================== */

    showConfetti();

    const modal = document.querySelector(".flash-image-modal");
    if(modal) modal.remove();

    showToast("Reward berhasil ditukar");

    setTimeout(()=>{
      renderStore();
    },800);

  }catch(err){

    console.log("REWARD ERROR:", err);
    showToast(err);

  }

};

window.openImagePreview = function(imageUrl){

  if(!imageUrl) return;

  const modal = document.getElementById("flashImageModal");
  const img = document.getElementById("flashImagePreview");

  if(!modal || !img) return;

  img.src = imageUrl;

  modal.classList.remove("hidden");

};

window.openFlashImage = function(url){

  const modal = document.getElementById("flashImageModal");
  const img = document.getElementById("flashImagePreview");

  img.src = url;

  modal.classList.remove("hidden");

}

window.closeFlashImage = function(){

  const modal = document.getElementById("flashImageModal");

  modal.classList.add("hidden");

}

window.openStoreInbox = async function(){

  const module = await import("./store-inbox.js");

  module.renderStoreInbox();

};

window.openRedeemPage = function(){

  document.getElementById("storeRewards").scrollIntoView({
    behavior:"smooth"
  });

};

window.openMyStore = function(){

  openCreateStore();

};


window.redeemFlash = redeemFlash;

// ===============================
// OPEN CART CHECKOUT PAGE
// ===============================

window.openCartCheckout = async function(){

  const content = document.getElementById("content");
  if(!content) return;

  if(cartItems.length === 0){

    content.innerHTML = `
      <div style="padding:20px;">
        Cart kosong.
      </div>
    `;
    return;

  }

  const user = auth.currentUser;

  const userSnap =
    await getDoc(doc(db,"users",user.uid));

  const userData = userSnap.data();

  const balance =
    Number(userData.walletBalance || 0);

  let totalPayment = 0;
  let totalItem = 0;

  let html = `
    <div class="store-page">

      <h2>Checkout</h2>
  `;

  cartItems.forEach((item,index)=>{

    const subtotal = item.qty * item.price;

    totalPayment += subtotal;
    totalItem += item.qty;

    html += `

      <div class="store-card">

        <div class="card-body">

          <strong>${item.name}</strong><br>

          ${
            item.size
            ? `Size: ${item.size}<br>`
            : ""
          }

          Qty: ${item.qty}<br>

          Rp ${item.price.toLocaleString()}

          <div style="margin-top:8px;">

            <button onclick="changeCartQty(${index},-1)">
              -
            </button>

            <button onclick="changeCartQty(${index},1)">
              +
            </button>

            <button onclick="removeCartItem(${index})">
              Remove
            </button>

          </div>

        </div>

      </div>

    `;

  });

  html += `

      <div class="store-card">

        <div class="card-body">

          <strong>Total Item:</strong>
          ${totalItem}

          <br>

          <strong>Total Payment:</strong>
          Rp ${totalPayment.toLocaleString()}

          <hr>

          <strong>Saldo Anda:</strong>
          Rp ${balance.toLocaleString()}

          <div style="margin-top:12px;">

            ${
              balance < totalPayment
              ? `<button disabled>
                   Saldo tidak cukup
                 </button>`
              : `<button class="btn-primary"
                         onclick="confirmCheckout(${totalPayment})">
                   Pay Now
                 </button>`
            }

          </div>

        </div>

      </div>

    </div>
  `;

  content.innerHTML = html;

};

// ===============================
// CART EDIT
// ===============================

window.changeCartQty = function(index,delta){

  const item = cartItems[index];

  item.qty += delta;

  if(item.qty <= 0){

    cartItems.splice(index,1);

  }

  saveCart();

  openCartCheckout();

};


window.removeCartItem = function(index){

  cartItems.splice(index,1);

  saveCart();

  openCartCheckout();

};

// ===============================
// CONFIRM CHECKOUT
// ===============================

window.confirmCheckout = async function(totalPayment){

  const user = auth.currentUser;
  if(!user) return;

  try{

    /* ==========================
       GET USER DATA
    ========================== */

    const userSnap = await getDoc(doc(db,"users",user.uid));

    if(!userSnap.exists())
      throw "User tidak ditemukan";

    const userData = userSnap.data();

    const role =
      userData.role || "member";


    /* ==========================
       CALCULATE GP REWARD
    ========================== */

    const base = Math.floor(totalPayment / 50000);

    let gpReward = 0;

    if(role === "member")
      gpReward = base * 100;

    if(role === "verified")
      gpReward = base * 150;

    if(role === "vvip")
      gpReward = base * 250;


    /* ==========================
       REQUEST PIN
    ========================== */

    const pin = await requestTransactionPin();

    if(!pin) return;

    const checkPin =
      await validateTransactionPin(user.uid,pin);

    if(!checkPin.valid){

      alert(checkPin.reason);
      return;

    }


    /* ==========================
       STOCK TRANSACTION
    ========================== */

    await runTransaction(db, async (transaction)=>{

  const userRef = doc(db,"users",user.uid);

  const userSnap = await transaction.get(userRef);

  if(!userSnap.exists())
    throw "User tidak ditemukan";

  const balance =
    Number(userSnap.data().walletBalance || 0);

  if(balance < totalPayment)
    throw "Saldo tidak cukup";


  /* ==========================
     READ ALL PRODUCTS FIRST
  ========================== */

  const productDocs = [];

  for(const item of cartItems){

    const productRef =
      doc(db,"products",item.productId);

    const productSnap =
      await transaction.get(productRef);

    if(!productSnap.exists())
      throw "Product tidak ditemukan";

    productDocs.push({
      ref:productRef,
      data:productSnap.data(),
      item
    });

  }


  /* ==========================
     WRITE AFTER ALL READS
  ========================== */

  productDocs.forEach(p=>{

    const data = p.data;
    const item = p.item;

    if(data.sizeEnabled){

      const current =
        Number(data.sizes[item.size] || 0);

      if(current < item.qty)
        throw "Stock tidak cukup";

      const newSizes = {
        ...data.sizes,
        [item.size]: current - item.qty
      };

      transaction.update(p.ref,{
        sizes:newSizes
      });

    }
    else{

      const current =
        Number(data.stock || 0);

      if(current < item.qty)
        throw "Stock tidak cukup";

      transaction.update(p.ref,{
        stock: current - item.qty
      });

    }

  });

});


    /* ==========================
       WALLET MUTATION (RUPIAH)
    ========================== */

    await applyMutation({

      userId:user.uid,
      asset:"RUPIAH",
      mutationType:"STORE_PURCHASE",
      amount:-totalPayment,
      description:"Store Purchase"

    });


    /* ==========================
       GP REWARD MUTATION
    ========================== */

    if(gpReward > 0){

      await applyMutation({

        userId:user.uid,
        asset:"GPOINT",
        mutationType:"STORE_REWARD",
        amount:gpReward,
        description:"Reward dari pembelian store"

      });

    }


    /* ==========================
       CREATE INBOX ITEM
    ========================== */

    for(const item of cartItems){

      await createInboxItem({

        uid:user.uid,
        type:"product",
        source:"store",
        name:item.name,
        image:item.image,
        productId:item.productId,
        expireDays:365

      });

    }


    /* ==========================
       CLEAR CART
    ========================== */

    cartItems = [];
    saveCart();


    /* ==========================
       PREMIUM SUCCESS MESSAGE
    ========================== */

    const notice = document.createElement("div");

    notice.className = "store-success-box";

    notice.innerHTML = `
      <div class="store-success-card">

        <h2>🎉 Pembayaran Berhasil</h2>

        <p>
          Selamat! Anda mendapatkan
        </p>

        <div class="gp-reward">
          +${gpReward.toLocaleString()} GP
        </div>

        <p style="opacity:.7">
          dari transaksi pembelian ini.
        </p>

      </div>
    `;

    document.body.appendChild(notice);

    setTimeout(()=>{
      notice.remove();
    },3500);


    showToast("Checkout berhasil");

    closeCartDrawer();

    renderStore();

  }
  catch(err){

    console.log("CHECKOUT ERROR:",err);

    showToast(err);

  }

};

window.openCartCheckout = function(){

  const drawer = document.getElementById("cartDrawer");
  const content = document.getElementById("cartDrawerContent");

  if(!drawer || !content) return;

  drawer.classList.remove("hidden");

  renderCartDrawer();

};

function renderCartDrawer(){

  const content = document.getElementById("cartDrawerContent");

  if(!content) return;

  if(cartItems.length === 0){

    content.innerHTML = `
      <div style="padding:20px;text-align:center;opacity:.6;">
        Cart kosong
      </div>
    `;

    return;
  }

  let total = 0;

  let html = "";

  cartItems.forEach((item,index)=>{

    const subtotal = item.qty * item.price;

    total += subtotal;

    html += `

      <div class="cart-item">

        <img src="${FLASH_BASE_IMAGE_URL}${item.image}">

        <div class="cart-info">

          <strong>${item.name}</strong>

          ${
            item.size
            ? `<div>Size: ${item.size}</div>`
            : ""
          }

          <div>Rp ${item.price.toLocaleString()}</div>

          <div class="cart-qty">

            <button onclick="changeCartQty(${index},-1)">-</button>

            <span>${item.qty}</span>

            <button onclick="changeCartQty(${index},1)">+</button>

          </div>

        </div>

      </div>

    `;

  });

  html += `

    <div class="cart-summary">

      <div>
        Total
      </div>

      <strong>
        Rp ${total.toLocaleString()}
      </strong>

    </div>

    <button class="btn-primary"
            onclick="confirmCheckout(${total})">
      Pay Now
    </button>

  `;

  content.innerHTML = html;

}

window.closeCartDrawer = function(){

  const drawer = document.getElementById("cartDrawer");

  if(!drawer) return;

  drawer.classList.add("hidden");

};

function calculateStoreGP(role,total){

  const base = Math.floor(total / 50000);

  if(role === "member")
    return base * 100;

  if(role === "verified")
    return base * 150;

  if(role === "vvip")
    return base * 250;

  return 0;

}
