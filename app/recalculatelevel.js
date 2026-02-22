import { getDocs, collection, updateDoc, doc } from "./firestore.js";
import { db } from "./firebase.js";
import { recalculateUserStats } from "./userStats.js";

async function recalculateAllUsersOnce(){

  const usersSnap = await getDocs(collection(db, "users"));

  for (const docSnap of usersSnap.docs){

    const data = docSnap.data();

    const stats = recalculateUserStats({
      totalTopup: data.totalTopup || 0,
      totalPayment: data.totalPayment || 0,
      membership: data.membership || "MEMBER"
    });

    await updateDoc(doc(db, "users", docSnap.id), {
      level: stats.level,
      exp: stats.expTotal,
      gPoint: stats.gPoint
    });

    console.log("Updated:", docSnap.id, stats);
  }

  console.log("SELESAI SEMUA USER");
}

// JALANKAN SEKALI
recalculateAllUsersOnce();
