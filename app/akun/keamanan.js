import { auth } from "../firebase.js";
import { renderAkunPage } from "./index.js";

export async function renderKeamanan(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="account-container">

      <div class="akun-back" id="backToAkun">← Kembali</div>
      <div class="akun-page-title">Akun & Keamanan</div>

      <div class="account-group">

        <div class="group-row" id="changeLoginPin">
          Ubah PIN Login <span>›</span>
        </div>

        <div class="group-row" id="changeTrxPin">
          Ubah PIN Transaksi <span>›</span>
        </div>

        <div class="group-row" id="resetPin">
          Reset PIN <span>›</span>
        </div>

        <div class="group-row" id="logoutBtn">
          Logout <span>›</span>
        </div>

        <div class="group-row" id="deleteAccount" style="color:#c76b6b;">
          Hapus Akun <span>›</span>
        </div>

      </div>
    </div>

    <div class="sheet-overlay" id="sheetOverlay"></div>
    <div class="sheet" id="securitySheet">
      <div class="sheet-handle"></div>
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

    <input type="password"
      id="oldPin"
      placeholder="PIN Lama (6 digit)"
      maxlength="6"
      inputmode="numeric">

    <input type="password"
      id="newPin"
      placeholder="PIN Baru (6 digit)"
      maxlength="6"
      inputmode="numeric">

    <input type="password"
      id="confirmPin"
      placeholder="Konfirmasi PIN Baru"
      maxlength="6"
      inputmode="numeric">

    <button class="form-submit" id="savePinBtn">
      Simpan
    </button>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");

  overlay.onclick = closeSheet;

  document.getElementById("savePinBtn").onclick = async () => {

    const oldPin = document.getElementById("oldPin").value.trim();
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

    // TODO:
    // 1. Verifikasi PIN lama
    // 2. Hash PIN baru
    // 3. Update ke Firestore

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
    <p style="font-size:13px;margin-bottom:18px;">
      Reset PIN akan mengirim instruksi ke email Anda.
    </p>

    <button class="form-submit" id="resetPinBtn">
      Kirim Reset
    </button>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");

  overlay.onclick = closeSheet;

  document.getElementById("resetPinBtn").onclick = () => {
    // TODO: Kirim reset via backend
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

    <input type="password"
      id="deletePin"
      placeholder="Masukkan PIN Login"
      maxlength="6"
      inputmode="numeric">

    <button class="form-submit"
      id="confirmDelete"
      style="background:#c76b6b;">
      Hapus Permanen
    </button>
  `;

  overlay.classList.add("active");
  sheet.classList.add("active");

  overlay.onclick = closeSheet;

  document.getElementById("confirmDelete").onclick = async () => {

    const pin = document.getElementById("deletePin").value.trim();

    if(pin.length !== 6){
      alert("PIN tidak valid.");
      return;
    }

    // TODO:
    // 1. Verifikasi PIN
    // 2. Hapus data user di Firestore
    // 3. auth.currentUser.delete()

    alert("Akun terhapus (dummy).");
    closeSheet();
  };
}

/* ================= CLOSE SHEET ================= */

function closeSheet(){
  const overlay = document.getElementById("sheetOverlay");
  const sheet = document.getElementById("securitySheet");

  overlay.classList.remove("active");
  sheet.classList.remove("active");
}
