import { auth, db } from "./firebase.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import "./scanQR.js";

let html5QrInstance = null;

/* =========================================
   INIT DAILY SCANNER (CHROME ANDROID SAFE)
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  readerEl.style.display = "block";

  await startCamera(resultBox);
}

/* =========================================
   START CAMERA (NO getCameras)
========================================= */
async function startCamera(resultBox){

  try {

    // 🔥 WAJIB: request permission dulu
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    stream.getTracks().forEach(t => t.stop());

  } catch (err) {

    const msg =
      err?.message ||
      err?.name ||
      "Permission kamera ditolak";

    resultBox.innerHTML =
      `<div class="invalid-box">${msg}</div>`;
    return;
  }

  html5QrInstance = new Html5Qrcode("reader");

  const config = {
    fps: 20,
    qrbox: (vw, vh) => {
      const minEdge = Math.min(vw, vh);
      const size = Math.floor(minEdge * 0.8);
      return { width: size, height: size };
    },
    aspectRatio: 1.0,
    disableFlip: true
  };

  try {

    await html5QrInstance.start(
      { facingMode: { ideal: "environment" } }, // 🔥 Chrome Safe
      config,
      async (decodedText) => {

        try {
          await html5QrInstance.stop();
          await html5QrInstance.clear();
        } catch(e){}

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

        try {

          const reward =
            await runDailyStreakReward(currentUser.uid);

          showSuccess(resultBox, reward);

        } catch (err) {

          showInvalid(
            resultBox,
            err?.message || "Gagal check-in"
          );
        }

        setTimeout(goBack,1500);
      }
    );

  } catch (err) {

    const msg =
      err?.message ||
      err?.name ||
      "Kamera gagal dibuka";

    resultBox.innerHTML =
      `<div class="invalid-box">${msg}</div>`;
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
