import { doc, updateDoc } from "./firestore.js";

export async function renderChat(){

  const content = document.getElementById("content");
  const user = auth.currentUser;

  if(!content || !user) return;

  const activeRoomId = localStorage.getItem("activeChatRoom");

  content.innerHTML = `
    <div style="padding:20px">
      <h2>Chat</h2>
      <div id="chatContainer">Loading...</div>
    </div>
  `;

  if(!activeRoomId){
    document.getElementById("chatContainer").innerHTML =
      "No conversation selected.";
    return;
  }

  // 🔹 Load conversation dulu
  await loadConversation(activeRoomId);

  // 🔹 Setelah itu reset unread
  await updateDoc(
    doc(db,"chatRooms",activeRoomId),
    {
      [`unreadCount.${user.uid}`]: 0
    }
  );
}
