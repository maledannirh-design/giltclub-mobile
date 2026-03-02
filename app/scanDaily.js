import { auth } from "./firebase.js";
import { doc, runTransaction, collection } from "./firestore.js";
import { db } from "./firebase.js";
import "./scanQR.js";

let html5QrInstance = null;

/* =========================================
   INIT DAILY SCANNER (MOBILE SAFE VERSION)
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // HARD PERMISSION REQUEST
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    stream.getTracks().forEach(track => track.stop());
  }catch(err){

    const msg =
      err?.message ||
      err?.name ||
      "Permission kamera ditolak";

    resultBox.innerHTML =
      `<div class="invalid-box">${msg}</div>`;
    return;
  }

  html5QrInstance = new Html5Qrcode(readerId);

  let cameras = [];

  try{
    cameras = await Html5Qrcode.getCameras();
  }catch(err){

    resultBox.innerHTML =
      `<div class="invalid-box">
        Tidak bisa membaca kamera
      </div>`;
    return;
  }

  if (!cameras.length) {
    resultBox.innerHTML =
      `<div class="invalid-box">
        Camera tidak ditemukan
      </div>`;
    return;
  }

  // Cari kamera belakang
  let backCam = cameras.find(c =>
    c.label.toLowerCase().includes("back")
  );

  if (!backCam) {
    backCam = cameras.find(c =>
      c.label.toLowerCase().includes("environment")
    );
  }

  const cameraId = backCam
    ? backCam.id
    : cameras[cameras.length - 1].id;

  await startCamera(cameraId);

  /* ========================================= */
  async function startCamera(camId){

    if (html5QrInstance) {
  try {
    await html5QrInstance.stop();
  } catch(e){}

  try {
    await html5QrInstance.clear();
  } catch(e){}
}

      await html5QrInstance.start(
        camId,
        {
          fps: 20,
          qrbox: (vw, vh) => {
            const size = Math.floor(Math.min(vw, vh) * 0.75);
            return { width: size, height: size };
          },
          aspectRatio: 1.0
        },
        async (decodedText) => {

          try{
            await html5QrInstance.stop();
          }catch(e){}

          try{

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

          }catch(err){

            showInvalid(
              resultBox,
              err?.message || "Gagal check-in"
            );
          }

          setTimeout(goBack,1500);
        }
      );

    }catch(err){

      console.error("Camera start error:", err);

      const msg =
        err?.message ||
        err?.name ||
        "Kamera gagal dibuka";

      resultBox.innerHTML =
        `<div class="invalid-box">${msg}</div>`;
    }
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
   UI
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
