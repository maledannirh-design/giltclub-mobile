function navigate(page){

  document.querySelectorAll(".nav-btn")
    .forEach(btn=>btn.classList.remove("active"));

  event.currentTarget.classList.add("active");

  const content = document.getElementById("content");

  if(page === "home"){
    content.innerHTML = `
      <h2>Welcome to GILT Club</h2>
      <p style="margin-top:10px;color:#64748b">
        Modern tennis community experience.
      </p>
    `;
  }

  if(page === "booking"){
    content.innerHTML = `
      <h2>Booking</h2>
      <p style="margin-top:10px;color:#64748b">
        Schedule & reserve your court.
      </p>
    `;
  }

  if(page === "wallet"){
    content.innerHTML = `
      <h2>Wallet</h2>
      <p style="margin-top:10px;color:#64748b">
        Manage your balance & transactions.
      </p>
    `;
  }

  if(page === "profile"){
    content.innerHTML = `
      <div style="text-align:center">
        <img src="images/default_profile.webp"
             style="width:90px;height:90px;border-radius:50%;object-fit:cover;">
        <h3 style="margin-top:12px">Member Name</h3>
        <p style="color:#64748b">member@email.com</p>
      </div>
    `;
  }

  if(page === "settings"){
    content.innerHTML = `
      <h2>Settings</h2>
      <p style="margin-top:10px;color:#64748b">
        Account & preferences.
      </p>
    `;
  }
}

function openSettings(){
  navigate("settings");
}

document.addEventListener("DOMContentLoaded", ()=>{
  navigate("home");
});

