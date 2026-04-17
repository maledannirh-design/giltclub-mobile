import { auth } from "../firebase.js";
import { showToast } from "../ui.js";
import { db } from "../firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let isSubmittingGolf = false;
let lastSubmitTime = 0;

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

  // CLOSE
  document.getElementById("createSessionOverlay").onclick = ()=>{
    sheet.classList.remove("active");
    sheet.innerHTML = "";
  };

  const btn = document.getElementById("submitCreateSession");

  // 🛑 PENTING: clear handler dulu (hindari double bind)
  btn.onclick = null;

  btn.onclick = async ()=>{

    // =========================
    // 🔒 ANTI SPAM CLICK
    // =========================
    const now = Date.now();

    if(isSubmittingGolf){
      console.warn("BLOCK: still submitting");
      return;
    }

    // throttle 1.5 detik
    if(now - lastSubmitTime < 1500){
      console.warn("BLOCK: too fast click");
      return;
    }

    isSubmittingGolf = true;
    lastSubmitTime = now;

    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    try{

      const dateEl = document.getElementById("sessionDate");
      const timeEl = document.getElementById("startTime");
      const courtEl = document.getElementById("court");
      const notesEl = document.getElementById("notes");

      if(!dateEl || !timeEl || !courtEl || !notesEl){
        showToast("Form error","error");
        return;
      }

      const date = dateEl.value?.trim();
      const time = timeEl.value?.trim();
      const court = courtEl.value?.trim();
      const notes = notesEl.value?.trim();

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

      const payload = {
        sport: "golf",
        createdBy: user.uid,
        date,
        time,
        court,
        notes: notes || "",
        createdAt: new Date().toISOString(),
        status: "open",
        maxPlayer: 4
      };

      console.log("CREATE GOLF:", payload);

      await addDoc(collection(db,"sessions"), payload);

      showToast("Sesi golf berhasil dibuat","success");

      sheet.classList.remove("active");
      sheet.innerHTML = "";

    }catch(err){

      console.error("CREATE GOLF ERROR:", err);

      if(err.code === "resource-exhausted"){
        showToast("Server penuh, coba lagi nanti","error");
      }else{
        showToast("Error: " + err.message,"error");
      }

    }finally{

      isSubmittingGolf = false;

      if(btn){
        btn.disabled = false;
        btn.innerText = "Buat Sesi";
      }

    }

  };

}
