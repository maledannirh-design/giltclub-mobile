import { db, auth } from "../firebase.js";
import { showToast } from "../ui.js";
import { setupCreateSessionSubmit } from "../booking.js";

export async function openTennisForm(){

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
      <h2>Buat Sesi Tennis</h2>

      <!-- 🔥 HIDDEN SPORT TYPE -->
      <input type="hidden" id="sportType" value="tennis">

      <div class="sheet-section">
        <label>Tier Sesi</label>
        <select id="tier">
          <option>Newbie</option>
          <option>Beginner</option>
          <option>Upper Beginner</option>
          <option>Intermediate</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Jenis Sesi</label>
        <select id="sessionType">
          <option value="Mabar">Mabar</option>
          <option value="Drill">Drill</option>
          <option value="Drill + Mabar">Drill + Mabar</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Tipe Sesi</label>
        <select id="sessionMode">
          <option value="reguler">Reguler</option>
          <option value="semi-private">Semi Private</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div class="sheet-section">
        <label>Maksimal Pemain</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="sessionDate">
      </div>

      <div class="sheet-section">
        <div class="time-row">
          <div>
            <label>Jam Mulai</label>
            <input type="time" id="startTime">
          </div>
          <div>
            <label>Jam Selesai</label>
            <input type="time" id="endTime">
          </div>
        </div>
      </div>

      <div class="sheet-section">
        <label>Lapangan</label>
        <input type="text" id="court">
      </div>

      <div class="sheet-section">
        <label>Rate / Jam</label>
        <input type="number" id="ratePerHour">
      </div>

      <div class="sheet-section">
        <label>Raket Sewaan</label>
        <input type="number" id="racketStock">
      </div>

      <div class="sheet-section">
        <label>Rate Raket</label>
        <input type="number" id="racketRate">
      </div>

      <div class="sheet-section">
        <label>Catatan</label>
        <textarea id="notes"></textarea>
      </div>

      <div class="sheet-section">
        <label>Cashback Member</label>
        <input type="number" id="cashbackMember">
      </div>

      <div class="sheet-section">
        <label>Cashback Verified</label>
        <input type="number" id="cashbackVerified">
      </div>

      <div class="sheet-section">
        <label>Cashback VVIP</label>
        <input type="number" id="cashbackVVIP">
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

};
