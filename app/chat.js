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

import {
  auth,
  db,
  rtdb
} from "./firebase.js";

import {
  ref,
  onValue,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


let unsubscribeRooms = null;
let unsubscribeMessages = null;

export async function renderChat(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content || !user) return;

  const activeRoomId = localStorage.getItem("activeChatRoom");

  // =====================================================
  // MODE 1 : CHAT LIST
  // =====================================================
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
        const isBroadcast = data.type === "broadcast";

        let username = "User";
        let avatar = `<div class="chatlist-avatar-placeholder">👤</div>`;

        if(isBroadcast){

          username = "Admin";
          avatar = `<div class="chatlist-avatar-placeholder">🛡</div>`;

        }else{

          const otherUid = (data.participants || [])
            .find(uid => uid !== user.uid);

          const otherInfo = data.participantsInfo?.[otherUid] || {};

          username =
            otherInfo.fullName?.trim() ||
            otherInfo.username?.trim();

          // fallback fresh ambil dari users collection
          if(!username || username === "User"){
            const userSnap = await getDoc(doc(db,"users",otherUid));
            if(userSnap.exists()){
              username =
                userSnap.data().fullName ||
                userSnap.data().username ||
                "User";
            }else{
              username = "User";
            }
          }

          if(otherInfo.photoURL){
            avatar = `<img src="${otherInfo.photoURL}" class="chatlist-avatar-img"/>`;
          }
        }

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
      }

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

  // =====================================================
// MODE 2 : CHAT ROOM
// =====================================================

const roomId = String(activeRoomId);

const roomSnap = await getDoc(doc(db,"chatRooms",roomId));
if(!roomSnap.exists()){
  localStorage.removeItem("activeChatRoom");
  renderChat();
  return;
}

const roomData = roomSnap.data();
const isBroadcast = roomData.type === "broadcast";

let username = "User";
let avatar = `<div class="chat-avatar-placeholder">👤</div>`;
let otherUid = null;

if(isBroadcast){

  username = "Admin";
  avatar = `<div class="chat-avatar-placeholder">🛡</div>`;

}else{

  otherUid = (roomData.participants || [])
    .find(uid => uid !== user.uid);

  const otherInfo = roomData.participantsInfo?.[otherUid] || {};

  username =
    otherInfo.fullName?.trim() ||
    otherInfo.username?.trim();

  if(!username || username === "User"){
    const userSnap = await getDoc(doc(db,"users",otherUid));
    if(userSnap.exists()){
      username =
        userSnap.data().fullName ||
        userSnap.data().username ||
        "User";
    }else{
      username = "User";
    }
  }

  if(otherInfo.photoURL){
    avatar = `<img src="${otherInfo.photoURL}" class="chat-avatar-img"/>`;
  }
}

content.innerHTML = `
  <div class="chat-container">

    <div class="chat-header">
      <div class="chat-left">
        <div id="backToList" class="chat-back">←</div>
        <div class="chat-user-info">
          <div class="chat-avatar">
            ${avatar}
            ${!isBroadcast?`<div id="onlineDot" class="online-dot"></div>`:""}
          </div>
          <div class="chat-user-text">
            <div class="chat-username">${username}</div>
            <div class="chat-status">${isBroadcast?"Admin Broadcast":"Checking..."}</div>
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

const messagesRef = collection(db,"chatRooms",roomId,"messages");
const msgQuery = query(messagesRef, orderBy("createdAt","asc"));

if(unsubscribeMessages) unsubscribeMessages();

unsubscribeMessages = onSnapshot(msgQuery,(snap)=>{

  if(!chatContainer) return;

  chatContainer.innerHTML = "";

  snap.forEach(docSnap=>{
    const msg = docSnap.data();
    const isMine = msg.senderId === user.uid;

    chatContainer.innerHTML += `
      <div class="chat-group ${isMine?'mine':'theirs'}">
        <div class="chat-bubble ${isMine?'mine':'theirs'}">
          <div class="bubble-content">${msg.text}</div>
          <div class="bubble-footer">
            <span class="bubble-time">
              ${msg.createdAt?.toDate ? formatTime(msg.createdAt.toDate()) : ""}
            </span>
          </div>
        </div>
      </div>
    `;
  });

  chatContainer.scrollTop = chatContainer.scrollHeight;
});

await updateDoc(doc(db,"chatRooms",roomId),{
  [`unreadCount.${user.uid}`]: 0,
  [`lastRead.${user.uid}`]: serverTimestamp()
});

// =====================================================
// ONLINE + TYPING
// =====================================================

if(!isBroadcast && otherUid){

  const statusRef = ref(rtdb,"status/"+otherUid);
  const statusEl = document.querySelector(".chat-status");
  const onlineDot = document.getElementById("onlineDot");

  onValue(statusRef,(snap)=>{
    const status = snap.val();

    if(status?.online){
      statusEl.textContent = "Online";
      statusEl.style.color = "#4CAF50";
      if(onlineDot) onlineDot.style.background="#4CAF50";
    }else{
      statusEl.textContent = status?.lastSeen
        ? "Last seen " + formatTime(new Date(status.lastSeen))
        : "Offline";
      statusEl.style.color = "#999";
      if(onlineDot) onlineDot.style.background="#999";
    }
  });

  const typingRef = ref(rtdb, `typing/${roomId}/${user.uid}`);
  const otherTypingRef = ref(rtdb, `typing/${roomId}/${otherUid}`);

  const typingEl = document.getElementById("typingIndicator");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  chatInput.addEventListener("input",()=>{

    chatInput.style.height="auto";
    chatInput.style.height=chatInput.scrollHeight+"px";

    set(typingRef,true);

    clearTimeout(window.typingTimeout);
    window.typingTimeout=setTimeout(()=>{
      remove(typingRef);
    },1500);

  });

  onValue(otherTypingRef,(snap)=>{
    if(!typingEl) return;
    typingEl.style.display = snap.exists() ? "flex" : "none";
  });

  sendBtn.onclick = async ()=>{
    const text = chatInput.value.trim();
    if(!text) return;

    await sendMessage(roomId,text);

    chatInput.value="";
    chatInput.style.height="auto";
    remove(typingRef);
  };

}


  function formatTime(date){

  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if(isToday){
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }else{
    return date.toLocaleDateString();
  }
}

  async function sendMessage(roomId, text){

  const user = auth.currentUser;
  if(!user) return;

  const messageRef = collection(db,"chatRooms",roomId,"messages");

  await addDoc(messageRef,{
    text: text,
    senderId: user.uid,
    createdAt: serverTimestamp(),
    seen: false
  });

  await updateDoc(doc(db,"chatRooms",roomId),{
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    lastSender: user.uid
  });

}

}
