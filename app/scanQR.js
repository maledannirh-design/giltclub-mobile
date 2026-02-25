import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================
   CORE VALIDATION ENGINE
===================================================== */
async function validateCore(memberCode, issueFromQR, signatureFromQR){

  if(!memberCode || !issueFromQR || !signatureFromQR){
    return { valid:false, reason:"Missing parameters" };
  }

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
  const issue = secureData.issue;

  // 3️⃣ Cek issue (anti kartu lama)
  if(Number(issueFromQR) !== issue){
    return { valid:false, reason:"Card expired (issue mismatch)" };
  }

  // 4️⃣ Rebuild signature
  const raw = memberCode + issue + secretKey;

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
    valid:true,
    uid: uid,
    user: userData,
    memberCode: memberCode
  };
}

/* =====================================================
   Untuk scan.html (mode URL)
===================================================== */
window.validateScan = async function(){

  const params = new URLSearchParams(window.location.search);

  const memberCode = params.get("c");
  const issue = params.get("i");
  const signature = params.get("s");

  return await validateCore(memberCode, issue, signature);
};

/* =====================================================
   Untuk Camera Mode (Admin Check-In)
===================================================== */
window.validateScanParams = async function(memberCode, issue, signature){

  return await validateCore(memberCode, issue, signature);
};
