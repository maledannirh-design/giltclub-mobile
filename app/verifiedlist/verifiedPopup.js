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

        <label class="verified-checkbox">
          <input type="checkbox" id="dont-show-verified">
          Jangan tampilkan lagi
        </label>

        <button id="verified-warning-close">
          Mengerti
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const closeBtn = document.getElementById("verified-warning-close");

  closeBtn.onclick = () => {

    const check = document.getElementById("dont-show-verified");

    if (check && check.checked) {

      const now = new Date();
      const witaDate = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Makassar" })
      );

      const key =
        "verifiedPopupDismissed_" +
        witaDate.getFullYear() +
        "-" +
        String(witaDate.getMonth() + 1).padStart(2, "0");

      localStorage.setItem(key, "true");
    }

    popup.remove();
  };

}
