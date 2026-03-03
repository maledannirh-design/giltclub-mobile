import { 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from "./firestore.js";

import { auth, db } from "./firebase.js";

let unsubscribeRooms = null;

export async function renderChat(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  const activeRoomId = localStorage.getItem("activeChatRoom");

  // ===============================
  // MODE 1: CHAT LIST (WA STYLE - OPTIMIZED)
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

    unsubscribeRooms = onSnapshot(q, (snap)=>{

      if(snap.empty){
        container.innerHTML = "No conversations yet.";
        return;
      }

      let html = "";

      snap.forEach(docSnap=>{

        const data = docSnap.data();
        const roomId = docSnap.id;
        const unread = data.unreadCount?.[user.uid] || 0;

        // ambil lawan chat
        const otherUid = (data.participants || [])
          .find(uid => uid !== user.uid);

        const otherInfo = data.participantsInfo?.[otherUid] || {};

        const username =
          otherInfo.fullName?.trim() ||
          otherInfo.username?.trim() ||
          "User";

        const avatar = otherInfo.photoURL
          ? `<img src="${otherInfo.photoURL}" class="chatlist-avatar-img"/>`
          : `<div class="chatlist-avatar-placeholder">👤</div>`;

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
                <div class="chatlist-username" style="${unread > 0 ? 'font-weight:700;' : ''}">
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
      });

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

function formatTime(date){
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if(isToday){
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }else{
    return date.toLocaleDateString();
  }
}
