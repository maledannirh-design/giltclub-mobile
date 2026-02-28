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

  const cameras = await Html5Qrcode.getCameras();

  if (!cameras.length) {
    resultBox.innerHTML =
      `<div class="invalid-box">Camera tidak ditemukan</div>`;
    return;
  }

  const backCamera =
    cameras.find(c =>
      c.label.toLowerCase().includes("back") ||
      c.label.toLowerCase().includes("environment")
    ) || cameras[0];

  await html5QrInstance.start(
    backCamera.id,
    { fps: 10 },
    async (decodedText) => {

      try { await html5QrInstance.stop(); } catch(e){}

      try {

        const cleaned = decodedText.trim().replace(/\n/g,"");

        const parsed = new URL(cleaned);
        const c = parsed.searchParams.get("c");
        const i = parsed.searchParams.get("i");
        const s = parsed.searchParams.get("s");

        const validation = await window.processDailySelfCheckin(c,i,s);

        if (!validation.valid) {
          showInvalid(resultBox, validation.reason);
          return goBack();
        }

        const reward = await runDailyStreakReward(validation.uid);

        showSuccess(resultBox, reward);

      } catch (err) {

        showInvalid(resultBox, err.message || "QR tidak valid");
      }

      setTimeout(()=>goBack(),1500);
    }
  );
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
    ">
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
      const state = html5QrInstance.getState();
      if (state === 2) await html5QrInstance.stop();
      await html5QrInstance.clear();
    }
  }catch(e){}

  html5QrInstance = null;
  window.history.back();
}
