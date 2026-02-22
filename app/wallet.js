import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderWallet(){

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
    const membership = userData.membership || "MEMBER";

    const MEMBER_CARD =
      "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/member_card.webp";

    const VVIP_CARD =
      "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/card/vvip_card.webp";

    const memberCardUrl =
      membership === "MEMBER" ? MEMBER_CARD : VVIP_CARD;

    /* =============================
       RENDER UI
    ============================= */
    content.innerHTML = `
      <div class="wallet-page">

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

              <div class="wallet-action-group">
                <button class="wallet-topup-btn">
                  ➕ Top Up Saldo
                </button>

                <button class="wallet-withdraw-btn">
                  ➖ Tarik Saldo
                </button>
              </div>

            </div>

            <div class="wallet-right">
              <img src="${memberCardUrl}" class="member-card-img" />
            </div>

          </div>

        </div>

      </div>
    `;

    /* =============================
       TOGGLE SALDO
    ============================= */
    let saldoVisible = false; // default tertutup

    const toggleBtn = document.getElementById("toggleSaldoBtn");
    const walletAmountEl = document.getElementById("walletAmount");

    if(toggleBtn){
      toggleBtn.onclick = ()=>{
        saldoVisible = !saldoVisible;

        walletAmountEl.innerText =
          saldoVisible
            ? `Rp ${balance.toLocaleString("id-ID")}`
            : "Rp ******";
      };
    }

  }catch(error){
    console.error("Wallet error:", error);
    content.innerHTML = `
      <div style="padding:20px;color:red;">
        Failed to load wallet.
      </div>
    `;
  }
}


/* =========================================
   SVG ICON
========================================= */

function eyeOpenSVG(){
  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="18" height="18"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         stroke-width="1.6"
         stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
}
