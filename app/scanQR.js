import { db } from "./firebase.js";
import { collection, query, where, getDocs, doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.validateScan = async function(){

  const params = new URLSearchParams(window.location.search);

  const memberCode = params.get("c");
  const issueFromQR = Number(params.get("i"));
  const signatureFromQR = params.get("s");

  if(!memberCode || !issueFromQR || !signatureFromQR){
    return { valid:false, reason:"Missing parameters" };
  }

  // 1️⃣ Find user by memberCode
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

  // 2️⃣ Get secure private data
  const secureRef = doc(db,"users",uid,"private","secure");
  const secureSnap = await getDoc(secureRef);

  if(!secureSnap.exists()){
    return { valid:false, reason:"Secure data missing" };
  }

  const { secretKey, issue } = secureSnap.data();

  // 3️⃣ Issue mismatch → old card
  if(issueFromQR !== issue){
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
    .map(b=>b.toString(16).padStart(2,"0"))
    .join("");

  if(rebuiltSignature !== signatureFromQR){
    return { valid:false, reason:"Signature invalid" };
  }

  return {
    valid:true,
    uid,
    memberCode,
    user:userDoc.data()
  };
};
