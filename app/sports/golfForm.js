import { auth } from "../firebase.js";
import { showToast } from "../ui.js";
import { db } from "../firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        <input type="text" id="court" placeholder="Contoh: Mahogany">
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

  // =========================
  // CLOSE HANDLER
  // =========================
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  // =========================
  // SUBMIT HANDLER (FIX UTAMA)
  // =========================
  document.getElementById("submitCreateSession").onclick = async ()=>{

    try{

      const dateEl = document.getElementById("sessionDate");
      const timeEl = document.getElementById("startTime");
      const courtEl = document.getElementById("court");
      const notesEl = document.getElementById("notes");

      // VALIDASI ELEMENT
      if(!dateEl || !timeEl || !courtEl || !notesEl){
        console.error("Golf form element missing", {
          dateEl, timeEl, courtEl, notesEl
        });
        showToast("Form error (element tidak ditemukan)","error");
        return;
      }

      // AMBIL VALUE
      const date = dateEl.value?.trim();
      const time = timeEl.value?.trim();
      const court = courtEl.value?.trim();
      const notes = notesEl.value?.trim();

      // VALIDASI INPUT
      if(!date){
        showToast("Tanggal wajib diisi","error");
        return;
      }

      if(!time){
        showToast("Jam wajib diisi","error");
        return;
      }

      if(!court){
        showToast("Lokasi wajib diisi","error");
        return;
      }

      const user = auth.currentUser;
      if(!user){
        showToast("User tidak valid","error");
        return;
      }

      // =========================
      // BUILD DATA
      // =========================
      const payload = {
        sport: "golf",
        createdBy: user.uid,
        date,
        time,
        court,
        notes: notes || "",
        createdAt: new Date().toISOString(),
        status: "open",
        maxPlayer: 4 // optional: golf typical flight
      };

      console.log("CREATE GOLF:", payload);

      // =========================
      // SAVE
      // =========================
      await addDoc(collection(db,"sessions"), payload);

      showToast("Sesi golf berhasil dibuat","success");

      // CLOSE SHEET
      sheet.classList.remove("active");
      sheet.innerHTML = "";

    }catch(err){

      console.error("CREATE GOLF ERROR:", err);
      showToast("Error: " + err.message,"error");

    }

  };

}
