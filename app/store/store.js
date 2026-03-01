import {
  STORE_PRODUCTS,
  STORE_REWARDS,
  STORE_FLASH,
  isFlashActive
} from "./store-data.js";

/* ===============================
   MAIN ENTRY
================================= */
export async function renderStore() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="store-page">

      <div class="store-hero">
        <h1>GILT Official Store</h1>
        <p>Elite performance gear & exclusive club rewards</p>
      </div>
       <section id="flashSection" style="display:none;">
        <h2 class="section-title flash-title">Flash Drop</h2>
        <div id="storeFlash" class="store-grid"></div>
      </section>

      <section>
        <h2 class="section-title">Merchandise</h2>
        <div id="storeProducts" class="store-grid skeleton-grid"></div>
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
  container.classList.remove("skeleton-grid");
  container.innerHTML = "";

  STORE_PRODUCTS
    .filter(p => p.active)
    .forEach(product => {

      const lowStock = product.stock <= 5;
      const soldOut = product.stock <= 0;

      container.innerHTML += `
        <div class="store-card fade-in">

          <div class="card-image">
            <img src="${product.image}" class="zoom-img"/>

            ${soldOut ? `<span class="badge sold">Sold Out</span>` : ""}
            ${lowStock && !soldOut ? `<span class="badge limited">Limited</span>` : ""}

            <span class="wishlist">♡</span>
          </div>

          <div class="card-body">
            <h3>${product.name}</h3>

            <p class="desc">
              Premium breathable fabric engineered for performance.
            </p>

            <div class="card-info">
              <span class="price">
                Rp ${product.price.toLocaleString()}
              </span>
              <span class="stock">
                ${soldOut ? "Out of stock" : `Stock: ${product.stock}`}
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
        <div class="store-card fade-in">

          <div class="card-image reward-bg">
            ${soldOut ? `<span class="badge sold">Sold Out</span>` : ""}
          </div>

          <div class="card-body">
            <h3>${reward.name}</h3>

            <p class="desc">
              Exclusive session access for loyal members.
            </p>

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
   FLASH DROP
================================= */
function renderFlash(){

  const flashSection = document.getElementById("flashSection");
  const container = document.getElementById("storeFlash");

  const activeFlash = STORE_FLASH.filter(f => f.active && isFlashActive(f));

  if (activeFlash.length === 0){
    flashSection.style.display = "none";
    return;
  }

  flashSection.style.display = "block";
  container.innerHTML = "";

  activeFlash.forEach(flash => {

    const remaining = flash.quota - flash.redeemedCount;

    container.innerHTML += `
      <div class="store-card flash-card fade-in">

        <div class="card-image">
          <span class="badge flash">FLASH</span>
        </div>

        <div class="card-body">
          <h3>${flash.name}</h3>

          <p class="desc">
            Limited-time drop. First come, first served.
          </p>

          <div class="card-info">
            <span class="price gp">
              ${flash.flashPointCost.toLocaleString()} GP
            </span>
            <span class="stock">
              Remaining: ${remaining}
            </span>
          </div>

          <div class="countdown" data-end="${flash.endTime}"></div>

          <button class="btn-flash">Redeem Now</button>

        </div>
      </div>
    `;
  });

  startCountdown();
}

/* ===============================
   COUNTDOWN ENGINE
================================= */
function startCountdown(){

  const timers = document.querySelectorAll(".countdown");

  timers.forEach(timer => {

    const endTime = new Date(timer.dataset.end);

    const interval = setInterval(() => {

      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0){
        timer.innerHTML = "00:00:00";
        clearInterval(interval);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);

      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = n => n.toString().padStart(2, "0");

      if (days > 0) {
        timer.innerHTML = `
          <span class="cd">${pad(days)}</span>:
          <span class="cd">${pad(hours)}</span>:
          <span class="cd">${pad(minutes)}</span>:
          <span class="cd">${pad(seconds)}</span>
        `;
      } else {
        timer.innerHTML = `
          <span class="cd">${pad(hours)}</span>:
          <span class="cd">${pad(minutes)}</span>:
          <span class="cd">${pad(seconds)}</span>
        `;
      }

    }, 1000);

  });
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
