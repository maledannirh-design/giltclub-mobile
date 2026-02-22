async function migrateUsers(dataList){

  for(const item of dataList){

    const snap = await getDocs(
      query(collection(db,"users"), where("username","==", item.username))
    );

    if(snap.empty){
      console.log("User tidak ditemukan:", item.username);
      continue;
    }

    const userDoc = snap.docs[0];
    const uid = userDoc.id;

    // =============================
    // HITUNG RUMUS
    // =============================

    const expTotal = Math.floor(item.total_payment / 500);
    const level = Math.floor(expTotal / 100);
    const gPoint = Math.floor(item.total_top_up / 50000) * 250;

    // =============================
    // UPDATE USER
    // =============================

    await updateDoc(doc(db,"users",uid),{
      walletBalance: item.total_top_up,
      totalTopUp: item.total_top_up,
      totalPayment: item.total_payment,
      totalSessions: item.total_sesi,
      level: level,
      exp: expTotal,
      gPoint: gPoint
    });

    // =============================
    // INSERT MIGRATION LEDGER
    // =============================

    await setDoc(
      doc(db,"walletTransactions", `${uid}_MIGRATION`),
      {
        uid: uid,
        type: "PEMBUKAAN REKENING SALDO BARU",
        amount: item.total_top_up,
        status: "APPROVED",
        balanceAfter: item.total_top_up,
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        note: "Migrasi sistem lama"
      }
    );

  }

  console.log("Migrasi selesai.");
}
