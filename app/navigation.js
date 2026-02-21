import { toggleTheme } from "./theme.js";
import { renderMembers } from "./profile.js";
import { renderChat } from "./chat.js";
import { renderHome } from "./home.js";

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

      case "home":
        (await import("./home.js")).renderHome();
        break;

      case "account":
        (await import("./profile.js")).renderAccountUI();
        break;

      case "chat":
        (await import("./profile.js")).renderChatList();
        break;

      case "members":
        (await import("./profile.js")).renderMembers();
        break;

      case "booking":
        (await import("./booking.js")).renderBooking();
        break;

      case "cinema":
        (await import("./cinema.js")).renderCinema();
        break;

      case "ranking":
        (await import("./leaderboard.js")).renderAttendanceLeaderboard();
        break;

      case "store":
        (await import("./store.js")).renderStore();
        break;

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
