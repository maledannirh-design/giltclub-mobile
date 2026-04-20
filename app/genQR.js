import {
  db,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "./firebase.js";

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

    // 🔒 ANTI TINDIH (WAJIB)
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
    // ISSUE VERSION (IMPORTANT)
    // =========================
    const issue = data.qrIssue || 1;

    // =========================
    // GENERATE SIGNATURE
    // =========================
    const raw = d.id + data.memberCode + issue;

    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);

    const sig = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // =========================
    // BUILD QR URL
    // =========================
    const qrUrl = `https://giltclub.app/scan?c=${data.memberCode}&i=${issue}&s=${sig}`;

    try {
      await updateDoc(doc(db, "users", d.id), { qrUrl });

      created++;
      console.log("CREATED:", data.memberCode);

    } catch (e) {
      skipped++;
      console.log("SKIP (ERROR):", data.memberCode);
    }
  }

  console.log(`DONE ✅ created: ${created}, skipped: ${skipped}`);
};
