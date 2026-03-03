import { 
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp
} from "./firestore.js";

import { db } from "./firebase.js";

export async function sendAdminBroadcast(message){

  const usersSnap = await getDocs(collection(db,"users"));

  for(const userDoc of usersSnap.docs){

    const uid = userDoc.id;
    const roomId = "broadcast_" + uid;

    const roomRef = doc(db,"chatRooms",roomId);

    await setDoc(roomRef,{
      participants: [uid,"ADMIN_BROADCAST"],
      type: "broadcast",
      lastMessage: message,
      lastMessageAt: serverTimestamp(),
      unreadCount: {
        [uid]: 1
      }
    },{ merge:true });

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
