export function showVerifiedSuccessPopup(user){

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
      <p>Screenshot halaman ini dan kirim ke admin
      untuk mengambil promosi ini.</p>
    `;
  }

  popup.innerHTML = `
    <div class="verified-popup-backdrop">
      <div class="verified-popup-box">

        ${message}

        <button id="verified-success-close">
          Mengerti
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("verified-success-close")
    .onclick = () => popup.remove();

}
