

/* ======================================================
   RECORD USER ONLINE LOG (ANTI SPAM + REAL VISIT)
====================================================== */
import {
  collection,
  addDoc,
  serverTimestamp
} from "../firestore.js";

import {
  auth,
  db
} from "../firebase.js";

export async function getTopMonthlyUsers(month){
   const ref = collection(db,"monthly_stats",month,"users");
   return getDocs(query(ref,orderBy("attendance","desc"),limit(10)));
}

export async function recordUserOnlineLog(){

  const user = auth.currentUser;
  if(!user) return;

  try{

    const COOLDOWN = 10 * 60 * 1000;

    const lastVisit = localStorage.getItem("visitLogTime");

    const now = Date.now();

    if(lastVisit && now - parseInt(lastVisit) < COOLDOWN){
      return;
    }

    const uid = user.uid;
    const username = user.displayName || "";

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

    localStorage.setItem("visitLogTime", now.toString());

  }catch(e){
    console.error("online log error",e);
  }

}
