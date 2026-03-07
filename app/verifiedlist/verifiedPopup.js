export function showVerifiedWarningPopup() {

  if (document.getElementById("verified-warning-popup")) return;

  const popup = document.createElement("div");
  popup.id = "verified-warning-popup";

  popup.innerHTML = `
    <div class="verified-popup-backdrop">
      <div class="verified-popup-box">

        <h2>⚠ Verified Warning</h2>

        <p>
        Verified anda akan segera dilepas.
        </p>

        <p>
        Mohon lakukan pengisian saldo ke batas minimal saldo tersisa
        <b>Rp250.000</b>
        sebelum tanggal <b>7</b>.
        </p>

        <button id="verified-warning-close">
          Mengerti
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("verified-warning-close")
    .onclick = () => popup.remove();

}
