import { 
  addDoc,
  serverTimestamp,
  collection
} from "./firestore.js";

import { db } from "./firebase.js";

/* =====================================================
   🚀 ADMIN BROADCAST (1 WRITE ONLY - PRO SYSTEM)
===================================================== */
export async function sendAdminBroadcast(message, targetUids = null){

  if(!message){
    throw new Error("Message kosong");
  }

  // 🔥 Tentukan tipe target
  let targetType = "ALL";

  if(Array.isArray(targetUids) && targetUids.length > 0){
    targetType = "CUSTOM";
  }

  // 🔥 SINGLE WRITE (INI KUNCI SCALABLE)
  await addDoc(
    collection(db,"broadcasts"),
    {
      text: message,
      senderId: "ADMIN_BROADCAST",

      targetType: targetType,        // ALL / CUSTOM
      targetUids: targetUids || [],

      createdAt: serverTimestamp()
    }
  );

}
