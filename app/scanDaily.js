import { auth, db } from "./firebase.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let html5QrInstance = null;

/* =========================================
   INIT DAILY SCANNER (CARD STYLE)
========================================= */
export async function initDailyScanner(readerId, resultId){

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  // 🔹 Buat UI Card
  readerEl.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:#000;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:20px;
    ">
      <div style="
        width:100%;
        max-width:420px;
        background:#111;
        border-radius:20px;
        padding:20px;
        text-align:center;
        box-shadow:0 0 30px rgba(255,215,0,.3);
      ">
        <h2 style="margin-bottom:20px;">Scan Kartu Anda</h2>

        <div id="qrReader" style="
          width:100%;
          aspect-ratio:1/1;
          border:3px solid #FFD700;
          border-radius:16px;
          margin-bottom:20px;
        "></div>

        <button id="startDailyScan" style="
          width:100%;
          padding:14px;
          border:none;
          border-radius:12px;
          background:#FFD700;
          font-weight:bold;
          font-size:16px;
        ">
          Mulai Scan
        </button>

        <button id="closeScan" style="
          width:100%;
          padding:12px;
          border:none;
          border-radius:12px;
          background:#333;
          color:#fff;
          margin-top:10px;
        ">
          Kembali
        </button>
      </div>
    </div>
  `;

  document.getElementById("closeScan").onclick = () => {
    window.history.back();
  };

  document.getElementById("startDailyScan").onclick = async () => {

    try{

      // Request permission dulu
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      stream.getTracks().forEach(t => t.stop());

    }catch(err){
      resultBox.innerHTML = `<div class="invalid-box">Permission kamera ditolak</div>`;
      return;
    }

    html5QrInstance = new Html5Qrcode("qrReader");

    let cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) {
      resultBox.innerHTML = `<div class="invalid-box">Camera tidak ditemukan</div>`;
      return;
    }

    const cameraId = cameras[cameras.length - 1].id;

    await html5QrInstance.start(
      cameraId,
      {
        fps: 20,
        qrbox: (vw, vh) => {
  const size = Math.min(vw, vh) * 0.7;
  return { width: size, height: size };
},
aspectRatio: 1.0
      },
      async (decodedText) => {

        try{
          await html5QrInstance.stop();
          await html5QrInstance.clear();
        }catch(e){}

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

        try{
          const reward = await runDailyStreakReward(currentUser.uid);
          showSuccess(resultBox, reward);
        }catch(err){
          showInvalid(resultBox, err.message || "Gagal check-in");
        }
      }
    );
  };
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
