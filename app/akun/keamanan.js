import { auth } from "../firebase.js";

export function renderKeamanan(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAccount">← Kembali</div>
      <div class="akun-title">Akun & Keamanan</div>

      <div class="akun-list">

        <div class="akun-item" id="changeLoginPin">
          <span>Ubah PIN Login</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="changeTrxPin">
          <span>Ubah PIN Transaksi</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="resetPin">
          <span>Reset PIN</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="logoutBtn">
          <span>Logout</span>
          <span>›</span>
        </div>

        <div class="akun-item akun-item-danger" id="deleteAccount">
          <span>Hapus Akun</span>
          <span>›</span>
        </div>

      </div>

    </div>

    <div class="akun-sheet-overlay" id="sheetOverlay"></div>
    <div class="akun-sheet" id="securitySheet">
      <div class="akun-sheet-handle"></div>
      <div id="sheetContent"></div>
    </div>
  `;

  // 🔙 BACK
  document.getElementById("backToAccount").onclick = async ()=>{
    const module = await import("../profile.js");
    module.renderAccountUI();
  };

  document.getElementById("changeLoginPin").onclick = () => openPinSheet("login");
  document.getElementById("changeTrxPin").onclick = () => openPinSheet("transaction");
  document.getElementById("resetPin").onclick = openResetPinSheet;

  document.getElementById("logoutBtn").onclick = async () => {
    await auth.signOut();
    location.reload();
  };

  document.getElementById("deleteAccount").onclick = openDeleteAccountSheet;
}

/* ===== SHEET LOGIC ===== */

function openPinSheet(type){
  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");
  const sheetContent = document.getElementById("sheetContent");

  const title = type === "login"
    ? "Ubah PIN Login"
    : "Ubah PIN Transaksi";

  sheetContent.innerHTML = `
    <h3>${title}</h3>
    <div class="akun-card">
      <input type="password" id="newPin" placeholder="PIN Baru (6 digit)" maxlength="6" inputmode="numeric">
      <input type="password" id="confirmPin" placeholder="Konfirmasi PIN" maxlength="6" inputmode="numeric">
      <button class="akun-btn" id="savePinBtn">Simpan</button>
    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("savePinBtn").onclick = ()=>{
    closeSheet();
    alert("PIN berhasil diubah (dummy).");
  };
}

function openResetPinSheet(){
  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");
  const sheetContent = document.getElementById("sheetContent");

  sheetContent.innerHTML = `
    <h3>Reset PIN</h3>
    <div class="akun-card">
      <button class="akun-btn" id="resetPinBtn">Kirim Reset</button>
    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("resetPinBtn").onclick = ()=>{
    closeSheet();
    alert("Instruksi reset dikirim (dummy).");
  };
}

function openDeleteAccountSheet(){
  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");
  const sheetContent = document.getElementById("sheetContent");

  sheetContent.innerHTML = `
    <h3>Hapus Akun Permanen</h3>
    <div class="akun-card">
      <button class="akun-btn akun-btn-danger" id="confirmDelete">
        Hapus Permanen
      </button>
    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("confirmDelete").onclick = ()=>{
    closeSheet();
    alert("Akun terhapus (dummy).");
  };
}

function closeSheet(){
  document.getElementById("sheetOverlay").classList.remove("active");
  document.getElementById("securitySheet").classList.remove("active");
}
