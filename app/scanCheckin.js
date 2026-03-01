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

  try {
    // 🔥 Force permission first (iOS safe)
    await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    resultBox.innerHTML =
      `<div class="invalid-box">Permission kamera ditolak</div>`;
    return;
  }

  html5QrInstance = new Html5Qrcode(readerId);

  try {
    cameraList = await Html5Qrcode.getCameras();
  } catch (err) {
    resultBox.innerHTML =
      `<div class="invalid-box">Gagal membaca kamera</div>`;
    return;
  }

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
   START CAMERA (IPHONE OPTIMAL)
========================================= */
async function startCamera(scheduleId, resultBox) {

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

        try {
          await html5QrInstance.stop();
        } catch (e) {}

        try {

          const cleaned = decodedText.trim().replace(/\n/g,"");

          let c, i, s;

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
            return setTimeout(goBack, 1500);
          }

          const currentUser = auth.currentUser;

          if (!currentUser) {
            showInvalid(resultBox, "Host tidak login");
            return setTimeout(goBack, 1500);
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

        setTimeout(goBack, 1500);
      }
    );

    // 🔥 iOS exposure warmup
    if (isIOS) {
      setTimeout(() => {
        try {
          html5QrInstance.pause(false);
        } catch (e) {}
      }, 400);
    }

  } catch (err) {
    console.error("Camera start error:", err);
    resultBox.innerHTML =
      `<div class="invalid-box">
        Kamera gagal dibuka<br>
        ${err.message}
      </div>`;
  }
}

/* =========================================
   UI SUCCESS (CENTER FRIENDLY)
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
    await html5QrInstance.stop();
    await html5QrInstance.clear();
  } catch (e) {
    console.warn("Scanner stop error:", e);
  }

  html5QrInstance = null;
}
