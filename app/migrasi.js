import { recalculateUserStats } from "./userStats.js";

async function migrateUsers(dataList){

  for(const item of dataList){

    const snap = await getDocs(
      query(collection(db,"users"), where("username","==", item.username))
    );

    if(snap.empty) continue;

    const userDoc = snap.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    const totalPayment = item.totalTopup - item.walletBalance;

    const stats = recalculateUserStats({
      totalTopup: item.totalTopup,
      totalPayment: totalPayment,
      membership: userData.membership
    });

    await updateDoc(doc(db,"users",uid),{
      walletBalance: item.walletBalance,
      totalTopup: item.totalTopup,
      totalPayment: totalPayment,
      totalSession: item.totalSession,

      level: stats.level,
      exp: stats.expTotal,
      gPoint: stats.gPoint
    });

  }

  console.log("Migrasi selesai");
}
