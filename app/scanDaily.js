import { auth, db } from "./firebase.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import "./scanQR.js";

let html5QrInstance = null;
let cameraList = [];
let currentCameraIndex = 0;

/* =========================================
   INIT DAILY SCANNER (SAME CONFIG AS CHECKIN)
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  readerEl.style.display = "block";

  await prepareCamera();
  await startCamera(resultBox);
}

/* =========================================
   PREPARE CAMERA (SAME ENGINE)
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
   START CAMERA (MATCH CHECKIN CONFIG)
========================================= */
async function startCamera(resultBox){

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

          if (!cleaned.includes("giltclub.my.id")) {
            showInvalid(resultBox, "QR tidak valid");
            return setTimeout(goBack,1500);
          }

          const currentUser = auth.currentUser;
          if (!currentUser) {
            showInvalid(resultBox, "User belum login");
            return setTimeout(goBack,1500);
          }

          const reward =
            await runDailyStreakReward(currentUser.uid);

          showSuccess(resultBox, reward);

        } catch (err) {

          showInvalid(resultBox, err.message || "Gagal check-in");
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
   DAILY STREAK ENGINE
========================================= */
async function runDailyStreakReward(uid){

  const ref = doc(db,"users",uid);

  return await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(ref);
    if(!snap.exists()) throw new Error("User tidak ditemukan");

    const data = snap.data();

    const today = new Date().toISOString().split("T")[0];
    const last = data.lastCheckinDate || null;

    if(last === today){
      throw new Error("Sudah check-in hari ini");
    }

    let streak = data.currentStreak || 0;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate()-1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if(last !== yesterdayStr){
      streak = 0;
    }

    streak += 1;
    if(streak > 7) streak = 1;

    const isVVIP =
      (data.membership || "").toUpperCase() === "VVIP";

    const reward = isVVIP
      ? (streak === 7 ? 200 : 15)
      : (streak === 7 ? 150 : 10);

    transaction.update(ref,{
      currentStreak: streak,
      lastCheckinDate: today,
      gPoint: (data.gPoint || 0) + reward
    });

    return reward;
  });
}

/* =========================================
   UI
========================================= */
function showSuccess(resultBox, reward){
  resultBox.innerHTML =
    `<div class="result-box success">
      ⭐ DAILY STREAK SUCCESS<br>
      +${reward} GPoint
    </div>`;
}

function showInvalid(resultBox, message){
  resultBox.innerHTML =
    `<div class="result-box error">
      ❌ ${message}
    </div>`;
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
