import { auth } from "../firebase.js";
import { renderAkunPage } from "./index.js";

export function renderKeamanan(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAkun">← Kembali</div>
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

  document.getElementById("backToAkun").onclick = renderAkunPage;
  document.getElementById("changeLoginPin").onclick = () => openPinSheet("login");
  document.getElementById("changeTrxPin").onclick = () => openPinSheet("transaction");
  document.getElementById("resetPin").onclick = openResetPinSheet;
  document.getElementById("logoutBtn").onclick = async () => {
    await auth.signOut();
    location.reload();
  };
  document.getElementById("deleteAccount").onclick = openDeleteAccountSheet;
}

/* ================= PIN SHEET ================= */

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

      <input type="password" id="oldPin"
        placeholder="PIN Lama (6 digit)"
        maxlength="6"
        inputmode="numeric">

      <input type="password" id="newPin"
        placeholder="PIN Baru (6 digit)"
        maxlength="6"
        inputmode="numeric">

      <input type="password" id="confirmPin"
        placeholder="Konfirmasi PIN Baru"
        maxlength="6"
        inputmode="numeric">

      <button class="akun-btn" id="savePinBtn">
        Simpan
      </button>

    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("savePinBtn").onclick = () => {

    const newPin = document.getElementById("newPin").value.trim();
    const confirmPin = document.getElementById("confirmPin").value.trim();

    if(newPin.length !== 6 || confirmPin.length !== 6){
      alert("PIN harus 6 digit.");
      return;
    }

    if(newPin !== confirmPin){
      alert("Konfirmasi PIN tidak cocok.");
      return;
    }

    alert("PIN berhasil diubah (dummy).");
    closeSheet();
  };
}

/* ================= RESET PIN ================= */

function openResetPinSheet(){

  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");
  const sheetContent = document.getElementById("sheetContent");

  sheetContent.innerHTML = `
    <h3>Reset PIN</h3>

    <div class="akun-card">
      <button class="akun-btn" id="resetPinBtn">
        Kirim Reset
      </button>
    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("resetPinBtn").onclick = () => {
    alert("Instruksi reset dikirim (dummy).");
    closeSheet();
  };
}

/* ================= DELETE ACCOUNT ================= */

function openDeleteAccountSheet(){

  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");
  const sheetContent = document.getElementById("sheetContent");

  sheetContent.innerHTML = `
    <h3>Hapus Akun Permanen</h3>

    <div class="akun-card">

      <input type="password" id="deletePin"
        placeholder="Masukkan PIN Login"
        maxlength="6"
        inputmode="numeric">

      <button class="akun-btn akun-btn-danger" id="confirmDelete">
        Hapus Permanen
      </button>

    </div>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");
  overlay.onclick = closeSheet;

  document.getElementById("confirmDelete").onclick = () => {

    const pin = document.getElementById("deletePin").value.trim();

    if(pin.length !== 6){
      alert("PIN tidak valid.");
      return;
    }

    alert("Akun terhapus (dummy).");
    closeSheet();
  };
}

function closeSheet(){
  document.getElementById("sheetOverlay").classList.remove("active");
  document.getElementById("securitySheet").classList.remove("active");
}
