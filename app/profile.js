import { auth, db, storage } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";
let currentUserData = null;


import {
  doc, updateDoc, where, collection, query, increment,
  orderBy, onSnapshot, getDocs, runTransaction,
  getDoc, setDoc, addDoc, serverTimestamp, writeBatch } from "./firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "./storage.js";
import {
  getDatabase, ref, set, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔥 TARUH DI SINI
window.userCache = window.userCache || {};
window.skillCache = window.skillCache || {};
window.followingSet = window.followingSet || new Set();
window.followersSet = window.followersSet || new Set();

// === SUB MODULE AKUN (LAZY LOAD TARGETS) ===
// tidak perlu import statis, karena kita pakai dynamic import
// jadi TIDAK perlu import keamanan.js dll di atas
import { renderSkillByUserId } from "./skill.js";


/* =========================================
   SECTION A LOGIN DAN REGISTER
========================================= */

function renderSheetContent(mode){

  const sheet = document.getElementById("loginSheet");

  // ================= LOGIN =================
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

    // ✅ HANDLE CLOSE (FIXED POSITION)
    const handle = sheet.querySelector(".sheet-handle");
    if(handle){
      handle.addEventListener("click", closeSheet);
    }

    document.getElementById("submitLogin").onclick = async ()=>{
      try{

        const email = document.getElementById("sheetEmail").value.trim();
        const pinLogin = document
          .getElementById("sheetPinLogin")
          .value.replace(/\s/g,'');

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


  // ================= REGISTER =================
  if(mode === "register"){

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Pendaftaran Member</h3>

      <input id="regFullName" type="text" placeholder="Nama Lengkap">
      <input id="regUsername" type="text" placeholder="Username">
      <input id="regEmail" type="email" placeholder="Email">

      <div class="phone-group">
        <div class="country-wrapper">
          <select id="countryCode" class="country-select">
            <option value="+62">🇮🇩 +62</option>
            <option value="+60">🇲🇾 +60</option>
            <option value="+65">🇸🇬 +65</option>
            <option value="+66">🇹🇭 +66</option>
            <option value="+63">🇵🇭 +63</option>
            <option value="+84">🇻🇳 +84</option>
            <option value="+81">🇯🇵 +81</option>
            <option value="+82">🇰🇷 +82</option>
            <option value="+86">🇨🇳 +86</option>
            <option value="+91">🇮🇳 +91</option>
            <option value="+971">🇦🇪 +971</option>
            <option value="+966">🇸🇦 +966</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+61">🇦🇺 +61</option>
            <option value="+49">🇩🇪 +49</option>
            <option value="+33">🇫🇷 +33</option>
            <option value="+39">🇮🇹 +39</option>
            <option value="+34">🇪🇸 +34</option>
            <option value="+7">🇷🇺 +7</option>
          </select>
        </div>

        <input
          id="phoneNumber"
          type="tel"
          placeholder="8123456789"
          maxlength="15"
          inputmode="numeric"
          class="phone-input">
      </div>

      <input id="birthPlace" type="text" placeholder="Tempat Lahir">

      <div class="form-group">
        <label class="field-label">Tanggal Lahir</label>
        <input id="birthDate" type="date">
      </div>

      <input 
        id="pinLogin"
        type="password"
        maxlength="6"
        inputmode="numeric"
        placeholder="Buat PIN Login (6 digit)">

      <input 
        id="pinTrx"
        type="password"
        maxlength="6"
        inputmode="numeric"
        placeholder="Buat PIN Transaksi (6 digit)">

      <div class="terms-row">
        <input type="checkbox" id="termsCheck">
        <label for="termsCheck">Saya setuju syarat & ketentuan</label>
      </div>

      <button class="btn-primary full" id="submitRegister">
        Daftar
      </button>
    `;

    // ✅ HANDLE CLOSE (FIXED POSITION)
    const handle = sheet.querySelector(".sheet-handle");
    if(handle){
      handle.addEventListener("click", closeSheet);
    }

    document.getElementById("submitRegister").onclick = async ()=>{
      try{

        const fullName   = document.getElementById("regFullName").value.trim();
        const username   = document.getElementById("regUsername").value.trim();
        const email      = document.getElementById("regEmail").value.trim();

        const birthPlace = document.getElementById("birthPlace").value.trim();
        const birthDate  = document.getElementById("birthDate").value;

        const countryCode = document.getElementById("countryCode").value;
        const phoneNumber = document.getElementById("phoneNumber").value.trim();
        const phoneFull   = countryCode + phoneNumber;

        const pinLogin = document.getElementById("pinLogin").value.replace(/\s/g,'');
        const pinTrx   = document.getElementById("pinTrx").value.replace(/\s/g,'');

        const terms = document.getElementById("termsCheck").checked;

        if(!terms){
          throw new Error("Setujui syarat & ketentuan");
        }

        if(!/^[0-9]{6,15}$/.test(phoneNumber)){
          throw new Error("Nomor HP tidak valid");
        }

        if(!birthPlace || !birthDate){
          throw new Error("Lengkapi data kelahiran");
        }

        if(!/^\d{6}$/.test(pinLogin) || !/^\d{6}$/.test(pinTrx)){
          throw new Error("PIN harus 6 digit");
        }

        // 🔥 VALIDASI MINIMAL 18 TAHUN
        const today = new Date();
        const birth = new Date(birthDate);

        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();

        if(m < 0 || (m === 0 && today.getDate() < birth.getDate())){
          age--;
        }

        if(age < 18){
          throw new Error("Minimal usia 18 tahun untuk bergabung");
        }

        await register(
          email,
          pinLogin,
          pinTrx,
          username,
          fullName,
          phoneFull,
          birthPlace,
          birthDate
        );

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
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#1DA1F2"/>
                <path d="M9.5 12.5l1.8 1.8 3.5-4" 
                      fill="none" 
                      stroke="#fff" 
                      stroke-width="2" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"/>
              </svg>
            </span>
          </div>

          ${
            user
            ? `
              <div class="account-level">Level ${level}</div>

              <div class="account-exp-text">
                ⚡ ${expCurrent} / 1000 EXP
              </div>

              <div class="account-exp-bar">
                <div class="account-exp-fill" style="width:${expPercent}%"></div>
              </div>

              <div class="account-membership">
                ${membership}
              </div>

              <div class="account-bio">
  ${currentUserData?.bio || "Belum ada bio"}
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
            <button class="btn-secondary" onclick="handleLogout()">
  Logout
</button>
          `
          : `
            <button class="btn-primary" id="registerBtn">Daftar</button>
            <button class="btn-secondary" id="loginBtn">Login</button>
          `
        }
      </div>

    </div>

<div class="account-group">
  <div class="group-row" id="menuKeamanan">Akun & Keamanan <span>›</span></div>
  <div class="group-row" id="menuProfil">Informasi Pribadi <span>›</span></div>
  <div class="group-row" id="menuSosial">Sosial Media <span>›</span></div>
  <div class="group-row" id="menuPrivasi">Pengaturan Privasi <span>›</span></div>
  <div class="group-row" id="menuMembers">Daftar Anggota <span>›</span></div>
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
  // =============================
  // PROFILE NAME & VERIFIED
  // =============================

  const profileNameEl = document.getElementById("profileName");
  const verifiedBadge = document.getElementById("verifiedBadge");

  if(profileNameEl){
    profileNameEl.textContent = username;
  }

  if(verifiedBadge){
    verifiedBadge.style.display =
      currentUserData?.verified === true ? "flex" : "none";
  }

  // =============================
  // PHOTO UPLOAD
  // =============================

  bindPhotoUpload();

  const avatarTrigger = document.getElementById("avatarTrigger");
  if(avatarTrigger){
    avatarTrigger.onclick = ()=>{
      document.getElementById("photoInput").click();
    };
  }

  // =============================
  // LOGIN / LOGOUT
  // =============================

  bindAccountEvents(user);

  // =============================
  // SUB MENU ROUTING (LAZY LOAD)
  // =============================

  const menuKeamanan = document.getElementById("menuKeamanan");
const menuProfil   = document.getElementById("menuProfil");
const menuSosial   = document.getElementById("menuSosial");
const menuPrivasi  = document.getElementById("menuPrivasi");
const menuMembers  = document.getElementById("menuMembers");

  if(menuKeamanan){
    menuKeamanan.onclick = async ()=>{
      const module = await import("./akun/keamanan.js");
      module.renderKeamanan();
    };
  }

  if(menuProfil){
    menuProfil.onclick = async ()=>{
      const module = await import("./akun/profil.js");
      module.renderProfil();
    };
  }

  if(menuSosial){
    menuSosial.onclick = async ()=>{
      const module = await import("./akun/sosial.js");
      module.renderSosial();
    };
  }
  

  if(menuPrivasi){
    menuPrivasi.onclick = async ()=>{
      const module = await import("./akun/privasi.js");
      module.renderPrivasi();
    };
  }
  if(menuMembers){
  menuMembers.onclick = ()=>{
    renderMembers();
    };
  }
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
        await handleLogout();
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

  if(!sheet || !overlay) return;

  overlay.classList.add("active");
  sheet.classList.add("active");

  renderSheetContent(mode);
}

function safeClass(el, action, className){
  if(!el) return;
  el.classList[action](className);
}

function closeSheet(){
  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("loginSheet");

  if(overlay) overlay.classList.remove("active");
  if(sheet) sheet.classList.remove("active");
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
let unsubscribeFollowers = null;
// ===== CHAT LISTENERS =====
let unsubscribeMessages = null;
let unsubscribeTyping = null;
let unsubscribeStatus = null;
let unsubscribeChatList = null;

// 🔥 TARUH DI SINI
window.stopAllListeners = function(){

  try{

    // ===== MEMBERS =====
    if(typeof unsubscribeMembers === "function") unsubscribeMembers();
    if(typeof unsubscribeFollowing === "function") unsubscribeFollowing();
    if(typeof unsubscribeFollowers === "function") unsubscribeFollowers();

    // ===== CHAT =====
    if(typeof unsubscribeMessages === "function") unsubscribeMessages();
    if(typeof unsubscribeTyping === "function") unsubscribeTyping();
    if(typeof unsubscribeStatus === "function") unsubscribeStatus();
    if(typeof unsubscribeChatList === "function") unsubscribeChatList();

  }catch(err){
    console.warn("Listener cleanup error:", err);
  }

  // RESET
  unsubscribeMembers = null;
  unsubscribeFollowing = null;
  unsubscribeFollowers = null;

  unsubscribeMessages = null;
  unsubscribeTyping = null;
  unsubscribeStatus = null;
  unsubscribeChatList = null;

  console.log("🔥 ALL LISTENERS STOPPED");
};


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

  let renderScheduled = false;

  if(unsubscribeMembers) unsubscribeMembers();
  if(unsubscribeFollowing) unsubscribeFollowing();
  if(unsubscribeFollowers) unsubscribeFollowers();

  // 🔥 DEBOUNCE RENDER (INI KUNCI HEMAT)
  function scheduleRender(){
    if(renderScheduled) return;
    renderScheduled = true;

    setTimeout(()=>{
      renderScheduled = false;
      renderUI();
    }, 50); // cukup kecil tapi nahan spam
  }

  function renderUI(){

    if(!usersCache.length){
      listEl.innerHTML = "Belum ada member.";
      return;
    }

    let html = "";

    usersCache.forEach(userDoc=>{

      const data = userDoc.data;
      const uid  = userDoc.id;

      if(window.userCache){
        userCache[uid] = data;
      }

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

          <div class="block-btn" data-uid="${uid}">🚫</div>

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
              ${data.verified ? `<span class="verified-badge">✔</span>` : ``}
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

              <button class="skill-dashboard-btn" data-uid="${uid}">
                ⭐ Skill
              </button>

              <button class="follow-btn ${isFollowing ? 'following' : ''}" data-uid="${uid}">
                ${isFollowing ? 'Following' : 'Follow'}
              </button>

              <button class="chat-btn" data-uid="${uid}">
                💬
              </button>

            </div>

          </div>

        </div>
      `;
    });

    listEl.innerHTML = html;

    /* ============================
       🔥 EVENT DELEGATION (SUPER HEMAT)
    ============================ */

    listEl.onclick = function(e){

      const btn = e.target.closest("button");
      if(!btn) return;

      const uid = btn.dataset.uid;

      // SKILL
      if(btn.classList.contains("skill-dashboard-btn")){
        openPlayerDashboard(uid);
      }

      // FOLLOW
      else if(btn.classList.contains("follow-btn")){
        toggleFollow(uid, btn);
      }

      // CHAT
      else if(btn.classList.contains("chat-btn")){
        handleChat(uid);
      }

      // BLOCK
      else if(btn.classList.contains("block-btn")){
        blockUser(uid);
      }
    };
  }

  // USERS
  unsubscribeMembers = onSnapshot(
    query(collection(db,"users"), orderBy("createdAt","desc")),
    snapshot=>{
      usersCache = snapshot.docs.map(doc=>({
        id: doc.id,
        data: doc.data()
      }));
      scheduleRender();
    }
  );

  if(currentUser){

    // FOLLOWING
    unsubscribeFollowing = onSnapshot(
      collection(db,"users",currentUser.uid,"following"),
      snapshot=>{
        followingSet = new Set();
        snapshot.forEach(doc=> followingSet.add(doc.id));
        window.followingSet = followingSet;
        scheduleRender();
      }
    );

    // FOLLOWERS
    unsubscribeFollowers = onSnapshot(
      collection(db,"users",currentUser.uid,"followers"),
      snapshot=>{
        followersSet = new Set();
        snapshot.forEach(doc=> followersSet.add(doc.id));
        window.followersSet = followersSet;
        scheduleRender();
      }
    );
  }
}


/* =========================================
   CHAT LIST SCREEN
========================================= */

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

        let username = otherUser.username;

if(!username){
  // fallback ambil dari users collection realtime
  getDoc(doc(db,"users",otherUid)).then(snap=>{
    if(snap.exists()){
      const freshName = snap.data().username || "User";
      const el = document.querySelector(
        `.chatlist-card[onclick="renderChatUI('${roomId}','${otherUid}')"] .chatlist-username`
      );
      if(el) el.textContent = freshName;
    }
  });
}

username = username || "User";
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


// 🔥 FUNGSI BLOCK MEMBER
window.blockUser = function(uid){
  if(confirm("Konfirmasi blokir user ini?")){
    alert("User blocked: " + uid);
  }
};

let isLoadingDashboard = false;

window.openPlayerDashboard = async function(userId){

  // 🔥 ANTI DOUBLE TAP (mobile)
  const now = Date.now();
  if(window._lastDashboardTap && now - window._lastDashboardTap < 400) return;
  window._lastDashboardTap = now;

  if(isLoadingDashboard) return;
  isLoadingDashboard = true;

  const modal = document.getElementById("skillModal");
  const content = document.getElementById("skillContent");

  if(!modal || !content){
    console.error("Modal belum ada");
    isLoadingDashboard = false;
    return;
  }

  // 🔥 pastikan benar-benar kebuka
  modal.classList.remove("hidden");
  modal.style.display = "block";

  content.innerHTML = "Loading...";

  try{

    const currentUser = auth.currentUser;

    // 🔥 ambil data target user (PAKAI CACHE DULU)
    let targetUser;

    if(window.userCache && userCache[userId]){
      targetUser = {
        id: userId,
        ...userCache[userId]
      };
    }else{
      const userSnap = await getDoc(doc(db,"users",userId));
      if(!userSnap.exists()){
        content.innerHTML = "User tidak ditemukan";
        isLoadingDashboard = false;
        return;
      }

      targetUser = {
        id: userId,
        ...userSnap.data()
      };
    }

    // 🔥 RELATION (pakai cache dari renderMembers)
    const isFollowing = window.followingSet?.has(userId) || false;
    const isFollower  = window.followersSet?.has(userId) || false;
    const isMutual    = isFollowing && isFollower;

    // 🔥 VISIBILITY RULE
    const visibility = targetUser.privacy?.dashboardVisibility || "public";

    let canView = false;

    if(currentUser && currentUser.uid === userId){
      canView = true;
    }else if(visibility === "public"){
      canView = true;
    }else if(visibility === "followers" && isFollower){
      canView = true;
    }else if(visibility === "following" && isFollowing){
      canView = true;
    }else if(visibility === "mutual" && isMutual){
      canView = true;
    }

    // 🔒 BLOCK
    if(!canView){
      content.innerHTML = "🔒 User tidak mengizinkan melihat dashboard";
      isLoadingDashboard = false;
      return;
    }

    // 🔥 SIMPAN TARGET USER (penting buat edit mode)
    window.currentViewedUserId = userId;

    // 🔥 RENDER
    await renderSkillByUserId(userId);

  }catch(err){
    console.error(err);
    content.innerHTML = "Error load";
  }

  isLoadingDashboard = false;
};


// 🔥 CLOSE MODAL (FIXED)
window.closeSkillModal = function(){

  const modal = document.getElementById("skillModal");

  if(!modal) return;

  modal.classList.add("hidden");
  modal.style.display = "none";

  // 🔥 reset state biar gak ke-lock
  isLoadingDashboard = false;
};

window.handleLogout = async function(){

  try{

    if(window.stopAllListeners){
      stopAllListeners();
    }

    if(window.closeSkillModal){
      closeSkillModal();
    }

    await logout();

    // ❌ STOP DI SINI
    // biarkan main.js yg handle UI via onAuthStateChanged

  }catch(err){
    console.error("Logout error:", err);
  }
};

/* =========================================
   STUBS - WINDOW SECTION B (FIXED)
========================================= */

// 🔥 FUNGSI FOLLOW (FINAL FIX)
window.toggleFollow = async function(targetUid, btn){

  const user = auth.currentUser;
  if(!user || !btn) return;

  try{

    // 🔥 ambil state dari tombol langsung (AMAN)
    const isCurrentlyFollowing = btn.classList.contains("following");

    // 🔥 Optimistic UI update (langsung respon)
    if(isCurrentlyFollowing){
      btn.classList.remove("following");
      btn.innerText = "Follow";
    }else{
      btn.classList.add("following");
      btn.innerText = "Following";
    }

    const myUid = user.uid;

    const myFollowingRef = doc(db,"users",myUid,"following",targetUid);
    const targetFollowerRef = doc(db,"users",targetUid,"followers",myUid);

    const myUserRef = doc(db,"users",myUid);
    const targetUserRef = doc(db,"users",targetUid);

    await runTransaction(db, async (transaction)=>{

      const followSnap = await transaction.get(myFollowingRef);

      if(followSnap.exists()){

        // 🔥 UNFOLLOW
        transaction.delete(myFollowingRef);
        transaction.delete(targetFollowerRef);

        transaction.update(myUserRef,{
          followingCount: increment(-1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(-1)
        });

      }else{

        // 🔥 FOLLOW
        transaction.set(myFollowingRef,{
          createdAt: serverTimestamp()
        });

        transaction.set(targetFollowerRef,{
          createdAt: serverTimestamp()
        });

        transaction.update(myUserRef,{
          followingCount: increment(1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(1)
        });
      }

    });

  }catch(err){

    console.error("Follow error:", err);

    // 🔥 rollback UI kalau gagal
    if(btn){
      btn.classList.toggle("following");

      btn.innerText = btn.classList.contains("following")
        ? "Following"
        : "Follow";
    }
  }
};


window.renderChatUI = async function(roomId, targetUid){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!user || !content) return;

  content.innerHTML = `
    <div class="chat-room">
      <div class="chat-header">
        <button onclick="renderMembers()">← Back</button>
        <div>Chat</div>
      </div>

      <div id="chatMessages" class="chat-messages">
        Loading...
      </div>

      <div class="chat-input">
        <input id="chatInput" placeholder="Type message...">
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `;

  const msgBox = document.getElementById("chatMessages");

  // 🔥 realtime messages
  const messagesRef = collection(db,"chatRooms",roomId,"messages");

  onSnapshot(query(messagesRef, orderBy("createdAt","asc")), snapshot=>{

    let html = "";

    snapshot.forEach(docSnap=>{

      const msg = docSnap.data();
      const isMine = msg.senderId === user.uid;

      html += `
        <div class="chat-bubble ${isMine ? "mine" : ""}">
          ${msg.text}
        </div>
      `;
    });

    msgBox.innerHTML = html;
    msgBox.scrollTop = msgBox.scrollHeight;
  });

  // 🔥 send message
  document.getElementById("sendBtn").onclick = async ()=>{

    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if(!text) return;

    await addDoc(messagesRef,{
      text,
      senderId: user.uid,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db,"chatRooms",roomId),{
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastSenderId: user.uid
    });

    input.value = "";
  };
};
