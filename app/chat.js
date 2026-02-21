export async function renderChat(){
  await updateDoc(
  doc(db,"chatRooms",activeRoomId),
  {
    [`unreadCount.${user.uid}`]: 0
  }
);
  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  content.innerHTML = `
    <div style="padding:20px">
      <h2>Chat</h2>
      <div id="chatContainer">Loading...</div>
    </div>
  `;

  const activeRoomId = localStorage.getItem("activeChatRoom");

  if(!activeRoomId){
    document.getElementById("chatContainer").innerHTML =
      "No conversation selected.";
    return;
  }

  await loadConversation(activeRoomId);
}
