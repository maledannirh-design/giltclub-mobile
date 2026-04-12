import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "./firestore.js";

import { db, auth } from "./firebase.js";

/* =====================================================
   🎯 LISTEN BROADCAST (USER SIDE)
===================================================== */
export function listenBroadcast(){

  const q = query(
    collection(db,"broadcasts"),
    orderBy("createdAt","desc")
  );

  onSnapshot(q, (snap)=>{

    snap.docChanges().forEach(change=>{

      if(change.type !== "added") return;

      const data = change.doc.data();

      // 🔥 FILTER TARGET
      if(data.targetType === "CUSTOM"){
        if(!data.targetUids?.includes(auth.currentUser.uid)){
          return;
        }
      }

      // 🔔 tampilkan
      alert("📢 " + data.text);

    });

  });

}
