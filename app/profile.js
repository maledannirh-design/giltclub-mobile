import { auth } from "./firebase.js";
import { login, register, logout } from "./auth.js";
import { showToast } from "./ui.js";

let currentUserData = null;

/* =========================================
   ENTRY POINT
========================================= */
export async function renderAccountUI(){

  const content = document.getElementById("content");
  if(!content) return;

  const user = auth.currentUser;

  content.innerHTML = `
  <div class="account-container page-fade">

    <!-- HEADER CARD -->
    <div class="account-card">

      <div class="account-top">
        <div class="account-avatar" id="avatarTrigger">
          <div class="avatar-icon">👩</div>
        </div>

        <div class="account-info">
          <div class="account-username">
            ${user ? "jackdim" : "Guest"}
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

    <!-- GROUP SECTION -->
    <div class="account-group">
      <div class="group-row">Akun & Keamanan <span>›</span></div>
      <div class="group-row">Informasi Pribadi <span>›</span></div>
      <div class="group-row">Sosial Media <span>›</span></div>
      <div class="group-row">Pengaturan Privasi <span>›</span></div>
    </div>

  </div>

  <!-- LOGIN BOTTOM SHEET -->
  <div class="sheet-overlay" id="sheetOverlay"></div>

  <div class="sheet" id="loginSheet">
    <div class="sheet-handle"></div>

    <h3>Login</h3>

    <input id="sheetEmail" placeholder="Email">
    <input id="sheetPassword" type="password" placeholder="Password">

    <button class="btn-primary full" id="sheetLoginBtn">
      Login
    </button>
  </div>
  `;

  bindAccountEvents(user);
}


/* =========================================
   EVENT BINDING
========================================= */
function bindAccountEvents(user){

  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("loginSheet");

  if(!overlay || !sheet) return;

  if(!user){

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const sheetLoginBtn = document.getElementById("sheetLoginBtn");

    if(loginBtn) loginBtn.onclick = openSheet;
    if(registerBtn) registerBtn.onclick = openSheet;

    if(sheetLoginBtn){
      sheetLoginBtn.onclick = async ()=>{
        try{
          const email = document.getElementById("sheetEmail").value;
          const pass = document.getElementById("sheetPassword").value;

          await login(email, pass);

          closeSheet();
          renderAccountUI();

        }catch(err){
          showToast(err.message, "error");
        }
      };
    }
  }

  if(user){
    const logoutBtn = document.getElementById("logoutBtn");

    if(logoutBtn){
      logoutBtn.onclick = async ()=>{
        await logout();
        currentUserData = null;
        renderAccountUI();
      };
    }
  }

  overlay.onclick = closeSheet;
}


/* =========================================
   SHEET CONTROL
========================================= */
function openSheet(){
  document.getElementById("loginSheet")?.classList.add("active");
  document.getElementById("sheetOverlay")?.classList.add("active");
}

function closeSheet(){
  document.getElementById("loginSheet")?.classList.remove("active");
  document.getElementById("sheetOverlay")?.classList.remove("active");
}
