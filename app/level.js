import { getDocs, collection, updateDoc, doc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

async function fixAllUserStats(){

  try{

    const snap = await getDocs(collection(db,"users"));

    for(const docSnap of snap.docs){

      const data = docSnap.data();

      const totalTopup = data.totalTopup || 0;

      // 🔥 1. HITUNG EXP
      const exp = Math.floor(totalTopup / 500) * 10;

      // 🔥 2. HITUNG LEVEL
      const level = Math.floor(exp / 1000);

      // 🔥 3. UPDATE
      await updateDoc(doc(db,"users",docSnap.id),{
        exp: exp,
        level: level
      });

      console.log("FIXED:", docSnap.id, {
        totalTopup,
        exp,
        level
      });
    }

    console.log("🔥 SEMUA USER SUDAH DI FIX");

  }catch(err){
    console.error(err);
  }
}

// expose ke window
window.fixAllUserStats = fixAllUserStats;
