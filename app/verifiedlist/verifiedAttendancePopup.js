export function showAttendanceWarningPopup(){

  if(document.getElementById("attendance-warning-popup")) return;

  const popup = document.createElement("div");
  popup.id = "attendance-warning-popup";

  popup.innerHTML = `
  <div class="verified-popup-backdrop">
    <div class="verified-popup-box">

      <h2>⚠ Attendance Belum Cukup</h2>

      <p>
      Kehadiran bulan lalu belum memenuhi syarat.
      </p>

      <p>
      Datang bermain minimal <b>2 kali dalam 1 bulan</b>
      untuk mendapatkan atau mempertahankan
      status <b>Verified Member</b>.
      </p>

      <label class="verified-checkbox">
        <input type="checkbox" id="dont-show-verified">
        Jangan tampilkan lagi
      </label>

      <button id="attendance-warning-close">
        Mengerti
      </button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  const closeBtn = document.getElementById("attendance-warning-close");

  closeBtn.onclick = () => {

    const check = document.getElementById("dont-show-verified");

    if(check && check.checked){

      const now = new Date();
      const witaDate = new Date(
        now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
      );

      const key =
        "verifiedPopupDismissed_" +
        witaDate.getFullYear() +
        "-" +
        String(witaDate.getMonth()+1).padStart(2,"0");

      localStorage.setItem(key,"true");
    }

    popup.remove();
  };

}
