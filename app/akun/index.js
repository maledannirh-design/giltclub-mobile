import { renderKeamanan } from "./keamanan.js";
import { renderProfil } from "./profil.js";
import { renderSosial } from "./sosial.js";
import { renderPrivasi } from "./privasi.js";

export async function renderAkunPage(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="account-container">

      <div class="akun-page-title">
        Pengaturan Akun
      </div>

      <div class="account-group">

        <div class="group-row" id="menuKeamanan">
          Akun & Keamanan <span>›</span>
        </div>

        <div class="group-row" id="menuProfil">
          Informasi Pribadi <span>›</span>
        </div>

        <div class="group-row" id="menuSosial">
          Sosial Media <span>›</span>
        </div>

        <div class="group-row" id="menuPrivasi">
          Pengaturan Privasi <span>›</span>
        </div>

      </div>

    </div>
  `;

  // ROUTING
  document.getElementById("menuKeamanan").onclick = renderKeamanan;
  document.getElementById("menuProfil").onclick = renderProfil;
  document.getElementById("menuSosial").onclick = renderSosial;
  document.getElementById("menuPrivasi").onclick = renderPrivasi;
}
