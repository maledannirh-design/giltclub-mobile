import { auth } from "./firebase.js";
import { toggleTheme } from "./theme.js";
import { renderChampionClubPage } from "./championClub.js";

let navLock = false;
let currentPage = null;

function showMemberAccessForChat(){
  let overlay = document.getElementById("memberAccessGateOverlay");
  if(!overlay){
    overlay = document.createElement("div");
    overlay.id = "memberAccessGateOverlay";
    overlay.className = "member-access-overlay";
    overlay.innerHTML = `
      <div class="member-access-card" role="dialog" aria-modal="true" aria-labelledby="memberAccessGateTitle">
        <button type="button" class="member-access-close" aria-label="Tutup">×</button>
        <div class="member-access-icon">🔒</div>
        <h2 class="member-access-title" id="memberAccessGateTitle">Akses Khusus Member</h2>
        <div class="member-access-actions">
          <div class="member-access-option">
            <button type="button" class="member-access-register">Daftar</button>
            <p>Belum jadi anggota? Klik daftar</p>
          </div>
          <div class="member-access-option">
            <button type="button" class="member-access-login">Masuk</button>
            <p>Sudah punya akun? Klik masuk</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.classList.remove("show");
    overlay.addEventListener("click", e => { if(e.target === overlay) close(); });
    overlay.querySelector(".member-access-close").addEventListener("click", close);
    overlay.querySelector(".member-access-register").addEventListener("click", async () => {
      close();
      await navigate("account");
      document.getElementById("registerBtn")?.click();
    });
    overlay.querySelector(".member-access-login").addEventListener("click", async () => {
      close();
      await navigate("account");
      document.getElementById("loginBtn")?.click();
    });
  }
  overlay.classList.add("show");
}


function showSkillMemberAccess(){
  let overlay=document.getElementById("skillMemberAccessOverlay");
  if(!overlay){
    overlay=document.createElement("div"); overlay.id="skillMemberAccessOverlay"; overlay.className="member-access-overlay skill-member-access-overlay";
    overlay.innerHTML=`<div class="member-access-card" role="dialog" aria-modal="true" aria-labelledby="skillMemberAccessTitle"><div class="member-access-icon">🔒</div><h2 class="member-access-title" id="skillMemberAccessTitle">Akses Khusus Member</h2><div class="member-access-actions"><div class="member-access-option"><button type="button" class="member-access-register">Daftar</button><p>Belum jadi anggota? Klik daftar</p></div><div class="member-access-option"><button type="button" class="member-access-login">Masuk</button><p>Sudah punya akun? Klik masuk</p></div></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".member-access-register").addEventListener("click",async()=>{overlay.classList.remove("show");await navigate("account");document.getElementById("registerBtn")?.click();});
    overlay.querySelector(".member-access-login").addEventListener("click",async()=>{overlay.classList.remove("show");await navigate("account");document.getElementById("loginBtn")?.click();});
  }
  overlay.classList.add("show");
}

export async function navigate(page){
  // Leaving Jadwal cancels and closes any open create-session form.
  if(page !== "booking"){
    const createSessionSheet = document.getElementById("createSessionSheet");
    if(createSessionSheet){
      createSessionSheet.classList.remove("active");
      createSessionSheet.innerHTML = "";
    }
  }


  if(page !== "skill") {
    document.body.classList.remove("dashboard-gate-open");
    document.getElementById("verifyModal")?.classList.remove("show");
  }
  if(page !== "store" && page !== "skill"){
    document.body.classList.remove("store-gate-open");
    document.getElementById("storeMemberAccessOverlay")?.classList.remove("show");
    document.getElementById("skillMemberAccessOverlay")?.classList.remove("show");
  }
  if(page !== "home"){
    document.getElementById("guestCheckinAccessOverlay")?.classList.remove("show");
  }
  if(page !== "wallet"){
    document.getElementById("walletGuestAccessOverlay")?.classList.remove("show");
  }

  if(page === "chat" && !auth.currentUser){
    showMemberAccessForChat();
    return;
  }

  if (navLock) return;
  if (page === currentPage) return;

  navLock = true;
  const previousPage = currentPage;

  try {
    if (previousPage === "home" && page !== "home" && window.stopHomeListeners) {
      window.stopHomeListeners();
    }
    if (previousPage === "booking" && page !== "booking") {
      const bookingModule = await import("./booking.js");
      bookingModule.cleanupBookingListeners();
    }
  } catch (cleanupError) {
    console.error("Booking listener cleanup failed:", cleanupError);
  }

  if (previousPage === "cinema" && page !== "cinema") {
    if (window.stopCinemaPresence) {
      window.stopCinemaPresence();
      window.stopCinemaPresence = null;
    }
  }

  currentPage = page;

  const content = document.getElementById("content");
  if (!content){
    navLock = false;
    return;
  }

  // Loading state
  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading...
    </div>
  `;

  try {

    switch(page){

      /* ======================
         TERAS (HOME)
      ====================== */
      case "home":
        (await import("./home.js")).renderHome();
        break;

      // Video Lab is hosted as a separate static page without app-level listeners.
      case "videolab":
        window.location.href = new URL("./videolab/", import.meta.url).href;
        break;
/* ======================
   SKILL (VERIFIED ONLY)
====================== */
case "skill":

  const { auth, db } = await import("./firebase.js");
  const { doc, getDoc } = await import("./firestore.js");

  const user = auth.currentUser;

  if(!user){
    (await import("./skill.js")).renderGuestSkillDashboard();
    document.body.classList.add("dashboard-gate-open");
    showSkillGuestAccessModal();
    break;
  }

  const userRef = doc(db,"users",user.uid);
  const userSnap = await getDoc(userRef);

  if(!userSnap.exists()){
    alert("Data user tidak ditemukan.");
    return;
  }

  const userData = userSnap.data();

  if(userData.membership !== "VVIP"){
    await (await import("./skill.js")).renderSkill();
    document.body.classList.add("dashboard-gate-open");
    showDashboardVvipGate();
    break;
  }

  (await import("./skill.js")).renderSkill();
  break;

        
      /* ======================
         AKUN
      ====================== */
      case "account":
        (await import("./profile.js")).renderAccountUI();
        break;

/* ======================
         CHAMPION BOARD
      ====================== */
        case "championClub":
  renderChampionClubPage();
  break;
        
      /* ======================
         JADWAL (BOOKING)
      ====================== */
      case "booking":
        (await import("./booking.js")).renderBooking();
        break;

      /* ======================
         SALDO (WALLET)
      ====================== */
      case "wallet":
        (await import("./wallet.js")).renderWallet();
        break;

      /* ======================
         LEADERBOARD (FULL PAGE)
      ====================== */
      case "leaderboard":
        (await import("./leaderboard.js")).renderAttendanceLeaderboard();
        break;

      /* ======================
         TOKO
      ====================== */
      case "store":
        (await import("./store/store.js")).renderStore();
        break;

      /* ======================
         FLASH ADMIN (STORE)
      ====================== */
      case "flash-admin":
        (await import("./store/flash-admin.js")).renderFlashAdmin();
        break;

      /* ======================
         ADMIN PANEL
      ====================== */
      case "admin":
        (await import("./admin.js")).renderAdmin();
        break;

      /* ======================
         CINEMA (JIKA MASIH DIPAKAI)
      ====================== */
      case "cinema":
        (await import("./cinema.js")).renderCinema();
        break;

        /* ======================
         CHAT
      ====================== */
     case "chat":
  (await import("./chat.js")).renderChat();
  break;
      /* ======================
         DASHBOARD (JIKA MASIH DIPAKAI)
      ====================== */
      case "dashboard":
        (await import("./dashboard.js")).loadDashboard();
        break;

      default:
        content.innerHTML = "<h2>Page not found</h2>";
    }

    updateActiveNav(page);

  } catch (error){

    console.error("Navigation error:", error);

    content.innerHTML = `
      <div style="padding:20px;color:red;">
        Something went wrong.
      </div>
    `;

  } finally {
    navLock = false;
  }
}

/* ============================
   ACTIVE NAV HIGHLIGHT
============================ */
function updateActiveNav(page){

  const buttons = document.querySelectorAll(".bottom-nav button");

  buttons.forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.page === page){
      btn.classList.add("active");
    }
  });
}


/* Sponsor logo carousel behind the persistent app header. */
(function initSponsorMarquee(){
  const startCarousel = () => {
    const logo = document.getElementById("sponsorMarqueeLogo");
    if(!logo || logo.dataset.carouselReady === "true") return;
    logo.dataset.carouselReady = "true";
    const sponsors = [
      "/app/assets/sponsors/aplogo.png",
      "/app/assets/sponsors/aplusgold1.png",
      "/app/assets/sponsors/kunkwanlogo.png"
    ];
    let index = 0;
    let busy = false;
    const showNext = () => {
      if(busy) return;
      busy = true;
      const nextIndex = (index + 1) % sponsors.length;
      const preloader = new Image();
      preloader.onload = () => {
        logo.classList.add("sponsor-logo-exit");
        window.setTimeout(() => {
          index = nextIndex;
          logo.src = sponsors[index];
          logo.classList.remove("sponsor-logo-exit", "sponsor-logo-enter");
          void logo.offsetWidth;
          logo.classList.add("sponsor-logo-enter");
          requestAnimationFrame(() => requestAnimationFrame(() => {
            logo.classList.remove("sponsor-logo-enter");
            busy = false;
          }));
        }, 350);
      };
      preloader.onerror = () => {
        console.error("Sponsor logo failed to preload:", sponsors[nextIndex]);
        busy = false;
      };
      preloader.src = sponsors[nextIndex];
    };
    logo.src = sponsors[0];
    window.setInterval(showNext, 1500);
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", startCarousel, {once:true});
  else startCarousel();
})();

/* ============================
   GLOBAL BIND
============================ */
window.navigate = navigate;
window.toggleTheme = toggleTheme;


window.showVerifyRequiredModal = function(){
  const modal = document.getElementById("verifyModal");
  if(modal) modal.classList.add("show");
};

function showDashboardVvipGate(){
  const modal = document.getElementById("verifyModal");
  if(!modal) return;
  const card = modal.querySelector(".verify-modal-card");
  if(!card) return;
  card.innerHTML = '<div class="verify-icon">🔒</div><div class="verify-title">Dashboard Locked</div><div class="verify-text">Fitur Dashboard hanya tersedia untuk VVIP Member. Hubungi Coach GMTC untuk membuka akses dan mendapatkan penjelasan fitur ini.</div><div class="verify-buttons"><button class="verify-primary" id="dashboardCoachChat">Chat ke Coach</button></div>';
  modal.classList.add("show");
  card.querySelector("#dashboardCoachChat").onclick = () => {
    const message = "halo coach, sy ingin tanya terkait fungsi dashboard apps G-Apps";
    window.open("https://wa.me/6281255939291?text=" + encodeURIComponent(message), "_blank", "noopener");
  };
}

function showSkillGuestAccessModal(){
  const modal = document.getElementById("verifyModal");
  if(!modal) return;
  const card = modal.querySelector(".verify-modal-card");
  card.innerHTML = '<div class="verify-icon">🔒</div><div class="verify-title">Akses Dashboard</div><div class="verify-text">Masuk ke akun GMTC atau daftar gratis untuk melanjutkan.</div><div class="verify-buttons verify-guest-buttons"><button class="verify-primary" id="skillGuestLogin">Masuk</button><button class="verify-secondary" id="skillGuestRegister">Daftar</button></div>';
  modal.classList.add("show");
  card.querySelector("#skillGuestLogin").onclick = async () => { modal.classList.remove("show"); document.body.classList.remove("dashboard-gate-open"); await navigate("account"); setTimeout(()=>document.getElementById("loginBtn")?.click(),150); };
  card.querySelector("#skillGuestRegister").onclick = async () => { modal.classList.remove("show"); document.body.classList.remove("dashboard-gate-open"); await navigate("account"); setTimeout(()=>document.getElementById("registerBtn")?.click(),150); };
}

window.closeVerifyModal = function(){ /* Intentionally non-dismissible; use bottom navigation. */ };
