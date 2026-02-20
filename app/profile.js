import { auth, db, storage } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { doc, updateDoc, collection, query, increment, orderBy, getDocs, runTransaction, getDoc } from "./firestore.js";
import { ref, uploadBytes, getDownloadURL } from "./storage.js";


let currentUserData = null;

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
   ENTRY POINT
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
   MEMBER LIST
========================================= */
export async function renderMembers(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="member-container">
      <h2>Member List</h2>
      <div id="memberList">Loading...</div>
    </div>
  `;

  const listEl = document.getElementById("memberList");

  try{

    const q = query(collection(db, "users"), orderBy("createdAt","desc"));
    const snap = await getDocs(q);

    if(snap.empty){
      listEl.innerHTML = "Belum ada member.";
      return;
    }

    let html = "";

    for (const docSnap of snap.docs) {

      const data = docSnap.data();
      const uid  = docSnap.id;
      const currentUser = auth.currentUser;
      let isFollowing = false;

      if(currentUser){
      const followCheck = await getDoc(
      doc(db,"users",currentUser.uid,"following",uid)
      );
      isFollowing = followCheck.exists();
      }
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
            </div>

            <div>
              <span class="role-badge ${badgeClass}">
                ${data.role}
              </span>
            </div>

            <div>Level: ${data.level || 1}</div>

            <div>
              Playing: ${data.playingLevel || "newbie"}
            </div>

            <div>
              ${data.membership || "MEMBER"}
            </div>

            <div>
              Status: ${data.status || "active"}
            </div>

            <div class="member-actions">
              <button class="follow-btn" onclick="toggleFollow('${uid}')">
                Follow
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

  }catch(err){
    console.error(err);
    listEl.innerHTML = "Error loading members.";
  }

}

/* =========================================
   EVENTS
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
   STUBS
========================================= */
window.toggleFollow = async function(targetUid){

  const user = auth.currentUser;
  if(!user){
    alert("Login dulu");
    return;
  }

  const myUid = user.uid;

  if(myUid === targetUid){
    alert("Tidak bisa follow diri sendiri");
    return;
  }

  try{

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

        transaction.set(myFollowingRef,{ createdAt: new Date() });
        transaction.set(targetFollowerRef,{ createdAt: new Date() });

        transaction.update(myUserRef,{
          followingCount: increment(1)
        });

        transaction.update(targetUserRef,{
          followersCount: increment(1)
        });

      }

    });

    renderMembers();

  }catch(err){
    console.error(err);
    alert("Follow error");
  }

}


window.toggleFriend = (uid)=> alert("Friend logic for " + uid);
window.handleChat = (uid)=> alert("Chat logic for " + uid);
window.blockUser = (uid)=>{
  if(confirm("Konfirmasi blokir user ini?")){
    alert("User blocked: " + uid);
  }
};
