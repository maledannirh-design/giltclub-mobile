import { auth, db, storage } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { doc, updateDoc, collection, query, orderBy, getDocs } from "./firestore.js";
import { ref, uploadBytes, getDownloadURL } from "./storage.js";

/* =========================================
   PHOTO UPLOAD
========================================= */
export function bindPhotoUpload() {
  const photoInput = document.getElementById("photoInput");
  if (!photoInput) return;

  photoInput.onchange = async (e) => {
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
      console.error(err);
      alert("Upload failed");
    }
  };
}

/* =========================================
   ACCOUNT UI
========================================= */
export async function renderAccountUI() {

  const content = document.getElementById("content");
  if (!content) return;

  const user = auth.currentUser;

  content.innerHTML = `
    <div class="account-container">

      <div class="account-card">
        <div class="account-top">
          <div class="account-avatar">
            <div class="avatar-icon">👤</div>
          </div>

          <input type="file" id="photoInput" hidden accept="image/*">
          ${user ? `<button id="changePhotoBtn">Change Photo</button>` : ""}

          <div class="account-info">
            <div class="account-username">
              ${user ? user.email : "Guest"}
            </div>
          </div>
        </div>

        <div class="account-actions">
          ${
            user
              ? `<button id="logoutBtn">Logout</button>`
              : `
                <button id="loginBtn">Login</button>
                <button id="registerBtn">Register</button>
              `
          }
        </div>
      </div>

    </div>

    <div class="sheet-overlay" id="sheetOverlay"></div>

    <div class="sheet" id="loginSheet"></div>
  `;

  bindPhotoUpload();
  bindAccountEvents(user);
}

/* =========================================
   MEMBER LIST
========================================= */
export async function renderMembers() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="member-container">
      <h2>Member List</h2>
      <div id="memberList">Loading...</div>
    </div>
  `;

  const listEl = document.getElementById("memberList");

  try {

    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = "Belum ada member.";
      return;
    }

    let html = "";

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const uid = docSnap.id;

      const avatar = data.photoURL
        ? `<img src="${data.photoURL}" class="member-avatar-img">`
        : `👤`;

      html += `
        <div class="member-card">

          <div class="member-left">
            <div class="member-avatar">${avatar}</div>
            <div>${data.followersCount || 0} Followers</div>
            <div>${data.followingCount || 0} Following</div>
          </div>

          <div class="member-right">
            <div class="member-username">
              ${data.username || "User"}
              ${data.verifiedApproved ? `<span>✔</span>` : ``}
            </div>

            <div class="member-actions">
              <button onclick="toggleFollow('${uid}')">Follow</button>
              <button onclick="handleChat('${uid}')">Chat</button>
            </div>
          </div>

        </div>
      `;
    });

    listEl.innerHTML = html;

  } catch (err) {
    console.error(err);
    listEl.innerHTML = "Error loading members.";
  }
}

/* =========================================
   ACCOUNT EVENTS
========================================= */
function bindAccountEvents(user) {

  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("loginSheet");

  if (!overlay || !sheet) return;

  if (!user) {

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");

    if (loginBtn) loginBtn.onclick = () => renderLoginSheet();
    if (registerBtn) registerBtn.onclick = () => renderRegisterSheet();

  } else {

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await logout();
        renderAccountUI();
      };
    }

    const changeBtn = document.getElementById("changePhotoBtn");
    if (changeBtn) {
      changeBtn.onclick = () =>
        document.getElementById("photoInput").click();
    }
  }
}

/* =========================================
   LOGIN SHEET
========================================= */
function renderLoginSheet() {

  const sheet = document.getElementById("loginSheet");
  const overlay = document.getElementById("sheetOverlay");

  overlay.classList.add("active");
  sheet.classList.add("active");

  sheet.innerHTML = `
    <h3>Login</h3>
    <input id="sheetEmail" type="email" placeholder="Email">
    <input id="sheetPinLogin" type="password" maxlength="6" placeholder="PIN (6 digit)">
    <button id="submitLogin">Login</button>
  `;

  document.getElementById("submitLogin").onclick = async () => {
    try {
      const email = document.getElementById("sheetEmail").value.trim();
      const pin = document.getElementById("sheetPinLogin").value.replace(/\s/g,'');

      if (!/^\d{6}$/.test(pin)) {
        throw new Error("PIN harus 6 digit");
      }

      await login(email, pin);
      renderAccountUI();

    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

/* =========================================
   REGISTER SHEET
========================================= */
function renderRegisterSheet() {

  const sheet = document.getElementById("loginSheet");
  const overlay = document.getElementById("sheetOverlay");

  overlay.classList.add("active");
  sheet.classList.add("active");

  sheet.innerHTML = `
    <h3>Register</h3>
    <input id="regEmail" type="email" placeholder="Email">
    <input id="regPin" type="password" maxlength="6" placeholder="PIN (6 digit)">
    <button id="submitRegister">Register</button>
  `;

  document.getElementById("submitRegister").onclick = async () => {
    try {
      const email = document.getElementById("regEmail").value.trim();
      const pin = document.getElementById("regPin").value.replace(/\s/g,'');

      if (!/^\d{6}$/.test(pin)) {
        throw new Error("PIN harus 6 digit");
      }

      await register(email, pin);
      renderAccountUI();

    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

/* =========================================
   GLOBAL STUBS
========================================= */
window.toggleFollow = (uid) => alert("Follow: " + uid);
window.handleChat = (uid) => alert("Chat: " + uid);
