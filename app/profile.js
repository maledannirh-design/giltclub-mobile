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
function renderAccountLayout(user){

  const content = document.getElementById("content");

  content.innerHTML = `
  <div class="account-page">

    <div class="account-header">

      <div class="account-header-top">

        <div class="avatar">
          <div class="avatar-icon">👩</div>
        </div>

        <div class="account-info">
          <div class="account-username">${user.email.split("@")[0]}</div>
          <div class="account-tier">Level 1</div>
          <div class="account-playing">Playing: Beginner</div>
          <div class="account-membership">Member</div>
        </div>

      </div>

      <div class="account-actions">
        <button id="manageBtn" class="btn btn-primary">Kelola Membership</button>
        <button id="logoutBtn" class="btn btn-outline">Logout</button>
      </div>

    </div>

    <div class="account-body">

      <div class="group">
        <div class="group-row">Akun & Keamanan <span>›</span></div>
        <div class="group-row">Informasi Pribadi <span>›</span></div>
        <div class="group-row">Sosial Media <span>›</span></div>
        <div class="group-row">Pengaturan Privasi <span>›</span></div>
      </div>

    </div>

  </div>
  `;

  document.getElementById("logoutBtn").onclick = async ()=>{
    await logout();
    currentUserData = null;
    renderAccountUI();
  };

}
