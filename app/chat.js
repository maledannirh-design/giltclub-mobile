import { 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc
} from "./firestore.js";

import { auth, db, rtdb } from "./firebase.js";
import { ref, onValue, set, remove } from "firebase/database";

let unsubscribeRooms = null;
let unsubscribeMessages = null;

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
              <div class="chatlist-avatar">${avatar}</div>
              <div class="chatlist-text">
                <div class="chatlist-username" style="${unread>0?'font-weight:700;':''}">
                  ${username}
                </div>
                <div class="chatlist-preview">${data.lastMessage || ""}</div>
              </div>
            </div>
            <div class="chatlist-right">
              <div class="chatlist-time">${time}</div>
              ${unread>0?`<div class="chatlist-badge">${unread}</div>`:""}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      document.querySelectorAll(".chatlist-card").forEach(el=>{
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

  const roomSnap = await getDoc(doc(db,"chatRooms",activeRoomId));
  if(!roomSnap.exists()){
    localStorage.removeItem("activeChatRoom");
    renderChat();
    return;
  }

  const roomData = roomSnap.data();
  const otherUid = (roomData.participants || [])
    .find(uid => uid !== user.uid);

  const otherInfo = roomData.participantsInfo?.[otherUid] || {};

  const username =
    otherInfo.fullName?.trim() ||
    otherInfo.username?.trim() ||
    "User";

  const avatar = otherInfo.photoURL
    ? `<img src="${otherInfo.photoURL}" class="chat-avatar-img"/>`
    : `<div class="chat-avatar-placeholder">👤</div>`;

  content.innerHTML = `
    <div class="chat-container">

      <div class="chat-header">
        <div class="chat-left">
          <div id="backToList" class="chat-back">←</div>
          <div class="chat-user-info">
            <div class="chat-avatar">${avatar}<div id="onlineDot" class="online-dot"></div></div>
            <div class="chat-user-text">
              <div class="chat-username">${username}</div>
              <div class="chat-status">Checking...</div>
            </div>
          </div>
        </div>
      </div>

      <div id="chatContainer" class="chat-messages"></div>

      <div id="typingIndicator" class="typing-indicator" style="display:none;">
        <span></span><span></span><span></span>
      </div>

      <div class="chat-input">
        <textarea id="chatInput" rows="1" placeholder="Type a message..."></textarea>
        <button id="sendBtn">Send</button>
      </div>

    </div>
  `;

  document.getElementById("backToList").onclick = ()=>{
    localStorage.removeItem("activeChatRoom");
    renderChat();
  };

  const chatContainer = document.getElementById("chatContainer");

  // ===============================
  // LOAD MESSAGES + READ RECEIPT
  // ===============================

  const messagesRef = collection(db,"chatRooms",activeRoomId,"messages");
  const msgQuery = query(messagesRef, orderBy("createdAt","asc"));

  if(unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = onSnapshot(msgQuery,(snap)=>{
    chatContainer.innerHTML = "";

    const lastRead = roomData.lastRead?.[otherUid]?.toDate?.() || null;

    snap.forEach(docSnap=>{
      const msg = docSnap.data();
      const isMine = msg.senderId === user.uid;

      let checkMark = "";

      if(isMine && lastRead && msg.createdAt?.toDate() <= lastRead){
        checkMark = `<span style="color:#4fc3f7">✔✔</span>`;
      }else if(isMine){
        checkMark = `✔✔`;
      }

      chatContainer.innerHTML += `
        <div class="chat-group ${isMine?'mine':'theirs'}">
          <div class="chat-bubble ${isMine?'mine':'theirs'}">
            <div class="bubble-content">${msg.text}</div>
            <div class="bubble-footer">
              <span class="bubble-time">
                ${msg.createdAt?.toDate ? formatTime(msg.createdAt.toDate()) : ""}
              </span>
              ${isMine ? `<span class="seen-indicator">${checkMark}</span>`:""}
            </div>
          </div>
        </div>
      `;
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
  });

  await updateDoc(doc(db,"chatRooms",activeRoomId),{
    [`unreadCount.${user.uid}`]: 0,
    [`lastRead.${user.uid}`]: serverTimestamp()
  });

  // ===============================
  // ONLINE + LAST SEEN
  // ===============================

  const statusRef = ref(rtdb,"status/"+otherUid);
  const onlineDot = document.getElementById("onlineDot");
  const statusEl = document.querySelector(".chat-status");

  onValue(statusRef,(snap)=>{
    const status = snap.val();

    if(status?.online){
      statusEl.textContent = "Online";
      statusEl.style.color = "#4CAF50";
      onlineDot.style.background = "#4CAF50";
    }else{
      statusEl.textContent = status?.lastSeen
        ? "Last seen " + formatTime(new Date(status.lastSeen))
        : "Offline";
      statusEl.style.color = "#999";
      onlineDot.style.background = "#999";
    }
  });

  // ===============================
  // TYPING
  // ===============================

  const typingRef = ref(rtdb,`typing/${activeRoomId}/${user.uid}`);
  const otherTypingRef = ref(rtdb,`typing/${activeRoomId}/${otherUid}`);
  const typingEl = document.getElementById("typingIndicator");

  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  chatInput.addEventListener("input",()=>{
    chatInput.style.height="auto";
    chatInput.style.height=chatInput.scrollHeight+"px";

    set(typingRef,true);
    clearTimeout(window.typingTimeout);
    window.typingTimeout=setTimeout(()=>remove(typingRef),1500);
  });

  onValue(otherTypingRef,(snap)=>{
    typingEl.style.display = snap.exists() ? "flex" : "none";
  });

  sendBtn.onclick = async ()=>{
    const text = chatInput.value.trim();
    if(!text) return;

    await sendMessage(activeRoomId,text);

    chatInput.value="";
    chatInput.style.height="auto";
    remove(typingRef);
  };

}

function formatTime(date){
  const now=new Date();
  const isToday=
    date.getDate()===now.getDate() &&
    date.getMonth()===now.getMonth() &&
    date.getFullYear()===now.getFullYear();

  if(isToday){
    return date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }else{
    return date.toLocaleDateString();
  }
}
