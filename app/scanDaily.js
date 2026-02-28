import { auth } from "./firebase.js";
import { doc, runTransaction } from "./firestore.js";
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

  const cameras = await Html5Qrcode.getCameras();
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

  currentCameraId = backCamera ? backCamera.id : cameras[0].id;

  await startCamera(currentCameraId);

  // ===============================
  // SWITCH CAMERA BUTTON
  // ===============================
  window.switchDailyCamera = async function(){

    if(!html5QrInstance) return;

    try{
      await html5QrInstance.stop();
    }catch(e){}

    const index = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (index + 1) % cameras.length;
    currentCameraId = cameras[nextIndex].id;

    await startCamera(currentCameraId);
  };

  async function startCamera(cameraId){

    await html5QrInstance.start(
      cameraId,
      {
        fps: 45,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.8);
          return { width: size, height: size };
        },
        aspectRatio: 1.0
      },
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
  }
}

/* =========================================
   DAILY STREAK TRANSACTION ENGINE
========================================= */
async function runDailyStreakReward(uid){

  const userRef = doc(db,"users",uid);

  return await runTransaction(db, async (transaction)=>{

    const snap = await transaction.get(userRef);
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

    // 🔹 1️⃣ Update total
    transaction.update(userRef,{
      currentStreak: streak,
      lastCheckinDate: today,
      gPoint: (data.gPoint || 0) + reward,
      gPointLastUpdated: new Date()
    });

    // 🔹 2️⃣ Create ledger entry
    const ledgerRef = doc(
      collection(userRef,"gpointLedger")
    );

    transaction.set(ledgerRef,{
      type: "daily_checkin",
      amount: reward,
      streakDay: streak,
      createdAt: new Date()
    });

    return reward;
  });
}

/* =========================================
   UI SUCCESS
========================================= */
function showSuccess(resultBox, reward){

  resultBox.innerHTML = `
    <div style="
      background:#1f2d1f;
      border:2px solid gold;
      padding:18px;
      border-radius:14px;
      text-align:center;
      color:white;
    ">
      <div style="font-size:18px;margin-bottom:8px;">
        ⭐ DAILY STREAK SUCCESS
      </div>
      <div>+${reward} GPoint</div>
    </div>
  `;
}

/* =========================================
   UI INVALID
========================================= */
function showInvalid(resultBox, message){

  resultBox.innerHTML = `
    <div style="
      background:#3a1c1c;
      border:2px solid #e74c3c;
      padding:18px;
      border-radius:14px;
      text-align:center;
      color:white;
    ">
      ❌ ${message}
    </div>
  `;
}

/* =========================================
   GO BACK (SAFE REDIRECT)
========================================= */
async function goBack(){

  try{
    if (html5QrInstance) {
      const state = html5QrInstance.getState();
      if (state === 2) {
        await html5QrInstance.stop();
      }
      await html5QrInstance.clear();
    }
  }catch(e){
    console.warn("Scanner stop error:", e);
  }

  html5QrInstance = null;

  window.location.href = "index.html?dailySuccess=1";
}
