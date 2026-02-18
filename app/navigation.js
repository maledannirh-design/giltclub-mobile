export function navigate(page){

  const content = document.getElementById("content");

  switch(page){

    case "home":
      content.innerHTML = "<h2>Home</h2>";
      break;

    case "profile":
      import("./profile.js").then(m=>m.renderProfile());
      break;

    case "booking":
      import("./booking.js").then(m=>m.renderBooking());
      break;

    case "cinema":
      import("./cinema.js").then(m=>m.renderCinema());
      break;
    case "members":
      import("./profile.js").then(m => m.renderMembers());
      break;
      case "ranking":
  import("./profile.js").then(m => m.renderRanking());
  break;



    default:
      content.innerHTML = "<h2>Page not found</h2>";
  }
}

