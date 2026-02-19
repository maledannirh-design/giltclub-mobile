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

  if(!user){
    renderLoginUI();
    return;
  }

  renderAccountLayout(user);
}

/* =========================================
   LOGIN UI
========================================= */
function renderLoginUI(){

  const content = document.getElementById("content");

  content.innerHTML = `
  <div class="page-fade">
    <h2>Login / Register</h2>

    <div class="auth-box">
      <input id="email" placeholder="Email">
      <input id="password" type="password" placeholder="Password">
      <input id="username" placeholder="Username (untuk daftar saja)">
      
      <button id="loginBtn" class="btn btn-primary">Login</button>
      <button id="registerBtn" class="btn btn-outline">Register</button>
    </div>
  </div>
  `;

  document.getElementById("loginBtn").onclick = async () => {
    try{
      const email = document.getElementById("email").value;
      const pass = document.getElementById("password").value;
      await login(email, pass);
      renderAccountUI();
    }catch(err){
      showToast(err.message, "error");
    }
  };

  document.getElementById("registerBtn").onclick = async () => {
    try{
      const email = document.getElementById("email").value;
      const pass = document.getElementById("password").value;
      const username = document.getElementById("username").value;

      if(!username){
        showToast("Isi username untuk daftar", "warning");
        return;
      }

      await register(email, pass, username);
      renderAccountUI();
    }catch(err){
      showToast(err.message, "error");
    }
  };
}

/* =========================================
   ACCOUNT LAYOUT
========================================= */
export function renderAccountUI(){

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
          <div class="account-level">Level 1</div>
          <div class="account-playing">Playing: Beginner</div>
          <div class="account-membership">Member</div>
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

    <button class="btn-primary full" id="sheetLoginBtn">Login</button>

  </div>
  `;

  if(!user){
    document.getElementById("loginBtn").onclick = openSheet;
    document.getElementById("registerBtn").onclick = openSheet;
  }

  if(user){
    document.getElementById("logoutBtn").onclick = async ()=>{
      await logout();
      renderAccountUI();
    };
  }

  document.getElementById("sheetOverlay").onclick = closeSheet;
}


  document.getElementById("logoutBtn").onclick = async ()=>{
    await logout();
    currentUserData = null;
    renderAccountUI();
  };

}

function openSheet(){
  document.getElementById("loginSheet").classList.add("active");
  document.getElementById("sheetOverlay").classList.add("active");
}

function closeSheet(){
  document.getElementById("loginSheet").classList.remove("active");
  document.getElementById("sheetOverlay").classList.remove("active");
}

