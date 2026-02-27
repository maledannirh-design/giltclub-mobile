import { auth } from "./firebase.js";
import "./scanQR.js"; // supaya processCheckIn tersedia di window

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
    { fps: 10, qrbox: { width: 250, height: 250 } },
    async (decodedText) => {

      await html5QrInstance.stop();

      try {

        let cleaned = decodedText.trim().replace(/\n/g,"");

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
          resultBox.innerHTML =
            `<div class="invalid-box">QR format tidak valid</div>`;
          return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
          resultBox.innerHTML =
            `<div class="invalid-box">Host tidak login</div>`;
          return;
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
          resultBox.innerHTML = `
            <div class="valid-box">
              ✅ CHECK-IN BERHASIL
            </div>
          `;
        } else {
          resultBox.innerHTML = `
            <div class="invalid-box">
              ❌ ${res.reason}
            </div>
          `;
        }

      } catch (err) {

        console.error("Checkin scan error:", err);

        resultBox.innerHTML =
          `<div class="invalid-box">QR tidak valid</div>`;
      }

    }
  );
}

/* =========================================
   STOP SCANNER
========================================= */
export async function stopCheckinScanner() {
  if (html5QrInstance) {
    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch (e) {}
  }
}
