import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let unsubscribeNotifications = null;

export function listenUserNotifications(uid){

  if(unsubscribeNotifications){
    unsubscribeNotifications();
    unsubscribeNotifications = null;
  }

  const q = query(
    collection(db, "userNotifications"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeNotifications = onSnapshot(q, (snap) => {

    const notifContainer = document.getElementById("notifList");
    if(!notifContainer) return;

    notifContainer.innerHTML = "";

    snap.forEach(docSnap => {

      const data = docSnap.data();

      const div = document.createElement("div");
      div.className = "notif-item";
      div.innerHTML = `
        <strong>${data.title || "-"}</strong>
        <p>${data.message || ""}</p>
      `;

      notifContainer.appendChild(div);

    });

  });

}
