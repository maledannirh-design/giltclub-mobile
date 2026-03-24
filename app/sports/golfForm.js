import { auth } from "../firebase.js";
import { showToast } from "../ui.js";
import { setupCreateSessionSubmit } from "../booking.js";

export async function openGolfForm(){

  if(!auth.currentUser){
    showToast("Login terlebih dahulu","error");
    return;
  }

  const sheet = document.getElementById("createSessionSheet");
  if(!sheet) return;

  sheet.classList.add("active");

  sheet.innerHTML = `
    <div id="createSessionOverlay"></div>

    <div class="premium-sheet">
      <div class="sheet-handle"></div>
      <h2>Golf Session</h2>

      <input type="hidden" id="sportType" value="golf">

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="sessionDate">
      </div>

      <div class="sheet-section">
        <label>Jam</label>
        <input type="time" id="startTime">
      </div>

      <div class="sheet-section">
        <label>Lokasi</label>
        <input type="text" id="court">
      </div>

      <div class="sheet-section">
        <label>Catatan (WA / Info)</label>
        <textarea id="notes"></textarea>
      </div>

      <button id="submitCreateSession" class="btn-create-session">
        Buat Sesi
      </button>
    </div>
  `;

  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  setupCreateSessionSubmit();
}
