import { auth, db } from "./firebase.js";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  getDocs,
  query,
  doc,
  getDoc,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

    <!-- PINK CONTAINER -->
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

      <div id="walletAmount" class="wallet-amount">
        Rp ******
      </div>

      <!-- MEMBER CARD BESAR -->
      <div class="wallet-big-card">
        <img src="${memberCardUrl}" class="wallet-member-big-img" />
      </div>

    </div>

    <!-- ACTION CARDS -->
    <div class="wallet-action-row">

      <div class="wallet-action-card topup-card">
  <div class="action-icon">➕</div>
  <div class="action-title">Top Up</div>
</div>

<div class="wallet-action-card withdraw-card">
  <div class="action-icon">➖</div>
  <div class="action-title">Tarik Saldo</div>
</div>

    </div>

<div class="wallet-action-card ledger-card">
  <div class="action-icon">📄</div>
  <div class="action-title">Mutasi</div>
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
/* =============================
   ACTION BUTTONS
============================= */

document.querySelector(".topup-card").onclick = ()=>{
  renderTopUpSheet();
};

document.querySelector(".withdraw-card").onclick = ()=>{
  alert("Sementara penarikan saldo langsung menghubungi admin club.");
};

document.querySelector(".ledger-card").onclick = ()=>{
  renderLedger();
};

/* =========================================
   MUTASI REKENING
========================================= */
async function renderLedger(){

  const user = auth.currentUser;
  const content = document.getElementById("content");

  const snap = await getDocs(
    query(
      collection(db,"walletTransactions"),
      where("uid","==", user.uid),
      orderBy("createdAt","desc")
    )
  );

  let html = `
    <div class="ledger-container">
      <h3>Mutasi Rekening</h3>
  `;

  snap.forEach(doc=>{
    const d = doc.data();

    html += `
      <div class="ledger-item">
        <div>
          <div class="ledger-type">${d.type}</div>
          <div class="ledger-date">
            ${d.createdAt?.toDate().toLocaleString("id-ID") || "-"}
          </div>
        </div>
        <div class="ledger-amount">
          Rp ${d.amount?.toLocaleString("id-ID")}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  content.innerHTML = html;
}

async function renderTopUpSheet(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="topup-sheet">

      <h3>Ajukan Top Up</h3>

      <div class="countdown-box">
        Selesaikan pembayaran dalam
        <div id="countdownTimer">15:00</div>
      </div>

      <input 
        type="number" 
        id="topupAmount" 
        placeholder="Masukkan nominal (min 10.000)"
        class="topup-input"
      />

      <div class="topup-note">
        Bukti transfer sementara kirim ke WA admin club.
      </div>

      <button id="submitTopup" class="btn-primary">
        Ajukan Top Up
      </button>

      <button id="cancelTopup" class="btn-danger">
        Batal
      </button>

    </div>
  `;

  startCountdown(15 * 60);

  document.getElementById("cancelTopup").onclick = ()=>{
    renderWallet();
  };

  document.getElementById("submitTopup").onclick = async ()=>{

    const amount = parseInt(
      document.getElementById("topupAmount").value
    );

    if(!amount || amount < 10000){
      alert("Minimal top up Rp 10.000");
      return;
    }

    await addDoc(collection(db,"walletTransactions"),{
      uid: auth.currentUser.uid,
      type: "TOPUP",
      amount: amount,
      status: "PENDING",
      createdAt: serverTimestamp()
    });

    alert("Top Up diajukan. Silakan kirim bukti transfer ke admin.");
    renderWallet();
  };
}

function startCountdown(duration){

  let timer = duration;
  const el = document.getElementById("countdownTimer");

  const interval = setInterval(()=>{

    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;

    el.innerText =
      `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    if(--timer < 0){
      clearInterval(interval);
      el.innerText = "Waktu habis";
    }

  },1000);
}
