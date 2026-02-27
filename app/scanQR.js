import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkInAttendance } from "./services/attendanceService.js";

/* =====================================================
   CORE VALIDATION ENGINE
===================================================== */
async function validateCore(memberCode, issueFromQR, signatureFromQR){

  if(!memberCode || !issueFromQR || !signatureFromQR){
    return { valid:false, reason:"Missing parameters" };
  }

  try {

    // 1️⃣ Cari user berdasarkan memberCode
    const q = query(
      collection(db,"users"),
      where("memberCode","==",memberCode)
    );

    const snap = await getDocs(q);

    if(snap.empty){
      return { valid:false, reason:"User not found" };
    }

    const userDoc = snap.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    // 2️⃣ Ambil secure data
    const secureRef = doc(db,"users",uid,"private","secure");
    const secureSnap = await getDoc(secureRef);

    if(!secureSnap.exists()){
      return { valid:false, reason:"Secure data missing" };
    }

    const secureData = secureSnap.data();
    const secretKey = secureData.secretKey;
    const issueStored = Number(secureData.issue);
    const issueQR = Number(issueFromQR);

    // 3️⃣ Validasi issue
    if(issueQR !== issueStored){
      return { valid:false, reason:"Card expired (issue mismatch)" };
    }

    // 4️⃣ Rebuild signature
    const raw = memberCode + issueStored + secretKey;

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const rebuiltSignature = hashArray
      .map(b => b.toString(16).padStart(2,"0"))
      .join("");

    if(rebuiltSignature !== signatureFromQR){
      return { valid:false, reason:"Signature invalid" };
    }

    return {
      valid: true,
      uid: uid,
      user: userData,
      memberCode: memberCode
    };

  } catch(error) {

    console.error("Validation error:", error);
    return { valid:false, reason:"Internal validation error" };
  }
}

/* =====================================================
   scan.html mode (URL mode)
===================================================== */
window.validateScan = async function(){

  const params = new URLSearchParams(window.location.search);

  const memberCode = params.get("c");
  const issue = params.get("i");
  const signature = params.get("s");

  return await validateCore(memberCode, issue, signature);
};

/* =====================================================
   Camera Mode (Admin Check-In)
===================================================== */
window.validateScanParams = async function(memberCode, issue, signature){

  return await validateCore(memberCode, issue, signature);
};

/* =====================================================
   HOST CHECK-IN MODE
===================================================== */
window.processCheckIn = async function(
  memberCode,
  issue,
  signature,
  scheduleId,
  currentUser
){

  const validation = await validateCore(memberCode, issue, signature);

  if (!validation.valid) {
    return validation;
  }

  const uid = validation.uid;

  try {

    if (!scheduleId) {
      return { valid:false, reason:"Schedule tidak ditemukan" };
    }

    if (!currentUser || !currentUser.uid) {
      return { valid:false, reason:"Host tidak login" };
    }

    // ===============================
    // AMBIL DATA SCHEDULE
    // ===============================

    const scheduleRef = doc(db, "schedules", scheduleId);
    const scheduleSnap = await getDoc(scheduleRef);

    if (!scheduleSnap.exists()) {
      return { valid:false, reason:"Schedule tidak ditemukan" };
    }

    const scheduleData = scheduleSnap.data();

    // ===============================
    // ROLE VALIDATION
    // ===============================

    const userRole = (currentUser.role || "").toUpperCase();

    const isAdmin =
      userRole === "ADMIN" ||
      userRole === "SUPERCOACH";

    const isHost =
      scheduleData.hostId === currentUser.uid;

    if (!isAdmin && !isHost) {
      return { valid:false, reason:"Tidak memiliki akses check-in" };
    }

    // ===============================
    // CARI BOOKING AKTIF
    // ===============================

    const q = query(
      collection(db,"bookings"),
      where("userId","==",uid),
      where("scheduleId","==",scheduleId),
      where("status","==","active")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid:false, reason:"Booking tidak ditemukan untuk sesi ini" };
    }

    const bookingId = snap.docs[0].id;

    // ===============================
    // PANGGIL ENGINE ATTENDANCE
    // ===============================

    const attendanceResult = await checkInAttendance({
      bookingId,
      scannedUid: uid
    });

    return {
      valid: true,
      ...attendanceResult
    };

  } catch (error) {

    return {
      valid: false,
      reason: error.message || "Check-in gagal"
    };
  }

};
