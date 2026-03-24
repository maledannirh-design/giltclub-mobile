import { db, auth } from "../firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "../ui.js";
import { renderBooking } from "../booking.js";

export function openDanceForm(){

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
      <h2>💃 Dance Session</h2>

      <input type="hidden" id="sportType" value="dance">

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="date">
      </div>

      <div class="sheet-section">
        <label>Jam</label>
        <input type="time" id="startTime">
      </div>

      <div class="sheet-section">
        <label>Style</label>
        <input type="text" id="style" placeholder="Dance Style">
      </div>

      <div class="sheet-section">
        <label>Kapasitas</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Catatan (WA / Info)</label>
        <textarea id="notes"></textarea>
      </div>

      <button id="submitDance" class="btn-create-session">
        Buat Sesi
      </button>
    </div>
  `;

  // 🔥 CLOSE
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  // 🔥 SUBMIT (FIXED)
  const btn = document.getElementById("submitDance");

  btn.onclick = async ()=>{

    try{

      const date = document.getElementById("date").value;
      const startTime = document.getElementById("startTime").value;
      const style = document.getElementById("style").value.trim();
      const maxPlayers = Number(document.getElementById("maxPlayers").value);
      const notes = document.getElementById("notes").value.trim();

      if(!date || !startTime){
        showToast("Lengkapi tanggal & jam","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        sportType: "dance",

        date,
        startTime,
        endTime: startTime,

        maxPlayers: maxPlayers || 0,
        slots: maxPlayers || 0,

        court: style || "Dance Session",

        notes: notes || "",

        hostId: auth.currentUser.uid,

        status: "open",
        createdAt: serverTimestamp()

      });

      showToast("Dance session created","success");

      sheet.classList.remove("active");
      sheet.innerHTML = "";

      renderBooking();

    }catch(err){
      console.error(err);
      showToast("Gagal membuat sesi","error");
    }

  };

}
