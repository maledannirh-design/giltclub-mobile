import { auth, db } from "./firebase.js";
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
let cameraList = [];
let currentCameraIndex = 0;

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

  // Hindari instance ganda
  if (html5QrInstance) {
    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch(e){}
    html5QrInstance = null;
  }

  await startCamera(
    scheduleId,
    resultBox,
    selectedUid,
    bookingMap[selectedUid]
  );
};


/* =========================================
   START CAMERA (UNIVERSAL SAFE ENGINE)
========================================= */
async function startCamera(scheduleId, resultBox, selectedUid, bookingId) {

  try {

    // Permission warmup
    const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
    testStream.getTracks().forEach(t => t.stop());

  } catch (err) {

    resultBox.innerHTML =
      `<div class="invalid-box">
        Permission kamera ditolak
      </div>`;
    return;
  }

  html5QrInstance = new Html5Qrcode("reader");

  const config = {
    fps: 20,
    qrbox: (vw, vh) => {
      const size = Math.floor(Math.min(vw, vh) * 0.8);
      return { width: size, height: size };
    },
    aspectRatio: 1.0
  };

  async function onScanSuccess(decodedText){

    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch(e){}

    html5QrInstance = null;

    const cleaned = decodedText.trim();

    if (!cleaned.includes("giltclub.my.id")) {
      showInvalid(resultBox, "QR tidak valid");
      return setTimeout(goBack,1500);
    }

    try {

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

    // TRY 1 – environment
    await html5QrInstance.start(
      { facingMode: "environment" },
      config,
      onScanSuccess
    );

  } catch (err1) {

    console.warn("Environment failed, fallback to default camera");

    try {

      // TRY 2 – fallback default camera
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
   UI SUCCESS
========================================= */
function showSuccess(resultBox, res){

  const role = (res.role || "MEMBER").toUpperCase();

  const roleColor =
    role === "VVIP" ? "#FFD700" :
    role === "VERIFIED" ? "#00C2FF" :
    "#aaa";

  const cashbackText = res.cashback > 0
    ? `💰 Cashback Rp ${res.cashback.toLocaleString("id-ID")}`
    : `💰 Tidak ada cashback`;

  const gpointText = res.earnedGPoint > 0
    ? `⭐ GPoint +${res.earnedGPoint}`
    : "";

  resultBox.innerHTML = `
    <div class="result-box success">
      <div style="font-size:20px;margin-bottom:10px;">
        ✅ CHECK-IN BERHASIL
      </div>

      <div style="
        display:inline-block;
        padding:6px 14px;
        border-radius:20px;
        font-size:13px;
        font-weight:bold;
        background:${roleColor};
        color:#000;
        margin-bottom:12px;
      ">
        ${role}
      </div>

      <div>${cashbackText}</div>
      <div>${gpointText}</div>

      <div style="font-size:12px;opacity:0.6;margin-top:10px;">
        📅 ${res.sessionDate}
      </div>
    </div>
  `;
}

/* =========================================
   UI INVALID
========================================= */
function showInvalid(resultBox, message){

  resultBox.innerHTML = `
    <div class="result-box error">
      ❌ ${message}
    </div>
  `;
}

/* =========================================
   GO BACK
========================================= */
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

/* =========================================
   STOP SCANNER MANUAL
========================================= */
export async function stopCheckinScanner() {

  if (!html5QrInstance) return;

  try {
    await html5QrInstance.stop();
    await html5QrInstance.clear();
  } catch (e) {}

  html5QrInstance = null;
}
