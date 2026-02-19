export async function navigate(page){

  const content = document.getElementById("content");

  if (!content) return;

  // Loading state
  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading...
    </div>
  `;

  try {

    switch(page){

      case "home":
        content.innerHTML = "<h2>Home</h2>";
        break;

      case "profile":
        const profileModule = await import("./profile.js");
        profileModule.renderProfile();
        break;

      case "members":
        const membersModule = await import("./profile.js");
        membersModule.renderMembers();
        break;

      case "booking":
        const bookingModule = await import("./booking.js");
        bookingModule.renderBooking();
        break;

      case "cinema":
        const cinemaModule = await import("./cinema.js");
        cinemaModule.renderCinema();
        break;

      case "ranking":
        const leaderboardModule = await import("./leaderboard.js");
        leaderboardModule.renderAttendanceLeaderboard();
        break;

      case "dashboard":
        const dashboardModule = await import("./dashboard.js");
        dashboardModule.loadDashboard();
        break;

      default:
        content.innerHTML = "<h2>Page not found</h2>";
    }

  } catch (error) {

    console.error("Navigation error:", error);

    content.innerHTML = `
      <div style="padding:20px;color:red;">
        Something went wrong.
      </div>
    `;
  }
}

window.navigate = navigate;
