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
        <p>Premium gear & exclusive rewards for club members.</p>
      </div>

      <section>
        <h2 class="section-title">Merchandise</h2>
        <div id="storeProducts" class="store-grid"></div>
      </section>

      <section>
        <h2 class="section-title">Redeem Rewards</h2>
        <div id="storeRewards" class="store-grid"></div>
      </section>

      <section id="flashSection" style="display:none;">
        <h2 class="section-title flash-title">Flash Drop</h2>
        <div id="storeFlash" class="store-grid"></div>
      </section>

    </div>
  `;

  renderProducts();
  renderRewards();
  renderFlash();
}

/* ===============================
   PRODUCTS (MONEY ONLY)
================================= */
function renderProducts(){

  const container = document.getElementById("storeProducts");
  if (!container) return;

  container.innerHTML = "";

  STORE_PRODUCTS
    .filter(p => p.active)
    .forEach(product => {

      const soldOut = product.stock <= 0;

      container.innerHTML += `
        <div class="store-card">

          <div class="card-image">
            <img src="${product.image}" />
            ${soldOut ? `<span class="badge sold">Sold Out</span>` : ""}
          </div>

          <div class="card-body">
            <h3>${product.name}</h3>
            <p class="desc">
              Official club merchandise. Premium quality material.
            </p>

            <div class="card-info">
              <span class="price">
                Rp ${product.price.toLocaleString()}
              </span>
              <span class="stock">
                Stock: ${product.stock}
              </span>
            </div>

            ${
              soldOut
              ? `<button disabled>Unavailable</button>`
              : `<button class="btn-primary">Buy Now</button>`
            }

          </div>
        </div>
      `;
    });
}

/* ===============================
   NORMAL REWARDS (POINT ONLY)
================================= */
function renderRewards(){

  const container = document.getElementById("storeRewards");
  if (!container) return;

  container.innerHTML = "";

  STORE_REWARDS
    .filter(r => r.active)
    .forEach(reward => {

      const soldOut = reward.redeemedCount >= reward.quota;

      container.innerHTML += `
        <div class="store-card">

          <div class="card-image reward-bg">
            ${soldOut ? `<span class="badge sold">Sold Out</span>` : ""}
          </div>

          <div class="card-body">
            <h3>${reward.name}</h3>
            <p class="desc">
              Limited session access. Weekly exclusive drop.
            </p>

            <div class="card-info">
              <span class="price gp">
                ${reward.pointCost.toLocaleString()} GP
              </span>
              <span class="stock">
                Remaining: ${reward.quota - reward.redeemedCount}
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
  if (!container || !flashSection) return;

  container.innerHTML = "";

  const activeFlash = STORE_FLASH.filter(f => f.active && isFlashActive(f));

  if (activeFlash.length === 0){
    flashSection.style.display = "none";
    return;
  }

  flashSection.style.display = "block";

  activeFlash.forEach(flash => {

    const soldOut = flash.redeemedCount >= flash.quota;

    container.innerHTML += `
      <div class="store-card flash-card">

        <div class="card-image">
          <span class="badge flash">FLASH</span>
          ${soldOut ? `<span class="badge sold">Sold Out</span>` : ""}
        </div>

        <div class="card-body">
          <h3>${flash.name}</h3>
          <p class="desc">
            Limited time exclusive drop. First come, first served.
          </p>

          <div class="card-info">
            <span class="price gp">
              ${flash.flashPointCost.toLocaleString()} GP
            </span>
            <span class="stock">
              Remaining: ${flash.quota - flash.redeemedCount}
            </span>
          </div>

          ${
            soldOut
            ? `<button disabled>Sold Out</button>`
            : `<button class="btn-flash">Redeem Now</button>`
          }

        </div>
      </div>
    `;
  });
}
