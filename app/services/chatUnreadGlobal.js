import { auth, db } from "../firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot
} from "../firestore.js";

let unsubscribe = null;
let initialized = false;

export function initChatUnreadGlobal(){

  if (initialized) return;
  initialized = true;

  auth.onAuthStateChanged(user => {

    if (!user){
      cleanup();
      return;
    }

    attach(user.uid);

  });

}

function attach(uid){

  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, "chatRooms"),
    where("participants", "array-contains", uid)
  );

  unsubscribe = onSnapshot(q, snap => {

    let totalUnread = 0;

    snap.forEach(doc => {
      const data = doc.data();
      const unread = data.unreadCount?.[uid] || 0;
      totalUnread += unread;
    });

    updateBadge(totalUnread);

  });

}

function updateBadge(count){

  const badge = document.getElementById("chatUnreadBadge");
  if (!badge) return;

  if (count > 0){
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

}

function cleanup(){
  if (unsubscribe){
    unsubscribe();
    unsubscribe = null;
  }
  updateBadge(0);
}
