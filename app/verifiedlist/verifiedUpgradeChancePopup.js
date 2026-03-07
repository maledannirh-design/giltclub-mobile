export function showUpgradeChancePopup(){

  if(document.getElementById("verified-upgrade-popup")) return;

  const popup = document.createElement("div");
  popup.id = "verified-upgrade-popup";

  popup.innerHTML = `
  <div class="verified-popup-backdrop">
    <div class="verified-popup-box">

      <h2>✨ Kesempatan Verified</h2>

      <p>
      Anda berkesempatan menjadi
      <b>Verified Member</b>.
      </p>

      <p>
      Lakukan pengisian saldo sampai
      minimal tersisa <b>Rp250.000</b>
      sebelum tanggal <b>7</b>.
      </p>

      <button id="verified-upgrade-close">
        Mengerti
      </button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("verified-upgrade-close")
    .onclick = () => popup.remove();

}
