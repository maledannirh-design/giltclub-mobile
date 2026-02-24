import { renderKeamanan } from "./keamanan.js";
import { renderProfil } from "./profil.js";
import { renderSosial } from "./sosial.js";
import { renderPrivasi } from "./privasi.js";

export function renderAkunPage(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-title">Pengaturan Akun</div>

      <div class="akun-list">

        <div class="akun-item" id="menuKeamanan">
          <span>Akun & Keamanan</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="menuProfil">
          <span>Informasi Pribadi</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="menuSosial">
          <span>Sosial Media</span>
          <span>›</span>
        </div>

        <div class="akun-item" id="menuPrivasi">
          <span>Pengaturan Privasi</span>
          <span>›</span>
        </div>

      </div>

    </div>
  `;

  document.getElementById("menuKeamanan").onclick = renderKeamanan;
  document.getElementById("menuProfil").onclick = renderProfil;
  document.getElementById("menuSosial").onclick = renderSosial;
  document.getElementById("menuPrivasi").onclick = renderPrivasi;
}

