import { db, auth } from "../firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "../ui.js";
import { renderBooking } from "../booking.js";

export function openPoundForm(){

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
      <h2>🥁 Pound Session</h2>

      <input type="hidden" id="sportType" value="pound">

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="date">
      </div>

      <div class="sheet-section">
        <label>Jam</label>
        <input type="time" id="startTime">
      </div>

      <div class="sheet-section">
        <label>Class Type</label>
        <input type="text" id="style" placeholder="Pound Class">
      </div>

      <div class="sheet-section">
        <label>Kapasitas</label>
        <input type="number" id="maxPlayers">
      </div>

      <div class="sheet-section">
        <label>Catatan (WA / Info)</label>
        <textarea id="notes"></textarea>
      </div>

      <button id="submitPound" class="btn-create-session">
        Buat Sesi
      </button>
    </div>
  `;

  // 🔥 CLOSE
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  // 🔥 SUBMIT FIXED
  const btn = document.getElementById("submitPound");

  btn.onclick = async ()=>{

    try{

      const date = document.getElementById("date")?.value;
      const startTime = document.getElementById("startTime")?.value;
      const style = document.getElementById("style")?.value || "";
      const maxPlayers = Number(document.getElementById("maxPlayers")?.value);
      const notes = document.getElementById("notes")?.value || "";

      if(!date || !startTime){
        showToast("Lengkapi tanggal & jam","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        sportType: "pound",

        date,
        startTime,
        endTime: startTime,

        maxPlayers: maxPlayers || 0,
        slots: maxPlayers || 0,

        court: style || "Pound Session",

        notes,

        hostId: auth.currentUser.uid,

        status: "open",
        createdAt: serverTimestamp()

      });

      showToast("Pound session created","success");

      sheet.classList.remove("active");
      sheet.innerHTML = "";

      renderBooking();

    }catch(err){
      console.error("Pound error:", err);
      showToast("Gagal membuat sesi","error");
    }

  };

}
