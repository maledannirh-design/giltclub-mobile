import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  doc,
  getDoc,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkInAttendance } from "./services/attendanceService.js";
import "./scanQR.js";

let html5QrInstance = null;

/* =========================================
   INIT CHECK-IN SCANNER (DROPDOWN VERSION)
========================================= */
export async function initCheckinScanner({
  readerId,
  resultId,
  scheduleId,
  memberSelectId,
  startBtnId
}) {

  const readerEl = document.getElementById(readerId);
  const resultBox = document.getElementById(resultId);
  const memberSelect = document.getElementById(memberSelectId);
  const startBtn = document.getElementById(startBtnId);

  if (!readerEl || !resultBox || !memberSelect || !startBtn) return;

  if (!scheduleId) {
    resultBox.innerHTML =
      `<div class="invalid-box">Schedule tidak ditemukan</div>`;
    return;
  }

  let bookingMap = {};

  /* =========================================
     LOAD BOOKING ACTIVE
  ========================================= */
  try {

    const bookingSnap = await getDocs(
      query(
        collection(db,"bookings"),
        where("scheduleId","==",scheduleId),
        where("status","==","active")
      )
    );

    if (bookingSnap.empty) {
      resultBox.innerHTML =
        `<div class="invalid-box">Belum ada peserta</div>`;
      return;
    }

    memberSelect.innerHTML =
      `<option value="">-- Pilih Member --</option>`;

    const loadPromises = bookingSnap.docs.map(async (docSnap) => {

      const data = docSnap.data();
      const userId = data.userId;

      bookingMap[userId] = docSnap.id;

      let displayText = "Member";

      try {
        const userSnap = await getDoc(doc(db,"users",userId));

        if (userSnap.exists()) {

          const userData = userSnap.data();

          const username =
            userData.usernameID ||
            userData.username ||
            "";

          const fullName =
            userData.fullName ||
            "";

          if (username && fullName) {
            displayText = `${username} - ${fullName}`;
          } else if (username) {
            displayText = username;
          } else if (fullName) {
            displayText = fullName;
          }
        }

      } catch(e){}

      const opt = document.createElement("option");
      opt.value = userId;
      opt.textContent = displayText;

      memberSelect.appendChild(opt);
    });

    await Promise.all(loadPromises);

  } catch(err){

    resultBox.innerHTML =
      `<div class="invalid-box">Gagal load peserta</div>`;
    return;
  }

  /* =========================================
     START BUTTON CLICK
  ========================================= */
  startBtn.onclick = async ()=>{

    const selectedUid = memberSelect.value;

    if(!selectedUid){
      resultBox.innerHTML =
        `<div class="invalid-box">Pilih member dulu</div>`;
      return;
    }

    if(!bookingMap[selectedUid]){
      resultBox.innerHTML =
        `<div class="invalid-box">Booking tidak ditemukan</div>`;
      return;
    }

    document.getElementById("checkinControlPanel").style.display = "none";
    readerEl.style.display = "block";

    await startCamera(
      resultBox,
      selectedUid,
      bookingMap[selectedUid]
    );
  };
}


/* =========================================
   START CAMERA (UNIVERSAL SAFE)
========================================= */
async function startCamera(resultBox, selectedUid, bookingId) {

  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    resultBox.innerHTML =
      `<div class="invalid-box">Permission kamera ditolak</div>`;
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

  async function onScanSuccess(decodedText){

    try {
      await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch(e){}

    html5QrInstance = null;

    const cleaned = decodedText.trim();

    if (!cleaned.includes("giltclub.my.id")) {
      showInvalid(resultBox, "QR tidak valid");
      return setTimeout(goBack,1500);
    }

    try {

      const res = await checkInAttendance({
        bookingId,
        scannedUid: selectedUid
      });

      showSuccess(resultBox, res);

    } catch (err) {

      showInvalid(resultBox, err.message || "Check-in gagal");
    }

    setTimeout(goBack,1500);
  }

  try {

    await html5QrInstance.start(
      { facingMode: "environment" },
      config,
      onScanSuccess
    );

  } catch {

    try {

      await html5QrInstance.start(
        { video: true },
        config,
        onScanSuccess
      );

    } catch {

      resultBox.innerHTML =
        `<div class="invalid-box">Kamera gagal dibuka</div>`;
    }
  }
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
  }catch(e){}

  html5QrInstance = null;
  window.history.back();
}
