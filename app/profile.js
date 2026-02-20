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

  /* =========================
     GUEST EVENTS
  ========================== */
  if(!user){

    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const sheetLoginBtn = document.getElementById("sheetLoginBtn");

    if(loginBtn) loginBtn.onclick = ()=> openSheet("login");
if(registerBtn) registerBtn.onclick = ()=> openSheet("register");

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

  /* =========================
     USER EVENTS
  ========================== */
  if(user){
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn){
      logoutBtn.onclick = async ()=>{
        await logout();
        renderAccountUI();
      };
    }
  }

  /* =========================
     ALWAYS ENABLE DRAG
  ========================== */
  enableSheetDrag();

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
function renderSheetContent(mode){

  const sheet = document.getElementById("loginSheet");

  if(mode === "login"){
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Login</h3>

      <input id="sheetEmail" type="email" placeholder="Email" required>
      <input type="password" 
       maxlength="4" 
       inputmode="numeric"
       placeholder="PIN Login (4 digit)" 
       required>

      <button class="form-submit">
        Login
      </button>
    `;
  }

  if(mode === "register"){
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Pendaftaran Member</h3>

      <input type="text" placeholder="Nama Lengkap" required>
      <input type="text" placeholder="Username" required>
      <input type="text" placeholder="Tempat Lahir" required>

      <input type="date" required>

      <div class="phone-row">
        <select required>
          <option value="+62">🇮🇩 +62</option>
          <option value="+65">🇸🇬 +65</option>
        </select>
        <input type="tel" placeholder="8xxxxxxx" required>
      </div>

      <input type="email" placeholder="Alamat Email" required>
      <input type="password" maxlength="4" inputmode="numeric"
             placeholder="Buat PIN Login (4 digit)" required>

      <label class="terms-row">
        <input type="checkbox" required>
        <span>Saya setuju syarat & ketentuan</span>
      </label>

      <button class="form-submit">
        Daftar Member
      </button>
    `;
  }

  enableSheetDrag();
}

function closeSheet(){
  const sheet = document.getElementById("loginSheet");
  const overlay = document.getElementById("sheetOverlay");

  if(!sheet || !overlay) return;

  sheet.classList.remove("active");
  overlay.classList.remove("active");

  sheet.style.transform = ""; // penting reset
}

function enableSheetDrag(){

  const sheet = document.getElementById("loginSheet");
  const handle = sheet?.querySelector(".sheet-handle");

  if(!sheet || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

handle.addEventListener("touchstart", ()=>{
  tapTimeout = setTimeout(()=>{
    closeSheet();
  },150);
});

handle.addEventListener("touchmove", ()=>{
  clearTimeout(tapTimeout);
});

  handle.addEventListener("touchend", ()=>{
    isDragging = false;
    sheet.style.transition = ".35s cubic-bezier(.22,1,.36,1)";

    const diff = currentY - startY;

    if(diff > 150){
      closeSheet();
    } else {
      sheet.style.transform = "";
      sheet.classList.add("active");
    }
  });
   handle.addEventListener("click", ()=>{
  closeSheet();
});
   let tapTimeout;


}
