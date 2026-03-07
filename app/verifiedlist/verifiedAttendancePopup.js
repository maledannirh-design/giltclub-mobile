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

      <button id="attendance-warning-close">
        Mengerti
      </button>

    </div>
  </div>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("attendance-warning-close")
    .onclick = () => popup.remove();

}
