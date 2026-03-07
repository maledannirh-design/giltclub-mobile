import { toggleTheme } from "./theme.js";

let navLock = false;
let currentPage = null;

export async function navigate(page){

  if (navLock) return;
  if (page === currentPage) return;

  navLock = true;
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
    alert("Silakan login terlebih dahulu.");
    return;
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
