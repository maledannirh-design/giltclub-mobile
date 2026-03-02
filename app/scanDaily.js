import { auth, db } from "./firebase.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import "./scanQR.js";

let html5QrInstance = null;

/* =========================================
   INIT DAILY SCANNER (UNIVERSAL SAFE)
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  readerEl.style.display = "block";

  // Hindari multiple instance
  if (html5QrInstance) {
    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch(e){}
    html5QrInstance = null;
  }

  await startCamera(resultBox);
}


/* =========================================
   START CAMERA (NO getCameras, SAFE)
========================================= */
async function startCamera(resultBox){

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

  try {

    // 🔥 TRY 1: environment string
    await html5QrInstance.start(
      { facingMode: "environment" },
      config,
      onScanSuccess
    );

  } catch (err1) {

    console.warn("Environment failed, fallback to default camera");

    try {

      // 🔥 TRY 2: fallback laptop default camera
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

  async function onScanSuccess(decodedText){

    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch(e){}

    html5QrInstance = null;

    const cleaned = decodedText.trim();

    if (!cleaned.includes("giltclub.my.id")) {
      showInvalid(resultBox, "QR tidak valid");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      showInvalid(resultBox, "User belum login");
      return;
    }

    try {
      const reward = await runDailyStreakReward(currentUser.uid);
      showSuccess(resultBox, reward);
    } catch (err) {
      showInvalid(resultBox, err.message || "Gagal check-in");
    }
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
