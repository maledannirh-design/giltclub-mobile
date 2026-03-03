/* =========================================
   IMPORTS
========================================= */

import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { initTheme, toggleTheme } from "./theme.js";
import { showToast } from "./ui.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =========================================
   MAINTENANCE GUARD (PRO VERSION)
========================================= */

async function checkMaintenanceAndFreeze(user){

  const content = document.getElementById("content");
  if(!content) return false;

  try{

    const snap = await getDoc(doc(db,"system","maintenance"));
    if(!snap.exists()) return false;

    const data = snap.data();
    if(!data.enabled) return false;

    // ADMIN BYPASS
    if(user){
      const userSnap = await getDoc(doc(db,"users", user.uid));
      if(userSnap.exists()){
        const role = userSnap.data().role;
        if(role === "ADMIN" || role === "SUPERCOACH"){
          return false;
        }
      }
    }

    const endAt = data.endAt?.toMillis
      ? data.endAt.toMillis()
      : null;

    content.innerHTML = `
      <div class="maintenance-wrapper">

        <div class="police-line"></div>

        <div class="maintenance-card">

          <h1>🚧 Sistem Sedang Maintenance</h1>

          <div class="maintenance-message">
            <p>Mutasi rekening saldo ke bank server yang lebih besar</p>
            <p>Security dan keamanan sistem telah ditingkatkan</p>
            <p>Penyesuaian software engine untuk kamera</p>
            <p>Pembukaan toko, penjualan jersey dan product club telah diaktifkan</p>
            <p>Checkin sistem harian, cashback dan sistem follow telah diaktifkan</p>
            <p>Perhitungan kehadiran dan reward hadiah kehadiran diaktifkan</p>
            <p>Dashboard skill tiap pemain kini dapat terlihat sesuai privasi member</p>

            <div class="maintenance-estimate">
              <strong>Perkiraan waktu:</strong><br>
              2 – 9 Jam<br><br>
              Sebagai kompensasi, gameplay tadi malam mendapat
              <strong>double gPoint (2x lipat)</strong>,
              semua penalty dihapus dan saldo dikembalikan.
            </div>
          </div>

          <div id="maintenanceCountdown" class="maintenance-countdown">
            ${endAt ? "Menghitung waktu..." : ""}
          </div>

          <div class="reaction-game">
            <h3>🎮 Mini Game: Reaction Test</h3>
            <button id="reactionBtn" class="reaction-btn">
              Tunggu Warna Hijau...
            </button>
            <div id="reactionResult" class="reaction-result"></div>
          </div>

        </div>

        <div class="police-line"></div>
      </div>
    `;

    injectMaintenanceStyle();
    setTimeout(initReactionGame, 100);

    if(endAt){
      startMaintenanceCountdown(endAt);
    }

    return true;

  }catch(err){
    console.error("Maintenance check error:", err);
    return false;
  }
}


/* =========================================
   MAINTENANCE COUNTDOWN
========================================= */

function startMaintenanceCountdown(endAt){

  const el = document.getElementById("maintenanceCountdown");
  if(!el) return;

  function update(){

    const now = Date.now();
    const diff = endAt - now;

    if(diff <= 0){
      el.innerHTML = "Maintenance selesai. Silakan refresh.";
      return;
    }

    const h = Math.floor(diff / (1000*60*60));
    const m = Math.floor((diff % (1000*60*60)) / (1000*60));
    const s = Math.floor((diff % (1000*60)) / 1000);

    el.innerHTML =
      `⏳ Sisa waktu: <strong>${h}j ${m}m ${s}d</strong>`;
  }

  update();
  setInterval(update,1000);
}


/* =========================================
   MAINTENANCE STYLE INJECTOR
========================================= */

function injectMaintenanceStyle(){

  if(document.getElementById("maintenance-style")) return;

  const style = document.createElement("style");
  style.id = "maintenance-style";

  style.innerHTML = `
    .maintenance-wrapper{
      position:fixed;
      inset:0;
      background:#0f172a;
      color:#fff;
      display:flex;
      flex-direction:column;
      justify-content:center;
      align-items:center;
      text-align:center;
      z-index:999999;
      font-family:system-ui, sans-serif;
    }

    .maintenance-card{
      max-width:420px;
      padding:30px;
    }

    .maintenance-message p{
      opacity:.85;
      margin:6px 0;
      font-size:14px;
    }

    .maintenance-estimate{
      margin-top:20px;
      font-size:14px;
      opacity:.9;
    }

    .maintenance-countdown{
      margin-top:25px;
      font-size:16px;
      font-weight:bold;
      color:#facc15;
    }

    .police-line{
      width:100%;
      height:40px;
      background: repeating-linear-gradient(
        45deg,
        #facc15,
        #facc15 20px,
        #000 20px,
        #000 40px
      );
      animation: moveStripe 2s linear infinite;
    }

    @keyframes moveStripe{
      from{ background-position:0 0; }
      to{ background-position:100px 0; }
    }

    .reaction-game{
      margin-top:30px;
    }

    .reaction-btn{
      padding:12px 20px;
      border:none;
      border-radius:14px;
      font-weight:bold;
      background:#2563eb;
      color:white;
      cursor:pointer;
      transition:0.2s;
    }

    .reaction-result{
      margin-top:10px;
      font-size:14px;
      opacity:.9;
    }
  `;

  document.head.appendChild(style);
}


/* =========================================
   REACTION GAME
========================================= */

function initReactionGame(){

  const btn = document.getElementById("reactionBtn");
  const result = document.getElementById("reactionResult");

  if(!btn) return;

  let startTime = 0;

  btn.onclick = () => {

    if(btn.dataset.state === "ready"){
      const reaction = Date.now() - startTime;
      result.innerText = `⚡ Reaksi kamu: ${reaction} ms`;
      btn.innerText = "Main Lagi";
      btn.style.background = "#2563eb";
      btn.dataset.state = "idle";
      return;
    }

    btn.innerText = "Tunggu Hijau...";
    btn.style.background = "#ef4444";
    result.innerText = "";
    btn.dataset.state = "waiting";

    const delay = Math.random() * 3000 + 2000;

    setTimeout(()=>{
      btn.innerText = "KLIK SEKARANG!";
      btn.style.background = "#22c55e";
      startTime = Date.now();
      btn.dataset.state = "ready";
    }, delay);
  };
}


/* =========================================
   GLOBAL INIT
========================================= */

initTheme();

window.navigate = navigate;
window.toggleTheme = toggleTheme;

const rtdb = getDatabase();


/* =========================================
   SPLASH SCREEN CONTROL
========================================= */

window.addEventListener("load", () => {

  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  setTimeout(() => splash.classList.add("fade-out"), 1200);
  setTimeout(() => splash.classList.add("hide"), 2000);

});


/* =========================================
   ATTENDANCE LISTENER
========================================= */

let unsubscribeAttendance = null;

function listenAttendanceNotification(uid){

  if(unsubscribeAttendance){
    unsubscribeAttendance();
    unsubscribeAttendance = null;
  }

  const q = query(
    collection(db,"bookings"),
    where("userId","==",uid),
    where("attendance","==",true)
  );

  unsubscribeAttendance = onSnapshot(q, snap=>{

    snap.docChanges().forEach(change=>{

      if(change.type !== "added" && change.type !== "modified") return;

      const data = change.doc.data();
      const attendedAt = data.attendedAt?.toDate?.();
      if(!attendedAt) return;

      const diff = Date.now() - attendedAt.getTime();
      if(diff > 60 * 60 * 1000) return;

      const bookingId = change.doc.id;

      const notified =
        JSON.parse(localStorage.getItem("notifiedBookings") || "[]");

      if(notified.includes(bookingId)) return;

      const cashback = data.rewardCashback || 0;
      const gpoint = data.rewardGPoint || 0;
      const date = data.rewardSessionDate || "-";

      let message = "✅ Check-in berhasil!\n";

      if(cashback > 0){
        message += `💰 Cashback Rp ${cashback.toLocaleString("id-ID")}\n`;
      }

      if(gpoint > 0){
        message += `⭐ GPoint +${gpoint}\n`;
      }

      message += `📅 ${date}`;

      showToast(message);

      notified.push(bookingId);
      localStorage.setItem(
        "notifiedBookings",
        JSON.stringify(notified)
      );

    });

  });
}


/* =========================================
   AUTH STATE
========================================= */

onAuthStateChanged(auth, async (user)=>{

  const label = document.getElementById("currentUserLabel");
  const adminButton = document.querySelector('[data-page="admin"]');

  const frozen = await checkMaintenanceAndFreeze(user);
  if(frozen) return;

  if(user){

    navigate("home");

    const statusRef = ref(rtdb, "status/" + user.uid);

    set(statusRef,{
      online: true,
      lastSeen: Date.now()
    });

    onDisconnect(statusRef).set({
      online: false,
      lastSeen: Date.now()
    });

    try{

      const snap = await getDoc(doc(db, "users", user.uid));

      if(snap.exists()){

        const data = snap.data();
        window.currentUserRole = data.role || "MEMBER";

        if(label){
          label.innerText =
            `${data.username || "User"} (${data.role || "-"})`;
        }

        if(adminButton){
          adminButton.style.display =
            (data.role === "ADMIN" || data.role === "SUPERCOACH")
            ? "flex"
            : "none";
        }

      }else{

        if(label) label.innerText = "User data missing";
        if(adminButton) adminButton.style.display = "none";

      }

    }catch(error){

      console.error("User load error:", error);
      if(label) label.innerText = "Error loading user";
      if(adminButton) adminButton.style.display = "none";

    }

    listenAttendanceNotification(user.uid);

  }else{

    if(unsubscribeAttendance){
      unsubscribeAttendance();
      unsubscribeAttendance = null;
    }

    navigate("account");

    if(label) label.innerText = "Not logged in";
    if(adminButton) adminButton.style.display = "none";
  }

});
