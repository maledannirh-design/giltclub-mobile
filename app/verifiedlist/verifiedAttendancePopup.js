export function showAttendanceWarningPopup(){

  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const key =
    "verifiedPopupDismissed_attendance_" +
    witaDate.getFullYear() +
    "-" +
    String(witaDate.getMonth()+1).padStart(2,"0");

  if(localStorage.getItem(key) === "true") return;

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
      Datang bermain minimal <b>2 kali</b> dalam 1 bulan
      untuk mendapatkan status <b>Verified Member</b>.
      </p>

      <label class="verified-checkbox">
        <input type="checkbox" id="dont-show-verified">
        Jangan tampilkan lagi
      </label>

      <button id="attendance-warning-close">Mengerti</button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("attendance-warning-close").onclick = () => {

    const check = document.getElementById("dont-show-verified");

    if(check && check.checked){
      localStorage.setItem(key,"true");
    }

    popup.remove();
  };

}


