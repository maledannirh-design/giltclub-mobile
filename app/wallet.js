import { auth, db } from "./firebase.js";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  getDocs,
  query,
  doc,
  getDoc,
  setDoc,        // ✅ TAMBAHKAN INI
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { resolveMemberCard, renderMemberCard } from "./utils.js";

import { validateTransactionPin } from "./pinTrx.js";


export async function renderWallet(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

/* =========================================
   🔐 PIN GATE BEFORE OPEN WALLET
========================================= */

if(typeof window.requestTransactionPin !== "function"){
  console.error("requestTransactionPin tidak tersedia");
  navigate("home");
  return;
}

const pin = await window.requestTransactionPin();

if(!pin){
  navigate("home");
  return;
}

const pinCheck = await validateTransactionPin(user.uid, pin);

if(!pinCheck.valid){
  alert(pinCheck.reason || "PIN salah");
  navigate("home");
  return;
}
  try{

    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const balance = userData.walletBalance || 0;

    // =============================
    // RENDER WALLET UI
    // =============================
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

          <div id="walletAmount" class="wallet-amount">
            Rp ******
          </div>

          <div class="wallet-big-card" id="walletBigCard"></div>

        </div>

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

    // =============================
    // INSERT MEMBER CARD
    // =============================
    const walletBigCard = document.getElementById("walletBigCard");
    walletBigCard.innerHTML = renderMemberCard(userData);

    // =============================
    // TOGGLE SALDO
    // =============================
    const toggleBtn = document.getElementById("toggleSaldoBtn");
    const walletAmountEl = document.getElementById("walletAmount");

    let saldoVisible = false;

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

    // =============================
    // ACTION BUTTONS
    // =============================
    document.querySelector(".topup-card").onclick = ()=>{
      renderTopUpSheet();
    };

    document.querySelector(".withdraw-card").onclick = ()=>{
      alert("Sementara penarikan saldo langsung menghubungi admin club.");
    };

    document.querySelector(".ledger-card").onclick = ()=>{
      renderLedger();
    };

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
function eyeCloseSVG(){
  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="18" height="18"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         stroke-width="1.6"
         stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-7.94"/>
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-2.06 3.19"/>
      <path d="M1 1l22 22"/>
    </svg>
  `;
}

/* =========================================
   MUTASI (NEW ENGINE - walletMutations)
========================================= */

async function renderLedger(filterAsset = "ALL"){

  const user = auth.currentUser;
  const content = document.getElementById("content");

  if(!user || !content) return;

  const mutationSnap = await getDocs(
    query(
      collection(db,"walletMutations"),
      where("userId","==", user.uid),
      orderBy("createdAt","desc")
    )
  );

  const mutations = [];

  mutationSnap.forEach(docSnap=>{
    const data = docSnap.data();

    if(filterAsset !== "ALL" && data.asset !== filterAsset) return;

    mutations.push(data);
  });

  const labelMap = {
    BOOKING_PAYMENT: "Pembayaran Booking",
    BOOKING_REFUND: "Refund Booking",
    BOOKING_PENALTY: "Denda Pembatalan",
    SESSION_CASHBACK: "Cashback Session",
    TOPUP: "Top Up Saldo",
    TOPUP_BONUS: "Bonus Top Up",
    PURCHASE_PAYMENT: "Pembelian Produk",
    PURCHASE_REFUND: "Refund Produk",
    REDEEM_GPOINT: "Redeem Poin",
    REDEEM_GPOINT_REFUND: "Refund Redeem",
    ADMIN_ADJUSTMENT: "Penyesuaian Sistem",
    CHECKIN_REWARD: "Bonus Check-In"
  };

  let html = `
    <div class="ledger-container">

      <h3>Mutasi Rekening</h3>

      <div class="ledger-filter">
        <button onclick="renderLedger('ALL')">Semua</button>
        <button onclick="renderLedger('RUPIAH')">Saldo</button>
        <button onclick="renderLedger('GPOINT')">GPoint</button>
      </div>
  `;

  if(mutations.length === 0){
    html += `<div style="opacity:.6;margin-top:20px;">Belum ada transaksi</div>`;
  }

  for(const d of mutations){

    const amount = Number(d.amount || 0);
    const label = labelMap[d.mutationType] || d.mutationType || "-";

    let amountText = "";
    let balanceText = "";

    if(d.asset === "GPOINT"){

      amountText = `
        <span style="color:${amount>=0?'#16a34a':'#dc2626'};">
          ${amount>=0?'+':''}${amount} ⭐
        </span>
      `;

      balanceText = `
        <div class="ledger-balance">
          Total: ${d.balanceAfter ?? "-"} ⭐
        </div>
      `;

    }else{

      amountText = `
        <span style="color:${amount>=0?'#16a34a':'#dc2626'};">
          ${amount>=0?'+':''}Rp ${Math.abs(amount).toLocaleString("id-ID")}
        </span>
      `;

      balanceText = `
        <div class="ledger-balance">
          Saldo: Rp ${d.balanceAfter?.toLocaleString("id-ID") || "-"}
        </div>
      `;
    }

    html += `
      <div class="ledger-item">
        <div>
          <div class="ledger-type">${label}</div>
          <div class="ledger-date">
            ${d.createdAt?.toDate?.().toLocaleString("id-ID") || "-"}
          </div>
          ${d.description ? `<div style="opacity:.6;font-size:12px;">${d.description}</div>` : ""}
        </div>

        <div style="text-align:right;">
          <div class="ledger-amount">
            ${amountText}
          </div>
          ${balanceText}
        </div>
      </div>
    `;
  }

  html += `</div>`;

  content.innerHTML = html;
}



/* =========================================
   TOP UP SHEET
========================================= */

export async function renderTopUpSheet(){

  const content = document.getElementById("content");

  const QRIS_URL =
    "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/image/qris_deposit.webp";

  content.innerHTML = `
    <div class="topup-sheet">

      <h3>Ajukan Top Up</h3>

      <!-- COUNTDOWN -->
      <div class="countdown-box">
        Selesaikan pembayaran dalam
        <div id="countdownTimer">15:00</div>
      </div>

      <!-- QRIS IMAGE -->
      <div class="qris-container">
        <img src="${QRIS_URL}" class="qris-image"/>
      </div>

      <!-- CARA PEMBAYARAN -->
      <div class="payment-guide">
        <h4>Cara Pembayaran</h4>
        <ol>
          <li>Buka aplikasi mBanking / eWallet</li>
          <li>Pilih menu QRIS / Scan QR</li>
          <li>Scan kode QR di atas</li>
          <li>Masukkan nominal sesuai top up</li>
          <li>Selesaikan pembayaran</li>
          <li>Kirim bukti transfer ke admin club</li>
        </ol>
      </div>

      <!-- INPUT NOMINAL -->
      <input 
        type="number" 
        id="topupAmount" 
        placeholder="Masukkan nominal (min 10.000)"
        class="topup-input"
      />

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
      userId: auth.currentUser.uid,
      type: "TOPUP",
      amount: amount,
      status: "PENDING",
      createdAt: serverTimestamp()
    });

    alert("Top Up diajukan. Silakan kirim bukti transfer ke admin.");
    renderWallet();
  };
}

/* =========================================
   COUNTDOWN
========================================= */

function startCountdown(duration){

  let timer = duration;
  const el = document.getElementById("countdownTimer");

  const interval = setInterval(()=>{

    if(!el){
      clearInterval(interval);
      return;
    }

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


window.renderLedger = renderLedger;
