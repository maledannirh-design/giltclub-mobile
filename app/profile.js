import { auth, db, storage } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { doc, updateDoc, collection, query, increment, orderBy, onSnapshot, getDocs, runTransaction, getDoc, setDoc, addDoc, serverTimestamp  } from "./firestore.js";
import { ref, uploadBytes, getDownloadURL } from "./storage.js";

let currentUserData = null;
let unsubscribeFollowers = null;

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

  if(user){
    const snap = await getDoc(doc(db,"users",user.uid));
    if(snap.exists()){
      currentUserData = snap.data();
      username = currentUserData.username || user.email;
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
          <div class="account-username">
            ${username}
          </div>
          <div class="account-level">
            ${user ? "Level 1" : "-"}
          </div>
          <div class="account-playing">
            ${user ? "Playing: Beginner" : ""}
          </div>
          <div class="account-membership">
            ${user ? "Member" : "Not verified"}
          </div>
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
    <input id="sheetPinLogin" type="password" placeholder="PIN Login (6 digit)" maxlength="6" inputmode="numeric">

    <button class="btn-primary full" id="sheetLoginBtn">
      Login
    </button>
  </div>
  `;

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

              <button class="friend-btn" onclick="toggleFriend('${uid}')">
                Add Friend
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



let unsubscribeMessages = null;

async function renderChatUI(roomId, targetUid){

  const content = document.getElementById("content");
  const user = auth.currentUser;

  const userSnap = await getDoc(doc(db,"users",targetUid));
  const targetData = userSnap.exists() ? userSnap.data() : null;

  const username = targetData?.username || "User";
  const photo = targetData?.photoURL 
      ? `<img src="${targetData.photoURL}" class="chat-avatar-img">`
      : `<div class="chat-avatar-placeholder">👤</div>`;

  content.innerHTML = `
    <div class="chat-container">

      <div class="chat-header">

        <div class="chat-back" onclick="renderMembers()">
          ←
        </div>

        <div class="chat-user-info">
          <div class="chat-avatar">
            ${photo}
          </div>
          <div class="chat-user-text">
            <div class="chat-username">${username}</div>
            <div class="chat-status">Online</div>
          </div>
        </div>

      </div>

      <div id="chatMessages" class="chat-messages"></div>

      <div class="chat-input">
        <input id="chatText" placeholder="Type message...">
        <button id="sendMessageBtn">Send</button>
      </div>

    </div>
  `;

  const messagesEl = document.getElementById("chatMessages");

  if(unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = onSnapshot(
    query(
      collection(db,"chatRooms",roomId,"messages"),
      orderBy("createdAt","asc")
    ),
    (snapshot)=>{

      messagesEl.innerHTML = "";

      snapshot.forEach(doc=>{

        const data = doc.data();
        const isMine = data.senderId === user.uid;

        messagesEl.innerHTML += `
          <div class="chat-bubble ${isMine ? "mine" : "theirs"}">
            ${data.text}
          </div>
        `;
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  );

  document.getElementById("sendMessageBtn").onclick = async ()=>{

    const input = document.getElementById("chatText");
    const text = input.value.trim();
    if(!text) return;

    await addDoc(
      collection(db,"chatRooms",roomId,"messages"),
      {
        senderId: user.uid,
        text: text,
        createdAt: serverTimestamp()
      }
    );

    await updateDoc(
      doc(db,"chatRooms",roomId),
      {
        lastMessage: text,
        updatedAt: serverTimestamp()
      }
    );

    input.value = "";
  };
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
      await setDoc(roomRef,{
        participants: [myUid, targetUid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: ""
      });
    }

    renderChatUI(roomId, targetUid);

  }catch(err){
    console.error(err);
  }
};

// 🔥 FUNGSI ADD FRIEND
window.toggleFriend = (uid)=> alert("Friend logic for " + uid);

// 🔥 FUNGSI BLOCK MEMBER
window.blockUser = (uid)=>{
  if(confirm("Konfirmasi blokir user ini?")){
    alert("User blocked: " + uid);
  }
};
