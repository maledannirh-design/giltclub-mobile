import { 
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  collection
} from "./firestore.js";

import { db } from "./firebase.js";

export async function sendAdminBroadcast(message, targetUids){

  for(const uid of targetUids){

    const roomId = "broadcast_" + uid;

    // Buat / update room
    await setDoc(
      doc(db,"chatRooms",roomId),
      {
        participants: [uid,"ADMIN_BROADCAST"],
        type: "broadcast",
        lastMessage: message,
        lastMessageAt: serverTimestamp(),
        unreadCount: { [uid]: 1 }
      },
      { merge:true }
    );

    // Tambah message
    await addDoc(
      collection(db,"chatRooms",roomId,"messages"),
      {
        senderId: "ADMIN_BROADCAST",
        text: message,
        createdAt: serverTimestamp()
      }
    );

  }

}
