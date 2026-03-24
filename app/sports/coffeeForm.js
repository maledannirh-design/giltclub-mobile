import { db, auth } from "../firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "../ui.js";
import { renderBooking } from "../booking.js";

export async function openCoffeeForm(){

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
      <h2>☕ Coffee Time</h2>

      <input type="hidden" id="sportType" value="coffee">

      <div class="sheet-section">
        <label>Tanggal</label>
        <input type="date" id="date">
      </div>

      <div class="sheet-section">
        <label>Jam</label>
        <input type="time" id="startTime">
      </div>

      <div class="sheet-section">
        <label>Lokasi</label>
        <input type="text" id="location" placeholder="Cafe Location">
      </div>

      <div class="sheet-section">
        <label>Kapasitas</label>
        <input type="number" id="maxPlayers" placeholder="Capacity">
      </div>

      <div class="sheet-section">
        <label>Catatan (WA / Info)</label>
        <textarea id="notes"></textarea>
      </div>

      <button id="submitCoffee" class="btn-create-session">
        Buat Sesi
      </button>
    </div>
  `;

  // 🔥 CLOSE OVERLAY
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  // 🔥 SUBMIT HANDLER (FIXED)
  const btn = document.getElementById("submitCoffee");

  btn.onclick = async ()=>{

    try{

      const date = document.getElementById("date").value;
      const startTime = document.getElementById("startTime").value;
      const location = document.getElementById("location").value.trim();
      const maxPlayers = Number(document.getElementById("maxPlayers").value);
      const notes = document.getElementById("notes").value.trim();

      if(!date || !startTime){
        showToast("Lengkapi tanggal & jam","error");
        return;
      }

      await addDoc(collection(db,"schedules"),{

        sportType: "coffee",

        date,
        startTime,
        endTime: startTime, // simple session

        maxPlayers: maxPlayers || 0,
        slots: maxPlayers || 0,

        court: location || "-",

        notes: notes || "",
        hostId: auth.currentUser.uid,

        status: "open",
        createdAt: serverTimestamp()

      });

      showToast("Coffee session created","success");

      sheet.classList.remove("active");
      sheet.innerHTML = "";

      renderBooking();

    }catch(err){
      console.error(err);
      showToast("Gagal membuat sesi","error");
    }

  };

}
