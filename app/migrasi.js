import { db } from "./firebase.js";
import { 
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { recalculateUserStats } from "./userStats.js";

const migrationData = [
 {
   username: "usewin ameera",
   totalTopup: 1650000,
   walletBalance: 20250
 },
  {
   "username": "wawa",
   "totalTopup": 1200000,
   "walletBalance": 410000
 },
 {
   username: "Coach Jack Dimitry",
   totalTopup: 2345000,
   walletBalance: 2120250
 }

];

export async function runMigration(){

  for(const item of migrationData){

    const snap = await getDocs(
      query(collection(db,"users"), where("username","==", item.username))
    );

    if(snap.empty){
      console.log("User tidak ditemukan:", item.username);
      continue;
    }

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
      level: stats.level,
      exp: stats.expTotal,
      gPoint: stats.gPoint
    });

    console.log("Migrated:", item.username);
  }

  console.log("MIGRATION DONE");
}

window.runMigration = runMigration;
