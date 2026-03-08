

/* ======================================================
   RECORD USER ONLINE LOG
====================================================== */

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "../firestore.js";

import {
  auth,
  db
} from "../firebase.js";

export async function recordUserOnlineLog(){

  const user = auth.currentUser;
  if(!user) return;

  try{

    const uid = user.uid;

    let username = "";

    // ambil username dari Firestore users collection
    const userSnap = await getDoc(doc(db,"users",uid));

    if(userSnap.exists()){
      username = userSnap.data().username || "";
    }

    await addDoc(
      collection(db,"onlineLogs"),
      {
        uid: uid,
        username: username,
        timestamp: serverTimestamp(),
        device: navigator.userAgent,
        page: window.location.pathname
      }
    );

  }catch(e){
    console.error("online log error",e);
  }

}
