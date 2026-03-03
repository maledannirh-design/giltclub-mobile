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
// MODE 1: CHAT LIST (WA STYLE)
// ===============================
if(!activeRoomId){

  content.innerHTML = `
    <div class="chatlist-container">
      <div class="chatlist-header">
        <div class="chatlist-title">Messages</div>
      </div>
      <div id="chatListContainer" class="chatlist-body"></div>
    </div>
  `;

  const container = document.getElementById("chatListContainer");

  const q = query(
    collection(db,"chatRooms"),
    where("participants","array-contains",user.uid),
    orderBy("lastMessageAt","desc")
  );

  if(unsubscribeRooms) unsubscribeRooms();

  unsubscribeRooms = onSnapshot(q, async (snap)=>{

    if(snap.empty){
      container.innerHTML = "No conversations yet.";
      return;
    }

    let html = "";

    for(const docSnap of snap.docs){

      const data = docSnap.data();
      const roomId = docSnap.id;
      const unread = data.unreadCount?.[user.uid] || 0;

      // ambil lawan chat
      const otherUid = data.participants.find(uid => uid !== user.uid);

      let otherUser = null;

      try{
        const userSnap = await getDoc(doc(db,"users",otherUid));
        if(userSnap.exists()) otherUser = userSnap.data();
      }catch(e){}

      const avatar = otherUser?.photoURL
        ? `<img src="${otherUser.photoURL}" class="chatlist-avatar-img"/>`
        : `<div class="chatlist-avatar-placeholder">👤</div>`;

      const username = otherUser?.username || "User";

      const time = data.lastMessageAt?.toDate
        ? formatTime(data.lastMessageAt.toDate())
        : "";

      html += `
        <div class="chatlist-card" data-room="${roomId}">
          <div class="chatlist-left">
            <div class="chatlist-avatar">
              ${avatar}
            </div>

            <div class="chatlist-text">
              <div class="chatlist-username">
                ${username}
              </div>
              <div class="chatlist-preview">
                ${data.lastMessage || ""}
              </div>
            </div>
          </div>

          <div class="chatlist-right">
            <div class="chatlist-time">${time}</div>
            ${unread > 0 ? `<div class="chatlist-badge">${unread}</div>` : ""}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    document.querySelectorAll(".chatlist-card")
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
