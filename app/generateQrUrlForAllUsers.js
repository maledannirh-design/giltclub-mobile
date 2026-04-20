async function generateQrUrlForAllUsers(){

  const db = firebase.firestore();
  const snapshot = await db.collection("users").get();

  let updated = 0;
  let skipped = 0;
  let noCode = 0;

  for(const docSnap of snapshot.docs){

    const data = docSnap.data();

    // ❗ skip kalau sudah ada qrUrl
    if(data.qrUrl){
      skipped++;
      continue;
    }

    // ❗ wajib ada memberCode
    if(!data.memberCode){
      noCode++;
      console.warn(`NO MEMBER CODE: ${docSnap.id}`);
      continue;
    }

    const memberCode = data.memberCode;

    // === SIGNATURE (HASH) ===
    const raw = docSnap.id + memberCode;

    const encoder = new TextEncoder();
    const buffer = encoder.encode(raw);

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2,'0')).join('');

    // === QR URL ===
    const qrUrl = `https://giltclub.app/scan?c=${memberCode}&i=1&s=${signature}`;

    // === UPDATE ===
    await db.collection("users").doc(docSnap.id).update({
      qrUrl
    });

    updated++;
    console.log(`UPDATED: ${memberCode}`);
  }

  console.log(`DONE ✅ Updated: ${updated}, Skipped: ${skipped}, NoCode: ${noCode}`);
}
