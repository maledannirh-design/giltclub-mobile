import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.genQR = async (uid = null) => {

  let docs = [];

  // SINGLE USER
  if (uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.error("USER NOT FOUND");
      return;
    }

    docs = [snap];
  }

  // ALL USERS
  else {
    const snap = await getDocs(collection(db, "users"));
    docs = snap.docs;
  }

  let created = 0;
  let skipped = 0;

  for (const d of docs) {
    const data = d.data();

    // 🔒 ANTI TINDIH
    if (data.qrUrl) {
      skipped++;
      console.log("SKIP:", data.memberCode);
      continue;
    }

    if (!data.memberCode) continue;

    const issue = data.qrIssue || 1;

    const raw = d.id + data.memberCode + issue;

    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);

    const sig = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const qrUrl = `https://giltclub.app/scan?c=${data.memberCode}&i=${issue}&s=${sig}`;

    await updateDoc(doc(db, "users", d.id), { qrUrl });

    created++;
    console.log("CREATED:", data.memberCode);
  }

  console.log(`DONE ✅ created: ${created}, skipped: ${skipped}`);
};
