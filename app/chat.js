import { 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs
} from "./firestore.js";

import { auth, db } from "./firebase.js";

let unsubscribeRooms = null;

export async function renderChat(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  const activeRoomId = localStorage.getItem("activeChatRoom");

  // ===============================
  // MODE 1: CHAT LIST
  // ===============================
  if(!activeRoomId){

    content.innerHTML = `
      <div style="padding:16px">
        <h2>Messages</h2>
        <div id="chatListContainer">Loading...</div>
      </div>
    `;

    const container = document.getElementById("chatListContainer");

    const q = query(
      collection(db,"chatRooms"),
      where("participants","array-contains",user.uid),
      orderBy("lastMessageAt","desc")
    );

    if(unsubscribeRooms) unsubscribeRooms();

    unsubscribeRooms = onSnapshot(q,(snap)=>{

      if(snap.empty){
        container.innerHTML = "No conversations yet.";
        return;
      }

      let html = "";

      snap.forEach(docSnap=>{
        const data = docSnap.data();
        const roomId = docSnap.id;
        const unread = data.unreadCount?.[user.uid] || 0;

        html += `
          <div class="chat-list-item" 
               data-room="${roomId}"
               style="
                 padding:12px;
                 border-bottom:1px solid #eee;
                 cursor:pointer;
                 ${unread > 0 ? "background:#f5faff;" : ""}
               ">
            <div style="font-weight:${unread>0?"600":"500"}">
              ${data.lastMessage || "No message"}
            </div>
            <div style="font-size:12px;opacity:.6">
              ${unread > 0 ? unread + " unread" : ""}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      document.querySelectorAll(".chat-list-item")
        .forEach(el=>{
          el.onclick = ()=>{
            localStorage.setItem("activeChatRoom",el.dataset.room);
            renderChat();
          };
        });

    });

    return;
  }

  // ===============================
  // MODE 2: CHAT ROOM
  // ===============================

  content.innerHTML = `
    <div style="padding:16px">
      <button id="backToList">← Back</button>
      <div id="chatContainer">Loading...</div>
    </div>
  `;

  document.getElementById("backToList").onclick = ()=>{
    localStorage.removeItem("activeChatRoom");
    renderChat();
  };

  await loadConversation(activeRoomId);

  await updateDoc(
    doc(db,"chatRooms",activeRoomId),
    {
      [`unreadCount.${user.uid}`]: 0
    }
  );
}
