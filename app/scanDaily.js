import { auth } from "./firebase.js";
import { doc, runTransaction, collection } from "./firestore.js";
import { db } from "./firebase.js";
import "./scanQR.js";

let html5QrInstance = null;

/* =========================================
   INIT DAILY SCANNER
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  html5QrInstance = new Html5Qrcode(readerId);

  let currentCameraId = null;
  let cameras = [];

  try{
    // 🔥 Force permission first (iOS safe)
    await navigator.mediaDevices.getUserMedia({ video: true });
  }catch(err){
    resultBox.innerHTML =
      `<div class="invalid-box">Permission kamera ditolak</div>`;
    return;
  }

  try{
    cameras = await Html5Qrcode.getCameras();
  }catch(err){
    resultBox.innerHTML =
      `<div class="invalid-box">Gagal membaca kamera</div>`;
    return;
  }

  if (!cameras.length) {
    resultBox.innerHTML =
      `<div class="invalid-box">Camera tidak ditemukan</div>`;
    return;
  }

  // ===============================
  // PRIORITAS BACK CAMERA (IOS SAFE)
  // ===============================
  let backCamera = cameras.find(c =>
    c.label.toLowerCase().includes("back")
  );

  if (!backCamera) {
    backCamera = cameras.find(c =>
      c.label.toLowerCase().includes("environment")
    );
  }

  // fallback → ambil kamera terakhir (biasanya back)
  currentCameraId = backCamera
    ? backCamera.id
    : cameras[cameras.length - 1].id;

  await startCamera(currentCameraId);

  // ===============================
  // SWITCH CAMERA BUTTON
  // ===============================
  window.switchDailyCamera = async function(){

    if(!html5QrInstance) return;

    try{
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    }catch(e){}

    const index = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (index + 1) % cameras.length;
    currentCameraId = cameras[nextIndex].id;

    await startCamera(currentCameraId);
  };

  /* =========================================
     START CAMERA (IOS OPTIMIZED)
  ========================================= */
  async function startCamera(cameraId){

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const videoConstraints = isIOS
      ? {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        }
      : cameraId;

    const config = {
      fps: isIOS ? 20 : 30,
      qrbox: (vw, vh) => {
        const minEdge = Math.min(vw, vh);
        const size = Math.floor(minEdge * (isIOS ? 0.75 : 0.8));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
      disableFlip: true,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };

    try{
      await html5QrInstance.start(
        videoConstraints,
        config,
        async (decodedText) => {

          try { await html5QrInstance.stop(); } catch(e){}

          try {

            const cleaned = decodedText.trim().replace(/\n/g,"");

            let c = null;
            let i = null;
            let s = null;

            if(cleaned.startsWith("http")){
              const parsed = new URL(cleaned);
              c = parsed.searchParams.get("c");
              i = parsed.searchParams.get("i");
              s = parsed.searchParams.get("s");
            }else{
              const params = new URLSearchParams(cleaned);
              c = params.get("c");
              i = params.get("i");
              s = params.get("s");
            }

            if(!c || !i || !s){
              showInvalid(resultBox, "QR format tidak valid");
              return setTimeout(goBack,1500);
            }

            const validation = await window.processDailySelfCheckin(c,i,s);

            if (!validation.valid) {
              showInvalid(resultBox, validation.reason);
              return setTimeout(goBack,1500);
            }

            const reward = await runDailyStreakReward(validation.uid);

            showSuccess(resultBox, reward);

          } catch (err) {

            showInvalid(resultBox, err.message || "QR tidak valid");
          }

          setTimeout(goBack,1500);
        }
      );

      // 🔥 iOS exposure warmup
      if(isIOS){
        setTimeout(()=>{
          try{
            html5QrInstance.pause(false);
          }catch(e){}
        },400);
      }

    }catch(err){
      console.error("Camera start error:", err);
      resultBox.innerHTML =
        `<div class="invalid-box">
          Kamera gagal dibuka<br>
          ${err.message}
        </div>`;
    }
  }
}

/* =========================================
   DAILY STREAK TRANSACTION ENGINE
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
   UI HELPERS
========================================= */
function showSuccess(resultBox, reward){
  resultBox.innerHTML =
    `<div class="valid-box">
      ⭐ DAILY STREAK SUCCESS<br>
      +${reward} GPoint
    </div>`;
}

function showInvalid(resultBox, message){
  resultBox.innerHTML =
    `<div class="invalid-box">
      ❌ ${message}
    </div>`;
}

async function goBack(){

  try{
    if(html5QrInstance){
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    }
  }catch(e){}

  html5QrInstance = null;

  window.location.href = "index.html?dailySuccess=1";
}
