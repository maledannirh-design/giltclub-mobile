import { auth, db, storage } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";
let currentUserData = null;
let unsubscribeFollowers = null;

import {
  doc, updateDoc, where, collection, query, increment,
  orderBy, onSnapshot, getDocs, runTransaction,
  getDoc, setDoc, addDoc, serverTimestamp, writeBatch } from "./firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "./storage.js";
import {
  getDatabase, ref, set, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* =========================================
   SECTION A LOGIN DAN REGISTER
========================================= */

function renderSheetContent(mode){

  const sheet = document.getElementById("loginSheet");

  if(mode === "login"){
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Login</h3>

      <input id="sheetEmail" type="email" placeholder="Email">

      <input id="sheetPinLogin"
        type="password"
        maxlength="6"
        inputmode="numeric"
        placeholder="PIN Login (6 digit)">

      <button class="btn-primary full" id="submitLogin">
        Login
      </button>
    `;

    document.getElementById("submitLogin").onclick = async ()=>{
      try{
        const email = document.getElementById("sheetEmail").value.trim();
        const pinLogin = document.getElementById("sheetPinLogin").value.replace(/\s/g,'');

        if(!/^\d{6}$/.test(pinLogin)){
          throw new Error("PIN harus 6 digit");
        }

        await login(email, pinLogin);
        closeSheet();
        renderAccountUI();

      }catch(err){
        showToast(err.message, "error");
      }
    };
  }

  if(mode === "register"){
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Pendaftaran Member</h3>

      <input id="regFullName" type="text" placeholder="Nama Lengkap">
      <input id="regUsername" type="text" placeholder="Username">
      <input id="regEmail" type="email" placeholder="Email">

      <input id="regPinLogin"
        type="password"
        maxlength="6"
        inputmode="numeric"
        placeholder="Buat PIN Login (6 digit)">

      <input id="regPinTrx"
        type="password"
        maxlength="6"
        inputmode="numeric"
        placeholder="Buat PIN Transaksi (6 digit)">

      <button class="btn-primary full" id="submitRegister">
        Daftar
      </button>
    `;

    document.getElementById("submitRegister").onclick = async ()=>{
      try{

        const fullName = document.getElementById("regFullName").value.trim();
        const username = document.getElementById("regUsername").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const pinLogin = document.getElementById("regPinLogin").value.trim();
        const pinTrx = document.getElementById("regPinTrx").value.trim();

        if(!/^\d{6}$/.test(pinLogin) || !/^\d{6}$/.test(pinTrx)){
          throw new Error("PIN harus 6 digit");
        }

        await register(email, pinLogin, pinTrx, username);

        closeSheet();
        renderAccountUI();

      }catch(err){
        showToast(err.message, "error");
      }
    };
  }
}

/* =========================================
   TAMPILAN MENU AKUN
========================================= */
export async function renderAccountUI(){

  const content = document.getElementById("content");
  if(!content) return;

  const user = auth.currentUser;

  let username = "Guest";
  let membership = "-";
  let level = 0;
  let expTotal = 0;
  let expCurrent = 0;
  let expPercent = 0;

  if(user){

    const snap = await getDoc(doc(db,"users",user.uid));

    if(snap.exists()){

      currentUserData = snap.data();

      username = currentUserData.username || user.email;
      membership = currentUserData.membership || "MEMBER";

      level = currentUserData.level || 0;
      expTotal = currentUserData.exp || 0;

      expCurrent = expTotal % 1000;
      expPercent = (expCurrent / 1000) * 100;
    }
  }

  content.innerHTML = `
  <div class="account-container page-fade">

    <div class="account-card">

      <div class="account-top">
        <div class="account-avatar" id="avatarTrigger">
          ${
            currentUserData?.photoURL
              ? `<img src="${currentUserData.photoURL}" class="account-avatar-img">`
              : `<div class="avatar-icon">👩</div>`
          }
        </div>

        <input type="file" id="photoInput" accept="image/*" hidden>

        <div class="account-info">
          <div class="profile-name-row">
  <h2 id="profileName"></h2>
  <span id="verifiedBadge" class="verified-badge">
  <svg viewBox="0 0 24 24" fill="#1DA1F2">
    <path d="M22 12l-2.2-2.2.3-3.1-3.1.3L12 4 9 6.9l-3.1-.3.3 3.1L4 12l2.2 2.2-.3 3.1 3.1-.3L12 20l3-2.9 3.1.3-.3-3.1L22 12zM10 15l-3-3 1.4-1.4L10 12.2l5.6-5.6L17 8l-7 7z"/>
  </svg>
</span>
</div>

          ${
            user
            ? `
              <div class="account-level">
                Level ${level}
              </div>

              <div class="account-exp-text">
                ⚡ ${expCurrent} / 1000 EXP
              </div>

              <div class="account-exp-bar">
                <div class="account-exp-fill" style="width:${expPercent}%"></div>
              </div>

              <div class="account-membership">
                ${membership}
              </div>
            `
            : `
              <div class="account-level">-</div>
              <div class="account-membership">Not verified</div>
            `
          }

        </div>
      </div>

      <div class="account-actions">
        ${
          user
          ? `
            <button class="btn-primary">Membership</button>
            <button class="btn-secondary" id="logoutBtn">Logout</button>
          `
          : `
            <button class="btn-primary" id="registerBtn">Daftar</button>
            <button class="btn-secondary" id="loginBtn">Login</button>
          `
        }
      </div>

    </div>

    <div class="account-group">
      <div class="group-row">Akun & Keamanan <span>›</span></div>
      <div class="group-row">Informasi Pribadi <span>›</span></div>
      <div class="group-row">Sosial Media <span>›</span></div>
      <div class="group-row">Pengaturan Privasi <span>›</span></div>
    </div>

  </div>

  <div class="sheet-overlay" id="sheetOverlay"></div>

  <div class="sheet" id="loginSheet">
    <div class="sheet-handle"></div>

    <h3>Login</h3>

    <input id="sheetEmail" placeholder="Email">
    <input id="sheetPinLogin" type="password"
      placeholder="PIN Login (6 digit)"
      maxlength="6"
      inputmode="numeric">

    <button class="btn-primary full" id="sheetLoginBtn">
      Login
    </button>
  </div>
  `;
const profileNameEl = document.getElementById("profileName");
const verifiedBadge = document.getElementById("verifiedBadge");

if(profileNameEl){
  profileNameEl.textContent = username;
}

if(verifiedBadge){
  if(currentUserData?.verified === true){
    verifiedBadge.style.display = "flex";
  } else {
    verifiedBadge.style.display = "none";
  }
}
  bindPhotoUpload();

  const avatarTrigger = document.getElementById("avatarTrigger");
  if(avatarTrigger){
    avatarTrigger.onclick = ()=>{
      document.getElementById("photoInput").click();
    };
  }

  bindAccountEvents(user);
}
/* =========================================
   PHOTO UPLOAD
========================================= */
export function bindPhotoUpload() {

  const photoInput = document.getElementById("photoInput");
  if (!photoInput) return;

  photoInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    try {

      if (file.size > 500 * 1024) {
        alert("Max 500kb only");
        return;
      }

      const storageRef = ref(storage, `profilePhotos/${user.uid}`);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", user.uid), {
        photoURL: downloadURL
      });

      location.reload();

    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    }

  });
}
/* =========================================
   EVENTS - LEMBAR AKUN LOG OUT AND REGISTER
========================================= */
function bindAccountEvents(user){

  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("loginSheet");

  if(!overlay || !sheet) return;

  if(!user){

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");

    if(loginBtn){
      loginBtn.onclick = ()=> openSheet("login");
    }

    if(registerBtn){
      registerBtn.onclick = ()=> openSheet("register");
    }
  }

  if(user){
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn){
      logoutBtn.onclick = async ()=>{
        await logout();
        renderAccountUI();
      };
    }
  }

  overlay.onclick = closeSheet;
}

/* =========================================
   SHEET CONTROL
========================================= */
function openSheet(mode="login"){

  const sheet = document.getElementById("loginSheet");
  const overlay = document.getElementById("sheetOverlay");

  overlay.classList.add("active");
  sheet.classList.add("active");

  renderSheetContent(mode);
}
function closeSheet(){
  document.getElementById("sheetOverlay").classList.remove("active");
  document.getElementById("loginSheet").classList.remove("active");
}

/* =====================================================
   🔵 REALTIME ONLINE PRESENCE (GLOBAL – AUTO ONLINE)
===================================================== */

const rtdb = getDatabase();

auth.onAuthStateChanged(user=>{
  if(!user) return;

  const statusRef = ref(rtdb, "status/" + user.uid);

  set(statusRef,{
    online: true,
    lastSeen: Date.now()
  });

  onDisconnect(statusRef).set({
    online: false,
    lastSeen: Date.now()
  });
});

/* =========================================
   SECTION B TAMPILAN MEMBER LIST
========================================= */

let unsubscribeMembers = null;
let unsubscribeFollowing = null;

export function renderMembers(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="member-container">
      <h2>Member List</h2>
      <div id="memberList">Loading...</div>
    </div>
  `;

  const listEl = document.getElementById("memberList");
  const currentUser = auth.currentUser;

  let followingSet = new Set();
  let followersSet = new Set();
  let usersCache = [];

  // ===== CLEAN OLD SNAPSHOT =====
  if(unsubscribeMembers) unsubscribeMembers();
  if(unsubscribeFollowing) unsubscribeFollowing();
  if(unsubscribeFollowers) unsubscribeFollowers();

  function renderUI(){

    if(!usersCache.length){
      listEl.innerHTML = "Belum ada member.";
      return;
    }

    let html = "";

    usersCache.forEach(userDoc=>{

      const data = userDoc.data;
      const uid  = userDoc.id;

      if(currentUser && uid === currentUser.uid) return;

      const isFollowing = followingSet.has(uid);
      const followsYou  = followersSet.has(uid);
      const mutual      = isFollowing && followsYou;

      let badgeClass = "badge-member";
      if(data.role === "admin") badgeClass = "badge-admin";
      if(data.role === "supercoach") badgeClass = "badge-supercoach";
      if(data.role === "coach") badgeClass = "badge-coach";

      const avatar = data.photoURL
        ? `<img src="${data.photoURL}" class="member-avatar-img">`
        : `👤`;

      html += `
        <div class="member-card">

          <div class="block-btn" onclick="blockUser('${uid}')">🚫</div>

          <div class="member-left">
            <div class="member-avatar">${avatar}</div>

            <div class="follow-stats">
              <div>${data.followersCount || 0} Followers</div>
              <div>${data.followingCount || 0} Following</div>
            </div>

            <div class="member-bio">
              ${data.bio || "No bio yet"}
            </div>
          </div>

          <div class="member-right">

            <div class="member-username">
              ${data.username || "User"}
              ${data.verifiedApproved ? `<span class="verified-badge">✔</span>` : ``}
              ${
                mutual
                  ? `<span class="mutual-badge">Mutual</span>`
                  : followsYou
                    ? `<span class="follows-you-badge">Follows You</span>`
                    : ``
              }
            </div>

            <div>
              <span class="role-badge ${badgeClass}">
                ${data.role}
              </span>
            </div>

            <div>Level: ${data.level || 1}</div>
            <div>Playing: ${data.playingLevel || "newbie"}</div>
            <div>${data.membership || "MEMBER"}</div>
            <div>Status: ${data.status || "active"}</div>

            <div class="member-actions">
              <button class="follow-btn ${isFollowing ? 'following' : ''}"
                onclick="toggleFollow('${uid}')">
                ${isFollowing ? 'Following' : 'Follow'}
              </button>
              <button class="chat-btn" onclick="handleChat('${uid}')">
                💬
              </button>
            </div>

          </div>

        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  // ===== USERS REALTIME =====
  unsubscribeMembers = onSnapshot(
    query(collection(db,"users"), orderBy("createdAt","desc")),
    (snapshot)=>{

      usersCache = snapshot.docs.map(doc=>({
        id: doc.id,
        data: doc.data()
      }));

      renderUI();
    }
  );

  if(currentUser){

    // ===== FOLLOWING REALTIME =====
    unsubscribeFollowing = onSnapshot(
      collection(db,"users",currentUser.uid,"following"),
      (snapshot)=>{

        followingSet = new Set();
        snapshot.forEach(doc=>{
          followingSet.add(doc.id);
        });

        renderUI();
      }
    );

    // ===== FOLLOWERS REALTIME =====
    unsubscribeFollowers = onSnapshot(
      collection(db,"users",currentUser.uid,"followers"),
      (snapshot)=>{

        followersSet = new Set();
        snapshot.forEach(doc=>{
          followersSet.add(doc.id);
        });

        renderUI();
      }
    );
  }
}
/* =========================================
   SECTION C TAMPILAN CHAT
========================================= */

let unsubscribeMessages = null;
let unsubscribeTyping = null;
let unsubscribeStatus = null;

async function renderChatUI(roomId, targetUid){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!user || !content) return;

  // Stop old listeners
  if(unsubscribeMessages) unsubscribeMessages();
  if(unsubscribeTyping) unsubscribeTyping();
  if(unsubscribeStatus) unsubscribeStatus();

  // Update last read
  await updateDoc(
  doc(db,"chatRooms",roomId),
  {
    [`lastRead.${user.uid}`]: serverTimestamp(),
    [`unreadCount.${user.uid}`]: 0
  }
);
  
  // Get target user
  const userSnap = await getDoc(doc(db,"users",targetUid));
  const targetData = userSnap.exists() ? userSnap.data() : null;

  const username = targetData?.username || "User";
  const photo = targetData?.photoURL
    ? `<img src="${targetData.photoURL}" class="chat-avatar-img">`
    : `<div class="chat-avatar-placeholder">👤</div>`;

  // Render UI
  content.innerHTML = `
  <div class="chat-container">

    <div class="chat-header">

      <div class="chat-left">
        <div class="chat-back" onclick="renderMembers()">←</div>

        <div class="chat-user-info">
          <div class="chat-avatar">${photo}</div>
          <div class="chat-user-text">
            <div class="chat-username">${username}</div>
            <div class="chat-status">Loading...</div>
          </div>
        </div>
      </div>

      <div class="chat-actions">
        <div class="chat-clear" id="clearChatBtn">🗑</div>
      </div>

    </div>

    <div id="chatMessages" class="chat-messages"></div>
    <div id="typingIndicator"></div>

    <div class="chat-input">
      <input id="chatText" placeholder="Type message..." enterkeyhint="send">
      <button id="sendMessageBtn">Send</button>
    </div>

  </div>
`;

  const messagesEl = document.getElementById("chatMessages");
  const typingEl   = document.getElementById("typingIndicator");
  const chatInput  = document.getElementById("chatText");
  const sendBtn    = document.getElementById("sendMessageBtn");
  const clearBtn   = document.getElementById("clearChatBtn");

  if(!messagesEl || !typingEl || !chatInput || !sendBtn || !clearBtn) return;

  // =============================
  // ONLINE STATUS
  // =============================

  const statusRef = ref(rtdb, "status/" + targetUid);

  unsubscribeStatus = onValue(statusRef, (snapshot)=>{
    const statusEl = document.querySelector(".chat-status");
    if(!statusEl) return;

    const status = snapshot.val();

    if(!status){
      statusEl.textContent = "Offline";
      return;
    }

    if(status.online){
      statusEl.textContent = "Online";
    }else if(status.lastSeen){
      const date = new Date(status.lastSeen);
      statusEl.textContent =
        "Last seen " +
        date.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    }else{
      statusEl.textContent = "Offline";
    }
  });

  // =============================
  // MESSAGE LISTENER
  // =============================

  unsubscribeMessages = onSnapshot(
    query(
      collection(db,"chatRooms",roomId,"messages"),
      orderBy("createdAt","asc")
    ),
    (snapshot)=>{

      if(!document.getElementById("chatMessages")) return;

      messagesEl.innerHTML = "";

      let lastSender = null;
      let currentGroup = null;

      snapshot.forEach(docSnap=>{

        const data = docSnap.data();
        const isMine = data.senderId === user.uid;
        const senderType = isMine ? "mine" : "theirs";

        // New group if sender changes
        if(lastSender !== data.senderId){
          currentGroup = document.createElement("div");
          currentGroup.className = `chat-group ${senderType}`;
          messagesEl.appendChild(currentGroup);
        }

        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${senderType}`;

        const textEl = document.createElement("div");
        textEl.className = "bubble-content";
        textEl.textContent = data.text;
        bubble.appendChild(textEl);

        if(data.createdAt?.seconds){
          const date = new Date(data.createdAt.seconds * 1000);
          const footer = document.createElement("div");
          footer.className = "bubble-footer";

          const time = date.toLocaleTimeString([], {
            hour:"2-digit",
            minute:"2-digit"
          });

          footer.textContent = time;

          if(isMine){
            footer.textContent += data.seen ? " ✔✔" : " ✔";
          }

          bubble.appendChild(footer);
        }

        currentGroup.appendChild(bubble);

        // Auto mark seen
        if(!isMine && !data.seen){
          updateDoc(docSnap.ref,{ seen:true });
        }

        lastSender = data.senderId;
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  );

  // =============================
  // SEND MESSAGE
  // =============================

  async function sendMessage(){
    const text = chatInput.value.trim();
    if(!text) return;

    await addDoc(
      collection(db,"chatRooms",roomId,"messages"),
      {
        senderId:user.uid,
        text,
        createdAt:serverTimestamp(),
        seen:false
      }
    );

 await updateDoc(
  doc(db,"chatRooms",roomId),
  {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    lastSender: user.uid,

    [`unreadCount.${targetUid}`]: increment(1),
    [`unreadCount.${user.uid}`]: 0
  }
);

    chatInput.value="";
  }

  sendBtn.onclick = sendMessage;

  chatInput.addEventListener("keydown",(e)=>{
    if(e.key==="Enter"){
      e.preventDefault();
      sendMessage();
    }
  });

  // =============================
  // TYPING SYSTEM
  // =============================

  let typingTimeout = null;

  chatInput.addEventListener("input", async ()=>{

    const typingRef = doc(db,"chatRooms",roomId,"typing",user.uid);

    await setDoc(typingRef,{
      isTyping:true,
      updatedAt:serverTimestamp()
    });

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(async ()=>{
      await setDoc(typingRef,{
        isTyping:false,
        updatedAt:serverTimestamp()
      });
    },1500);
  });

  unsubscribeTyping = onSnapshot(
    collection(db,"chatRooms",roomId,"typing"),
    (snapshot)=>{

      if(!document.getElementById("typingIndicator")) return;

      let someoneTyping = false;

      snapshot.forEach(doc=>{
        if(doc.id !== user.uid && doc.data().isTyping){
          someoneTyping = true;
        }
      });

      typingEl.innerHTML = someoneTyping
        ? `<div class="typing-indicator">
             <span></span><span></span><span></span>
           </div>`
        : "";
    }
  );

  // =============================
  // CLEAR CHAT
  // =============================

  clearBtn.onclick = async ()=>{

    if(!confirm("Clear this chat?")) return;

    const snap = await getDocs(
      collection(db,"chatRooms",roomId,"messages")
    );

    const batch = writeBatch(db);

    snap.forEach(doc=>{
      batch.delete(doc.ref);
    });

    await batch.commit();

    await updateDoc(
      doc(db,"chatRooms",roomId),
      {
        lastMessage:"",
        lastMessageAt:null,
        lastSender:null
      }
    );
  };
}


/* =========================================
   CHAT LIST SCREEN
========================================= */

let unsubscribeChatList = null;

async function renderChatList(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!user || !content) return;

  if(unsubscribeChatList) unsubscribeChatList();

  content.innerHTML = `
    <div class="chatlist-container">
      <div class="chatlist-header">
        <div class="chatlist-title">Chats</div>
      </div>
      <div id="chatListBody" class="chatlist-body">
        Loading...
      </div>
    </div>
  `;

  const listEl = document.getElementById("chatListBody");
  if(!listEl) return;

  unsubscribeChatList = onSnapshot(
    query(
      collection(db,"chatRooms"),
      where("participants","array-contains", user.uid),
      orderBy("lastMessageAt","desc")
    ),
    (snapshot)=>{

      if(!document.getElementById("chatListBody")) return;

      if(snapshot.empty){
        listEl.innerHTML = `
          <div class="chatlist-empty">
            Belum ada chat.
          </div>
        `;
        return;
      }

      let html = "";

      snapshot.forEach(docSnap=>{

        const room = docSnap.data();
        const roomId = docSnap.id;

        const otherUid = room.participants.find(uid => uid !== user.uid);
        if(!otherUid) return;

        const otherUser = room.userMap?.[otherUid] || {};

        const username = otherUser.username || "User";
        const photo = otherUser.avatar
          ? `<img src="${otherUser.avatar}" class="chatlist-avatar-img">`
          : `<div class="chatlist-avatar-placeholder">👤</div>`;

        const lastMessage = room.lastMessage || "";
        const lastTime = room.lastMessageAt?.seconds
          ? new Date(room.lastMessageAt.seconds * 1000)
              .toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})
          : "";

        const unreadCount = room.unreadCount?.[user.uid] || 0;

        html += `
          <div class="chatlist-card"
               onclick="renderChatUI('${roomId}','${otherUid}')">

            <div class="chatlist-left">
              <div class="chatlist-avatar">
                ${photo}
              </div>

              <div class="chatlist-text">
                <div class="chatlist-username">
                  ${username}
                </div>

                <div class="chatlist-preview">
                  ${lastMessage}
                </div>
              </div>
            </div>

            <div class="chatlist-right">
              <div class="chatlist-time">
                ${lastTime}
              </div>

              ${
                unreadCount > 0
                  ? `<div class="chatlist-badge">${unreadCount}</div>`
                  : ``
              }
            </div>

          </div>
        `;
      });

      listEl.innerHTML = html;
    }
  );
}

/* =========================================
   STUBS - WINDOW SECTION B
========================================= */

// 🔥 FUNGSI FOLLOW
window.toggleFollow = async function(targetUid){

  const user = auth.currentUser;
  if(!user) return;

  const button = document.querySelector(
    `button[onclick="toggleFollow('${targetUid}')"]`
  );

  const isCurrentlyFollowing = button.classList.contains("following");

  // 🔥 Optimistic UI update
  if(isCurrentlyFollowing){
    button.classList.remove("following");
    button.innerText = "Follow";
  }else{
    button.classList.add("following");
    button.innerText = "Following";
  }

  try{

    const myUid = user.uid;

    const myFollowingRef = doc(db,"users",myUid,"following",targetUid);
    const targetFollowerRef = doc(db,"users",targetUid,"followers",myUid);

    const myUserRef = doc(db,"users",myUid);
    const targetUserRef = doc(db,"users",targetUid);

    await runTransaction(db, async (transaction)=>{

      const followSnap = await transaction.get(myFollowingRef);

      if(followSnap.exists()){

        transaction.delete(myFollowingRef);
        transaction.delete(targetFollowerRef);

        transaction.update(myUserRef,{
          followingCount: increment(-1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(-1)
        });

      }else{

        transaction.set(myFollowingRef,{ createdAt: serverTimestamp() });
        transaction.set(targetFollowerRef,{ createdAt: serverTimestamp() });

        transaction.update(myUserRef,{
          followingCount: increment(1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(1)
        });
      }

    });

  }catch(err){
    console.error(err);
  }
}

// 🔥 FUNGSI CHAT
window.handleChat = async function(targetUid){

  const user = auth.currentUser;
  if(!user){
    alert("Login dulu");
    return;
  }

  const myUid = user.uid;
  const roomId = [myUid, targetUid].sort().join("_");

  try{

    // ✅ Mutual follow check
    const myFollowing = await getDoc(
      doc(db,"users",myUid,"following",targetUid)
    );

    const theirFollowing = await getDoc(
      doc(db,"users",targetUid,"following",myUid)
    );

    if(!(myFollowing.exists() && theirFollowing.exists())){
      alert("Perlu saling follow untuk chat");
      return;
    }

    const roomRef = doc(db,"chatRooms",roomId);
    const roomSnap = await getDoc(roomRef);

    if(!roomSnap.exists()){

      const mySnap = await getDoc(doc(db,"users",myUid));
      const targetSnap = await getDoc(doc(db,"users",targetUid));

      const myData = mySnap.exists() ? mySnap.data() : {};
      const targetData = targetSnap.exists() ? targetSnap.data() : {};

      await setDoc(roomRef,{
        participants: [myUid, targetUid],

        lastMessage: "",
        lastMessageAt: serverTimestamp(),
        lastSenderId: "",

        unreadCount: {
          [myUid]: 0,
          [targetUid]: 0
        },

        userMap: {
          [myUid]: {
            username: myData.username || "User",
            avatar: myData.photoURL || ""
          },
          [targetUid]: {
            username: targetData.username || "User",
            avatar: targetData.photoURL || ""
          }
        },

        createdAt: serverTimestamp()
      });
    }

    // 🔥 Masuk ke chat
    renderChatUI(roomId, targetUid);

  }catch(err){
    console.error("handleChat error:", err);
  }
};


// 🔥 expose global
window.renderMembers = renderMembers;
window.renderChatUI = renderChatUI;


// 🔥 FUNGSI BLOCK MEMBER
window.blockUser = function(uid){
  if(confirm("Konfirmasi blokir user ini?")){
    alert("User blocked: " + uid);
  }
};
