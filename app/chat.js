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

  content.innerHTML = `
    <div class="chat-container">

      <div class="chat-header">
        <div class="chat-left">
          <div id="backToList" class="chat-back">←</div>
          <div class="chat-user-info">
            <div class="chat-username">${username}</div>
            <div class="chat-status">Checking...</div>
          </div>
        </div>
      </div>

      <div id="chatContainer" class="chat-messages"></div>

      <div class="typing-indicator" style="display:none;">
        <span></span><span></span><span></span>
      </div>

      <div class="chat-input">
        <textarea id="chatInput" rows="1" placeholder="Type a message..."></textarea>
        <button id="sendBtn">Send</button>
      </div>

    </div>
  `;

  // Back
  document.getElementById("backToList").onclick = ()=>{
    localStorage.removeItem("activeChatRoom");
    renderChat();
  };

  await loadConversation(activeRoomId);

  // Reset unread + update read receipt
  await updateDoc(doc(db,"chatRooms",activeRoomId),{
    [`unreadCount.${user.uid}`]: 0,
    [`lastRead.${user.uid}`]: serverTimestamp()
  });

  // ===============================
  // ONLINE INDICATOR
  // ===============================
  const statusRef = ref(rtdb,"status/"+otherUid);
  onValue(statusRef,(snap)=>{
    const status = snap.val();
    const el = document.querySelector(".chat-status");
    if(!el) return;

    if(status?.online){
      el.textContent = "Online";
      el.style.color = "#4CAF50";
    }else{
      el.textContent = "Offline";
      el.style.color = "#999";
    }
  });

  // ===============================
  // TYPING INDICATOR
  // ===============================
  const typingRef = ref(rtdb,`typing/${activeRoomId}/${user.uid}`);
  const otherTypingRef = ref(rtdb,`typing/${activeRoomId}/${otherUid}`);

  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const typingEl = document.querySelector(".typing-indicator");

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
    typingEl.style.display = snap.exists() ? "flex" : "none";
  });

  // ===============================
  // SEND BUTTON
  // ===============================
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
