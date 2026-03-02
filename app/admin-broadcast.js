import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

/* ======================================================
   LOAD USERS FOR CHECKBOX LIST
====================================================== */
export async function loadMembersForBroadcast(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "Loading...";

  const snap = await getDocs(collection(db, "users"));

  container.innerHTML = "";

  snap.forEach((userDoc) => {
    const user = userDoc.data();

    const wrapper = document.createElement("div");
    wrapper.className = "broadcast-user-item";

    wrapper.innerHTML = `
      <label>
        <input type="checkbox" value="${userDoc.id}" />
        ${user.name || "No Name"} (${user.email || ""})
      </label>
    `;

    container.appendChild(wrapper);
  });
}

/* ======================================================
   SEND BROADCAST
====================================================== */
export async function sendBroadcast({
  title,
  message,
  targetType,
  selectedUserIds = [],
  adminId
}) {
  if (!title || !message) {
    alert("Title dan message wajib diisi");
    return;
  }

  const broadcastRef = await addDoc(collection(db, "broadcasts"), {
    title,
    message,
    createdBy: adminId,
    createdAt: serverTimestamp(),
    targetType,
    totalRecipients: 0
  });

  let recipients = [];

  if (targetType === "ALL") {
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach(doc => recipients.push(doc.id));
  } else {
    recipients = selectedUserIds;
  }

  if (recipients.length === 0) {
    alert("Tidak ada user dipilih");
    return;
  }

  const batchLimit = 400;
  let batch = writeBatch(db);
  let counter = 0;

  for (let userId of recipients) {
    const notifRef = doc(collection(db, "userNotifications"));

    batch.set(notifRef, {
      userId,
      broadcastId: broadcastRef.id,
      title,
      message,
      isRead: false,
      createdAt: serverTimestamp()
    });

    counter++;

    if (counter === batchLimit) {
      await batch.commit();
      batch = writeBatch(db);
      counter = 0;
    }
  }

  if (counter > 0) {
    await batch.commit();
  }

  alert(`Broadcast terkirim ke ${recipients.length} member`);
}
