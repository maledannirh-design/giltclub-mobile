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

  if(page !== "store" && page !== "skill"){
    document.body.classList.remove("store-gate-open");
    document.getElementById("storeMemberAccessOverlay")?.classList.remove("show");
    document.getElementById("skillMemberAccessOverlay")?.classList.remove("show");
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
/* ======================
   SKILL (VERIFIED ONLY)
====================== */
case "skill":

  const { auth, db } = await import("./firebase.js");
  const { doc, getDoc } = await import("./firestore.js");

  const user = auth.currentUser;

  if(!user){
    showSkillMemberAccess();
    content.innerHTML = `<section class="skill-wrapper skill-visitor-preview"><h2>GMTC Skill</h2><p>Kenali level dan perkembangan skill tenis member GMTC.</p><div class="skill-preview-levels"><div>🎾 Newbie</div><div>🎾 Beginner</div><div>🎾 Upper Beginner</div><div>🎾 Intermediate</div></div></section>`;
    break;
  }

  const userRef = doc(db,"users",user.uid);
  const userSnap = await getDoc(userRef);

  if(!userSnap.exists()){
    alert("Data user tidak ditemukan.");
    return;
  }

  const userData = userSnap.data();

  if(!userData.verified){
    showVerifyRequiredModal();
    return;
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

/* ============================
   GLOBAL BIND
============================ */
window.navigate = navigate;
window.toggleTheme = toggleTheme;


window.showVerifyRequiredModal = function(){

  const modal = document.getElementById("verifyModal");
  if(modal) modal.classList.add("show");

}

window.closeVerifyModal = function(){

  const modal = document.getElementById("verifyModal");
  if(modal) modal.classList.remove("show");

}
