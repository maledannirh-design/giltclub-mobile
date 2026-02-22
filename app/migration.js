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
   username: "jodai",
   totalTopup: 715000,
   walletBalance: 115000
 },
 {
   username: "sintanophe",
   totalTopup: 1000000,
   walletBalance: 53500
 },
 {
   username: "nrlhasanah21",
   totalTopup: 1000000,
   walletBalance: 50000
 },
 {
   username: "kiki",
   totalTopup: 1550000,
   walletBalance: 585250
 },
 {
   username: "jasmine",
   totalTopup: 1850000,
   walletBalance: 103500
 },
 {
   username: "nida",
   totalTopup: 850000,
   walletBalance: 175000
 },
 {
   username: "sawung",
   totalTopup: 250000,
   walletBalance: 125000
 },
 {
   username: "arin",
   totalTopup: 850000,
   walletBalance: 45000
 },
 {
   username: "iiszakaria",
   totalTopup: 450000,
   walletBalance: 35000
 },
 {
   username: "dinda",
   "totalTopup": 780000,
   "walletBalance": 135000
 },
 {
   username: "sasaa",
   "totalTopup": 1050000,
   "walletBalance": 35000
 },
 {
   username: "carol",
   totalTopup: 400000,
   walletBalance: 135000
 },
 {
   username: "endah",
   totalTopup: 600000,
   walletBalance: 150000
 },
 {
   username: "rarak",
   totalTopup: 700000,
   walletBalance: 290000
 },
 {
   username: "rieke.dpz",
   totalTopup: 300000,
   walletBalance: 175000
 },
 {
   username: "nafinida27",
   totalTopup: 200000,
   walletBalance: 75000
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
