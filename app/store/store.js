// ===============================
// GILT STORE ENGINE
// ===============================

import {
  STORE_PRODUCTS,
  STORE_REWARDS,
  STORE_FLASH,
  calculateRewardPoints,
  isFlashActive
} from "./store-data.js";

// ===============================
// MAIN RENDER
// ===============================

export function renderStore(userData) {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="store-page">
      <h2>Official Store</h2>
      <div id="storeProducts" class="store-grid"></div>

      <h2>Redeem Rewards</h2>
      <div id="storeRewards" class="store-grid"></div>

      <h2>Flash Redeem</h2>
      <div id="storeFlash" class="store-grid"></div>
    </div>
  `;

  renderProducts(userData);
  renderRewards(userData);
  renderFlash(userData);
}

// ===============================
// RENDER PRODUCTS (BUY WITH MONEY)
// ===============================

function renderProducts(userData) {
  const container = document.getElementById("storeProducts");
  container.innerHTML = "";

  STORE_PRODUCTS
    .filter(p => p.active)
    .forEach(product => {

      const soldOut = product.stock <= 0;

      container.innerHTML += `
        <div class="store-card ${soldOut ? "sold-out" : ""}">
          <img src="${product.image}" class="store-img"/>
          <h3>${product.name}</h3>
          <p>Rp ${product.price.toLocaleString()}</p>
          ${soldOut 
            ? `<button disabled>SOLD OUT</button>` 
            : `<button onclick="window.buyProduct('${product.id}')">Beli</button>`
          }
        </div>
      `;
    });

  window.buyProduct = function(productId) {
    const product = STORE_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
      alert("Stock habis");
      return;
    }

    if (userData.wallet < product.price) {
      alert("Saldo tidak cukup");
      return;
    }

    // Potong saldo
    userData.wallet -= product.price;

    // Hitung reward
    const reward = calculateRewardPoints(userData.role, product.price);
    userData.gpoints += reward;

    // Kurangi stock
    product.stock -= 1;

    alert(`Berhasil beli! +${reward} GPoints`);

    renderStore(userData);
  };
}

// ===============================
// RENDER NORMAL REWARD (POINT)
// ===============================

function renderRewards(userData) {
  const container = document.getElementById("storeRewards");
  container.innerHTML = "";

  STORE_REWARDS
    .filter(r => r.active)
    .forEach(reward => {

      const soldOut = reward.redeemedCount >= reward.quota;
      const eligible = reward.eligibleRoles.includes(userData.role);

      container.innerHTML += `
        <div class="store-card ${soldOut ? "sold-out" : ""}">
          <h3>${reward.name}</h3>
          <p>${reward.pointCost} GPoints</p>
          ${
            !eligible
              ? `<button disabled>Tidak tersedia</button>`
              : soldOut
              ? `<button disabled>SOLD OUT</button>`
              : `<button onclick="window.redeemReward('${reward.id}')">Redeem</button>`
          }
        </div>
      `;
    });

  window.redeemReward = function(rewardId) {
    const reward = STORE_REWARDS.find(r => r.id === rewardId);
    if (!reward) return;

    if (!reward.eligibleRoles.includes(userData.role)) {
      alert("Role tidak eligible");
      return;
    }

    if (reward.redeemedCount >= reward.quota) {
      alert("Quota habis");
      return;
    }

    if (userData.gpoints < reward.pointCost) {
      alert("GPoints tidak cukup");
      return;
    }

    userData.gpoints -= reward.pointCost;
    reward.redeemedCount += 1;

    alert("Voucher berhasil diredeem!");

    renderStore(userData);
  };
}

// ===============================
// RENDER FLASH REWARD
// ===============================

function renderFlash(userData) {
  const container = document.getElementById("storeFlash");
  container.innerHTML = "";

  STORE_FLASH
    .filter(f => f.active && isFlashActive(f))
    .forEach(flash => {

      const soldOut = flash.redeemedCount >= flash.quota;
      const eligible = flash.eligibleRoles.includes(userData.role);

      container.innerHTML += `
        <div class="store-card flash ${soldOut ? "sold-out" : ""}">
          <div class="flash-badge">FLASH</div>
          <h3>${flash.name}</h3>
          <p>${flash.flashPointCost} GPoints</p>
          ${
            !eligible
              ? `<button disabled>Tidak tersedia</button>`
              : soldOut
              ? `<button disabled>SOLD OUT</button>`
              : `<button onclick="window.redeemFlash('${flash.id}')">Redeem</button>`
          }
        </div>
      `;
    });

  window.redeemFlash = function(flashId) {
    const flash = STORE_FLASH.find(f => f.id === flashId);
    if (!flash) return;

    if (!flash.eligibleRoles.includes(userData.role)) {
      alert("Role tidak eligible");
      return;
    }

    if (!isFlashActive(flash)) {
      alert("Flash tidak aktif");
      return;
    }

    if (flash.redeemedCount >= flash.quota) {
      alert("Quota habis");
      return;
    }

    if (userData.gpoints < flash.flashPointCost) {
      alert("GPoints tidak cukup");
      return;
    }

    userData.gpoints -= flash.flashPointCost;
    flash.redeemedCount += 1;

    alert("FLASH berhasil diredeem!");

    renderStore(userData);
  };
}
