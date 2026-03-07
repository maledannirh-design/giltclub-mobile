export function showUpgradeChancePopup(){

  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const key =
    "verifiedPopupDismissed_upgrade_" +
    witaDate.getFullYear() +
    "-" +
    String(witaDate.getMonth()+1).padStart(2,"0");

  if(localStorage.getItem(key) === "true") return;

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
      Lakukan pengisian saldo sampai minimal
      tersisa <b>Rp250.000</b> sebelum tanggal <b>7</b>.
      </p>

      <label class="verified-checkbox">
        <input type="checkbox" id="dont-show-verified">
        Jangan tampilkan lagi
      </label>

      <button id="verified-upgrade-close">Mengerti</button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("verified-upgrade-close").onclick = () => {

    const check = document.getElementById("dont-show-verified");

    if(check && check.checked){
      localStorage.setItem(key,"true");
    }

    popup.remove();
  };

}
