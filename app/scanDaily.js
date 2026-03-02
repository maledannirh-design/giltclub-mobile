import { db } from "./firebase.js";
import {
  collection,
  query,
  doc,
  getDoc,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkInAttendance } from "./services/attendanceService.js";
import "./scanQR.js";

let html5QrInstance = null;


/* =========================================
   INIT CHECK-IN SCANNER (DROPDOWN VERSION)
========================================= */
/* =========================================
   INIT CHECK-IN SCANNER (DROPDOWN VERSION)
========================================= */
export async function initCheckinScanner({
  readerId,
  resultId,
  scheduleId,
  memberSelectId,
  startBtnId
}) {

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);
  const memberSelect = document.getElementById(memberSelectId);
  const startBtn = document.getElementById(startBtnId);

  if (!readerEl || !resultBox || !memberSelect || !startBtn) return;

  if (!scheduleId) {
    resultBox.innerHTML =
      `<div class="invalid-box">Schedule tidak ditemukan</div>`;
    return;
  }

  /* =========================================
     LOAD BOOKING ACTIVE
  ========================================= */
  let bookingMap = {};

  try {

    const bookingSnap = await getDocs(
      query(
        collection(db,"bookings"),
        where("scheduleId","==",scheduleId),
        where("status","==","active")
      )
    );

    if (bookingSnap.empty) {
      resultBox.innerHTML =
        `<div class="invalid-box">Belum ada peserta</div>`;
      return;
    }

    memberSelect.innerHTML =
      `<option value="">-- Pilih Member --</option>`;

    const loadPromises = bookingSnap.docs.map(async (docSnap) => {

      const data = docSnap.data();
      const userId = data.userId;

      bookingMap[userId] = docSnap.id;

      let displayText = "Member";

      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          const username =
            userData.usernameID ||
            userData.username ||
            "";

          const fullName =
            userData.fullName ||
            "";

          if (username && fullName) {
            displayText = `${username} - ${fullName}`;
          } else if (username) {
            displayText = username;
          } else if (fullName) {
            displayText = fullName;
          }
        }

      } catch (e) {
        console.error("Gagal load identity user:", e);
      }

      const opt = document.createElement("option");
      opt.value = userId;
      opt.textContent = displayText;

      memberSelect.appendChild(opt);
    });

    await Promise.all(loadPromises);

  } catch(err){
    resultBox.innerHTML =
      `<div class="invalid-box">Gagal load peserta</div>`;
    return;
  }

  /* =========================================
     START BUTTON CLICK
  ========================================= */
  startBtn.onclick = async ()=>{

    const selectedUid = memberSelect.value;

    if(!selectedUid){
      resultBox.innerHTML =
        `<div class="invalid-box">Pilih member dulu</div>`;
      return;
    }

    if(!bookingMap[selectedUid]){
      resultBox.innerHTML =
        `<div class="invalid-box">Booking tidak ditemukan</div>`;
      return;
    }

    document.getElementById("checkinControlPanel").style.display = "none";
    readerEl.style.display = "block";

    await prepareCamera();
    await startCamera(
      scheduleId,
      resultBox,
      selectedUid,
      bookingMap[selectedUid]
    );
  };
}


/* =========================================
   PREPARE CAMERA (UNIVERSAL SAFE)
========================================= */
async function prepareCamera(){

  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    throw new Error("Permission kamera ditolak");
  }

  html5QrInstance = new Html5Qrcode("reader");
}


/* =========================================
   START CAMERA (CHROME ANDROID SAFE)
========================================= */
async function startCamera(scheduleId, resultBox, selectedUid, bookingId) {

  const config = {
    fps: 20,
    qrbox: (vw, vh) => {
      const size =
        Math.floor(Math.min(vw, vh) * 0.8);
      return { width: size, height: size };
    },
    aspectRatio: 1.0
  };

  async function onScanSuccess(decodedText){

    try { await html5QrInstance.stop(); } catch(e){}
    try { await html5QrInstance.clear(); } catch(e){}

    try {

      const cleaned = decodedText.trim();

      if (!cleaned.includes("giltclub.my.id")) {
        showInvalid(resultBox, "QR tidak valid");
        return setTimeout(goBack,1500);
      }

      const res = await checkInAttendance({
        bookingId,
        scannedUid: selectedUid
      });

      showSuccess(resultBox, res);

    } catch (err) {

      showInvalid(resultBox, err.message || "Check-in gagal");
    }

    setTimeout(goBack,1500);
  }

  try {

    // Try Android / Mobile
    await html5QrInstance.start(
      { facingMode: "environment" },
      config,
      onScanSuccess
    );

  } catch (err1) {

    try {

      // Fallback Laptop
      await html5QrInstance.start(
        { video: true },
        config,
        onScanSuccess
      );

    } catch (err2) {

      resultBox.innerHTML =
        `<div class="invalid-box">
          Kamera gagal dibuka
        </div>`;
    }
  }
}
/* =========================================
   UI
========================================= */
function showSuccess(resultBox, res){

  resultBox.innerHTML = `
    <div class="result-box success">
      ✅ CHECK-IN BERHASIL
    </div>
  `;
}

function showInvalid(resultBox, message){

  resultBox.innerHTML = `
    <div class="result-box error">
      ❌ ${message}
    </div>
  `;
}

async function goBack(){

  try{
    if (html5QrInstance) {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    }
  }catch(e){}

  html5QrInstance = null;
  window.history.back();
}
