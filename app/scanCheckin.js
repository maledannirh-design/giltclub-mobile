import { auth } from "./firebase.js";
import "./scanQR.js";

let html5QrInstance = null;
let cameraList = [];
let currentCameraIndex = 0;

/* =========================================
   INIT CHECK-IN SCANNER
========================================= */
export async function initCheckinScanner({
  readerId,
  resultId,
  scheduleId
}) {

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);

  if (!readerEl || !resultBox) return;

  if (!scheduleId) {
    resultBox.innerHTML =
      `<div class="invalid-box">Schedule tidak ditemukan</div>`;
    return;
  }

  html5QrInstance = new Html5Qrcode(readerId);

  cameraList = await Html5Qrcode.getCameras();

  if (!cameraList.length) {
    resultBox.innerHTML =
      `<div class="invalid-box">Camera tidak ditemukan</div>`;
    return;
  }

  const backIndex = cameraList.findIndex(device =>
    device.label.toLowerCase().includes("back") ||
    device.label.toLowerCase().includes("environment")
  );

  currentCameraIndex =
    backIndex >= 0 ? backIndex : cameraList.length - 1;

  await startCamera(scheduleId, resultBox);
}

/* =========================================
   START CAMERA
========================================= */
async function startCamera(scheduleId, resultBox) {

  const cameraId = cameraList[currentCameraIndex].id;

  await html5QrInstance.start(
    cameraId,
    {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrSize = Math.floor(minEdge * 0.7);
        return { width: qrSize, height: qrSize };
      }
    },
    async (decodedText) => {

      try {
        await html5QrInstance.stop();
      } catch (e) {}

      try {

        const cleaned = decodedText.trim().replace(/\n/g,"");

        let c = null;
        let i = null;
        let s = null;

        if (cleaned.startsWith("http")) {
          const parsed = new URL(cleaned);
          c = parsed.searchParams.get("c");
          i = parsed.searchParams.get("i");
          s = parsed.searchParams.get("s");
        } else {
          const params = new URLSearchParams(cleaned);
          c = params.get("c");
          i = params.get("i");
          s = params.get("s");
        }

        if (!c || !i || !s) {
          showInvalid(resultBox, "QR format tidak valid");
          return goBack();
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
          showInvalid(resultBox, "Host tidak login");
          return goBack();
        }

        const res = await window.processCheckIn(
          c,
          i,
          s,
          scheduleId,
          {
            uid: currentUser.uid,
            role: window.currentUserData?.role
          }
        );

        if (res.valid) {
          showSuccess(resultBox, res);
        } else {
          showInvalid(resultBox, res.reason);
        }

      } catch (err) {
        console.error("Checkin scan error:", err);
        showInvalid(resultBox, "QR tidak valid");
      }

      setTimeout(() => {
        goBack();
      }, 1500);

    }
  );
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
    <div style="
      background:#1f2d1f;
      border:2px solid #2ecc71;
      padding:18px;
      border-radius:14px;
      text-align:center;
    ">
      <div style="font-size:18px;margin-bottom:8px;">
        ✅ CHECK-IN BERHASIL
      </div>

      <div style="
        display:inline-block;
        padding:4px 10px;
        border-radius:20px;
        font-size:12px;
        font-weight:bold;
        background:${roleColor};
        color:#000;
        margin-bottom:12px;
      ">
        ${role}
      </div>

      <div>${cashbackText}</div>
      <div>${gpointText}</div>

      <div style="font-size:12px;opacity:0.6;margin-top:8px;">
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
      if (state === 2) {
        await html5QrInstance.stop();
      }
      await html5QrInstance.clear();
    }
  }catch(e){
    console.warn("Scanner stop error:", e);
  }

  html5QrInstance = null;

  window.history.back();
}

/* =========================================
   STOP SCANNER MANUAL
========================================= */
export async function stopCheckinScanner() {

  if (!html5QrInstance) return;

  try {

    const state = html5QrInstance.getState();

    if (state === 2) {
      await html5QrInstance.stop();
    }

    await html5QrInstance.clear();

  } catch (e) {
    console.warn("Scanner stop error:", e);
  }

  html5QrInstance = null;
}
