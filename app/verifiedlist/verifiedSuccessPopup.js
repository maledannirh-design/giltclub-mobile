export function showVerifiedSuccessPopup(user){

  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const key =
    "verifiedPopupDismissed_success_" +
    witaDate.getFullYear() +
    "-" +
    String(witaDate.getMonth()+1).padStart(2,"0");

  if(localStorage.getItem(key) === "true") return;

  if(document.getElementById("verified-success-popup")) return;

  const popup = document.createElement("div");
  popup.id = "verified-success-popup";

  let message = "";

  if(user.verified === true){
    message = `
      <h2>🎉 Selamat!</h2>
      <p>Verified anda akan tetap bertahan.</p>
    `;
  }else{
    message = `
      <h2>🎉 Selamat!</h2>
      <p>Anda akan naik menjadi <b>Verified Member</b>.</p>
      <p>Screenshot halaman ini dan kirim ke admin untuk mengambil promosi ini.</p>
    `;
  }

  popup.innerHTML = `
  <div class="verified-popup-backdrop">
    <div class="verified-popup-box">

      ${message}

      <label class="verified-checkbox">
        <input type="checkbox" id="dont-show-verified">
        Jangan tampilkan lagi
      </label>

      <button id="verified-success-close">Mengerti</button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("verified-success-close").onclick = () => {

    const check = document.getElementById("dont-show-verified");

    if(check && check.checked){
      localStorage.setItem(key,"true");
    }

    popup.remove();
  };

}

