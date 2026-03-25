import { db, auth } from "../firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "../ui.js";
import { renderBooking } from "../booking.js";

export function openDukunForm(){

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
      <h2>🧙‍♂️ Ritual Pesugihan</h2>

      <input type="hidden" id="sportType" value="dukun">

      <div class="sheet-section">
        <label>Tanggal Ritual</label>
        <input type="date" id="date">
      </div>

      <div class="sheet-section">
        <label>Jam Mulai</label>
        <input type="time" id="startTime">
      </div>

      <div class="sheet-section">
        <label>Jenis Ritual</label>
        <input type="text" id="ritualType" placeholder="Contoh: Pesugihan Gunung Kawi">
      </div>

      <div class="sheet-section">
        <label>Jumlah Tumbal</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Catatan Khusus</label>
        <textarea id="notes" placeholder="Syarat, tumbal, dll..."></textarea>
      </div>

      <button id="submitDukun" class="btn-create-session">
        Mulai Ritual
      </button>
    </div>
  `;

  // CLOSE
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  // SUBMIT
  document.getElementById("submitDukun").onclick = async ()=>{

    try{

      const date = document.getElementById("date").value;
      const startTime = document.getElementById("startTime").value;
      const ritualType = document.getElementById("ritualType").value || "Ritual";
      const maxPlayers = Number(document.getElementById("maxPlayers").value);
      const notes = document.getElementById("notes").value || "";

      if(!date || !startTime){
        showToast("Lengkapi tanggal & jam ritual","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        sportType: "dukun",

        date,
        startTime,
        endTime: startTime,

        maxPlayers: maxPlayers || 0,
        slots: maxPlayers || 0,

        court: ritualType, // 🔥 tetap pakai field existing
        notes,

        hostId: auth.currentUser.uid,

        status: "open",
        createdAt: serverTimestamp()

      });

      showToast("Ritual berhasil dibuka 😈","success");

      sheet.classList.remove("active");
      sheet.innerHTML = "";

      renderBooking();

    }catch(err){
      console.error(err);
      showToast("Ritual gagal dimulai","error");
    }

  };

}
