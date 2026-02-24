import { renderAkunKeamanan } from "./akunKeamanan.js";
import { renderAkunProfil } from "./akunProfil.js";
import { renderAkunSosial } from "./akunSosial.js";
import { renderAkunPrivasi } from "./akunPrivasi.js";

export async function renderAkunPage(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="account-container">

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
  document.getElementById("menuKeamanan").onclick = renderAkunKeamanan;
  document.getElementById("menuProfil").onclick = renderAkunProfil;
  document.getElementById("menuSosial").onclick = renderAkunSosial;
  document.getElementById("menuPrivasi").onclick = renderAkunPrivasi;

}
