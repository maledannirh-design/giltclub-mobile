import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkInAttendance } from "./services/attendanceService.js";
import "./scanQR.js";

let html5QrInstance = null;
let cameraList = [];
let currentCameraIndex = 0;

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
  console.log("Schedule ID received:", scheduleId);
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
  let bookingMap = {}; // userId -> bookingId

  try {

    const bookingSnap = await getDocs(
      query(
        collection(db,"bookings"),
        where("scheduleId","==",scheduleId),
        where("status","==","active")
      )
    );

    bookingSnap.forEach(docSnap=>{
      const data = docSnap.data();

      bookingMap[data.userId] = docSnap.id;

      const opt = document.createElement("option");
      opt.value = data.userId;
      opt.textContent =
        data.displayName ||
        data.username ||
        data.fullName ||
        "Member";

      memberSelect.appendChild(opt);
    });

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
    await startCamera(scheduleId, resultBox, selectedUid, bookingMap[selectedUid]);
  };
}

/* =========================================
   PREPARE CAMERA
========================================= */
async function prepareCamera(){

  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    throw new Error("Permission kamera ditolak");
  }

  html5QrInstance = new Html5Qrcode("reader");

  cameraList = await Html5Qrcode.getCameras();

  if (!cameraList.length) {
    throw new Error("Camera tidak ditemukan");
  }

  const backIndex = cameraList.findIndex(device =>
    device.label.toLowerCase().includes("back") ||
    device.label.toLowerCase().includes("environment")
  );

  currentCameraIndex =
    backIndex >= 0 ? backIndex : cameraList.length - 1;
}

/* =========================================
   START CAMERA (QR SIMPLE VALIDATION)
========================================= */
async function startCamera(scheduleId, resultBox, selectedUid, bookingId) {

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const cameraId = cameraList[currentCameraIndex].id;

  const videoConstraints = isIOS
    ? {
        facingMode: { exact: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      }
    : cameraId;

  const config = {
    fps: isIOS ? 20 : 30,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const qrSize = Math.floor(minEdge * (isIOS ? 0.75 : 0.8));
      return { width: qrSize, height: qrSize };
    },
    aspectRatio: 1.0,
    disableFlip: true,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };

  try {

    await html5QrInstance.start(
      videoConstraints,
      config,
      async (decodedText) => {

        try { await html5QrInstance.stop(); } catch(e){}

        try {

          const cleaned = decodedText.trim();

          // 🔥 QR VALIDASI SEDERHANA
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
    );

    if (isIOS) {
      setTimeout(() => {
        try {
          html5QrInstance.pause(false);
        } catch (e) {}
      }, 400);
    }

  } catch (err) {
    resultBox.innerHTML =
      `<div class="invalid-box">
        Kamera gagal dibuka<br>
        ${err.message}
      </div>`;
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
