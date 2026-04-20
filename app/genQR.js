window.genQR = async () => {
  const { collection, getDocs, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js");

  const snap = await getDocs(collection(window.db, "users"));

  let skip = 0, update = 0;

  for (const d of snap.docs) {
    const data = d.data();

    // 🔒 HARD PROTECTION (tidak akan ditimpa)
    if (data.qrUrl && data.qrUrl !== "") {
      skip++;
      continue;
    }

    // wajib ada memberCode
    if (!data.memberCode) continue;

    const raw = d.id + data.memberCode;
    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const sig = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const qrUrl = `https://giltclub.app/scan?c=${data.memberCode}&i=1&s=${sig}`;

    await updateDoc(doc(window.db, "users", d.id), { qrUrl });

    update++;
    console.log("CREATED:", data.memberCode);
  }

  console.log(`DONE ✅ created: ${update}, skipped: ${skip}`);
};
