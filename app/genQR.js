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

  if (uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.error("USER NOT FOUND");
      return;
    }

    docs = [snap];
  } else {
    const snap = await getDocs(collection(db, "users"));
    docs = snap.docs;
  }

  let created = 0;
  let skipped = 0;

  for (const d of docs) {
    const data = d.data();

    // 🔒 ANTI TIMPA
    if (data.qrUrl && data.qrUrl !== "") {
      skipped++;
      continue;
    }

    if (!data.memberCode) continue;

    const raw = d.id + data.memberCode;

    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);

    const sig = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const qrUrl = `https://giltclub.app/scan?c=${data.memberCode}&i=1&s=${sig}`;

    try {
      await updateDoc(doc(db, "users", d.id), { qrUrl });
      created++;
      console.log("CREATED:", data.memberCode);
    } catch (e) {
      skipped++;
      console.log("SKIP:", data.memberCode);
    }
  }

  console.log(`DONE ✅ created: ${created}, skipped: ${skipped}`);
};
