import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

window.genQR = async (uid = null) => {

  let docs = [];

  // =========================
  // MODE 1: SINGLE USER
  // =========================
  if (uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.error("❌ USER NOT FOUND");
      return;
    }

    docs = [snap];
  }

  // =========================
  // MODE 2: ALL USERS
  // =========================
  else {
    const snap = await getDocs(collection(db, "users"));
    docs = snap.docs;
  }

  let created = 0;
  let skipped = 0;

  for (const d of docs) {
    const data = d.data();

    // 🔒 PROTECTION 1 (CLIENT SIDE)
    if (data.qrUrl && data.qrUrl !== "") {
      skipped++;
      console.log("SKIP (EXIST):", data.memberCode);
      continue;
    }

    if (!data.memberCode) {
      console.log("SKIP (NO CODE):", d.id);
      continue;
    }

    // =========================
    // GENERATE QR
    // =========================
    const raw = d.id + data.memberCode;

    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);

    const sig = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const qrUrl = `https://giltclub.app/scan?c=${data.memberCode}&i=1&s=${sig}`;

    // =========================
    // 🔒 PROTECTION 2 (SERVER SIDE)
    // =========================
    try {
      await updateDoc(
        doc(db, "users", d.id),
        { qrUrl },
        { exists: false } // ❗ ANTI TINDIH HARD
      );

      created++;
      console.log("CREATED:", data.memberCode);

    } catch (e) {
      // kalau sudah ada di server → tidak akan ditimpa
      skipped++;
      console.log("SKIP (SERVER BLOCK):", data.memberCode);
    }
  }

  console.log(`DONE ✅ created: ${created}, skipped: ${skipped}`);
};
