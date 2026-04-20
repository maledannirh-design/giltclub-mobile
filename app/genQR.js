window.genQR = async () => {

  // ambil module yang sama seperti firebase.js pakai
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const { collection, getDocs, doc, updateDoc } = fs;

  const db = window.db || (await import("./firebase.js")).db;

  if (!db) {
    console.error("DB NOT FOUND");
    return;
  }

  const snap = await getDocs(collection(db, "users"));

  let created = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const data = d.data();

    // 🔒 ANTI TIMPA
    if (data.qrUrl) {
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

    await updateDoc(doc(db, "users", d.id), { qrUrl });

    created++;
    console.log("CREATED:", data.memberCode);
  }

  console.log(`DONE ✅ created: ${created}, skipped: ${skipped}`);
};
