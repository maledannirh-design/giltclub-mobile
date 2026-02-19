import { renderBooking } from "./booking.js";
import { renderProfile, renderMembers } from "./profile.js";
import { renderCinema } from "./cinema.js";
import { renderAttendanceLeaderboard } from "./leaderboard.js";

export async function navigate(page){

  const content = document.getElementById("content");

  switch(page){

    case "home":
      content.innerHTML = "<h2>Home</h2>";
      break;

    case "profile":
      renderProfile();
      break;

    case "booking":
      renderBooking();
      break;

    case "cinema":
      renderCinema();
      break;

    case "members":
      renderMembers();
      break;

    case "ranking":
      renderAttendanceLeaderboard();
      break;

    case "dashboard":
      const dashboardModule = await import("./dashboard.js");
      dashboardModule.loadDashboard();
      break;

    default:
      content.innerHTML = "<h2>Page not found</h2>";
  }
}

window.navigate = navigate;
