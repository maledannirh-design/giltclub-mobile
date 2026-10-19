import { renderTutorialHome } from "./home.js";
import { renderTutorialCalendar, renderTutorialBookingForm } from "./booking.js";
import { renderWalletTutorial } from "./wallet.js";

const FORM_STEPS=[
  ["sessionType","Jenis Sesi","Pilih jenis permainan yang ingin diikuti, misalnya Mabar atau Drill."],
  ["tier","Tier Sesi","Tier menunjukkan tingkat permainan sesi. Pilih yang sesuai dengan level bermain."],
  ["sessionMode","Tipe Sesi","Tipe sesi menunjukkan format latihan atau permainan yang tersedia."],
  ["maxPlayers","Maksimal Pemain","Jumlah ini menunjukkan kapasitas pemain untuk sesi tersebut."],
  ["sessionDate","Tanggal","Tanggal sesi yang dipilih. Pada tutorial ini tanggalnya 17 Desember 2026."],
  ["startTime","Jam Mulai","Waktu mulai sesi tenis."],
  ["endTime","Jam Selesai","Waktu berakhirnya sesi tenis."],
  ["court","Lapangan","Lokasi lapangan tempat sesi berlangsung."],
  ["ratePerHour","Harga per jam","Contoh harga pada layar simulasi. Harga asli mengikuti detail sesi di aplikasi."]
];

let overlay=null, stage="home", formStep=0, walletStep=0;
const WALLET_STEPS=[
  ["memberCard","Kartu keanggotaan","Kartu digital menunjukkan identitas keanggotaan. Kartu dapat dipakai untuk scan check-in jika fitur scan tersedia, dan kartu dapat dibuka untuk melihat detail kartu atau mencetaknya bila opsi cetak tersedia."],
  ["balance","Lihat saldo","Saldo disamarkan agar lebih privat. Tekan ikon mata untuk menampilkan jumlah saldo Rupiah; tekan lagi untuk menyembunyikannya."],
  ["topup","Deposit / Top Up","Pilih Top Up, masukkan nominal minimal Rp10.000, lalu ikuti instruksi pembayaran QRIS. Setelah mengajukan, kirim bukti transfer ke admin. Simulasi ini tidak mengirim permintaan sungguhan."],
  ["rupiahMutation","Mutasi Rupiah","Mutasi Rupiah mencatat pergerakan saldo uang: misalnya top up, pembayaran booking, refund, atau transaksi produk. Angka plus menambah saldo dan angka minus mengurangi saldo."],
  ["gpointMutation","Mutasi G-Point","Mutasi G-Point mencatat poin yang masuk atau digunakan. G-Point adalah poin reward komunitas, bukan saldo Rupiah; poin dapat dipakai untuk reward atau penukaran yang memang tersedia di aplikasi."]
];
export function startWalletTutorial(){
  closeBookingTutorial();
  overlay=document.createElement("div");
  overlay.className="gt-tutorial-overlay";
  overlay.id="gtWalletTutorial";
  overlay.innerHTML=`<section class="gt-tutorial-window" role="dialog" aria-modal="true" aria-label="Tutorial G-WALLET"><header class="gt-tutorial-header"><div><strong>GMTC • Tutorial G-WALLET</strong><small>Belajar dengan simulasi</small></div><button type="button" class="gt-close" aria-label="Tutup tutorial">×</button></header><div class="gt-progress"><span></span></div><div class="gt-stage-viewport"><div class="gt-stage-track"></div></div><footer class="gt-tutorial-footer"><span class="gt-step-label">Kartu keanggotaan</span><div><button type="button" class="gt-back" disabled>Kembali</button><button type="button" class="gt-next">Lanjut</button></div></footer></section>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".gt-close").addEventListener("click",closeBookingTutorial);
  overlay.addEventListener("click",e=>{if(e.target===overlay)closeBookingTutorial();});
  overlay.querySelector(".gt-back").addEventListener("click",()=>{if(walletStep>0){walletStep--;renderWalletStage();}});
  overlay.querySelector(".gt-next").addEventListener("click",()=>{walletStep++;if(walletStep>=WALLET_STEPS.length){showWalletComplete();return;}renderWalletStage();});
  walletStep=0;renderWalletStage();
}
function renderWalletStage(){
  const track=overlay?.querySelector(".gt-stage-track");if(!track)return;
  track.innerHTML=renderWalletTutorial(walletStep);
  const [key,title]=WALLET_STEPS[walletStep];
  const target=track.querySelector(`[data-wallet-field="${key}"]`);
  target?.classList.add("is-highlighted");
  const bubble=document.createElement("div");bubble.className="gt-guide-bubble gt-form-guide";
  bubble.innerHTML=`<strong>${title}</strong><p>${WALLET_STEPS[walletStep][2]}</p>`;
  if(target) target.insertAdjacentElement("afterend",bubble);
  const eye=track.querySelector(".gt-wallet-eye");
  eye?.addEventListener("click",()=>{const amount=track.querySelector(".gt-wallet-amount");const visible=amount.dataset.visible==="1";amount.textContent=visible?"Rp ******":"Rp 125.000";amount.dataset.visible=visible?"0":"1";eye.textContent=visible?"◉":"⊘";});
  track.querySelector(".gt-wallet-action[data-wallet-field=\"topup\"]")?.addEventListener("click",()=>{track.querySelector(".gt-wallet-demo-topup").hidden=false;});
  track.querySelector(".gt-sim-topup-submit")?.addEventListener("click",()=>{const input=track.querySelector(".gt-wallet-demo-topup input");const message=track.querySelector(".gt-wallet-demo-message");const amount=Number(input.value);message.textContent=amount>=10000?`Simulasi berhasil: pengajuan Top Up Rp ${amount.toLocaleString("id-ID")} akan terlihat sebagai contoh saja. Tidak ada transaksi yang dikirim.`:"Nominal minimum simulasi adalah Rp10.000.";});
  track.querySelectorAll(".gt-sim-card-action").forEach(button=>button.addEventListener("click",()=>{button.textContent=button.textContent==="Scan Check-In"?"Simulasi scan saja":"Print preview";}));
  overlay.querySelector(".gt-step-label").textContent=`Wallet • ${walletStep+1}/${WALLET_STEPS.length}`;
  overlay.querySelector(".gt-progress span").style.width=((walletStep+1)/WALLET_STEPS.length*100)+"%";
  overlay.querySelector(".gt-back").disabled=walletStep===0;
  overlay.querySelector(".gt-next").textContent=walletStep===WALLET_STEPS.length-1?"Selesai":"Lanjut";
}
function showWalletComplete(){
  const track=overlay.querySelector(".gt-stage-track");
  track.innerHTML=`<section class="gt-complete"><div class="gt-complete-icon">💳</div><h3>G-WALLET sudah dikenal!</h3><p>Kartu keanggotaan, saldo Rupiah, Top Up, mutasi Rupiah, dan mutasi G-Point punya fungsi berbeda.</p><p><strong>Ini hanya simulasi.</strong> Tidak ada saldo, poin, atau transaksi sungguhan yang berubah.</p><button type="button" class="gt-finish">Selesai</button></section>`;
  track.querySelector(".gt-finish").addEventListener("click",closeBookingTutorial);
  overlay.querySelector(".gt-step-label").textContent="Selesai";overlay.querySelector(".gt-next").disabled=true;overlay.querySelector(".gt-back").disabled=true;overlay.querySelector(".gt-progress span").style.width="100%";
}
export function startBookingTutorial(){
  closeBookingTutorial();
  overlay=document.createElement("div");
  overlay.className="gt-tutorial-overlay";
  overlay.id="gtBookingTutorial";
  overlay.innerHTML=`
    <section class="gt-tutorial-window" role="dialog" aria-modal="true" aria-label="Tutorial booking GMTC">
      <header class="gt-tutorial-header"><div><strong>GMTC • Tutorial Booking</strong><small>Belajar dengan simulasi</small></div><button type="button" class="gt-close" aria-label="Tutup tutorial">×</button></header>
      <div class="gt-progress"><span></span></div>
      <div class="gt-stage-viewport"><div class="gt-stage-track"></div></div>
      <footer class="gt-tutorial-footer"><span class="gt-step-label">Langkah 1</span><div><button type="button" class="gt-back" disabled>Kembali</button><button type="button" class="gt-next">Mulai</button></div></footer>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".gt-close").addEventListener("click",closeBookingTutorial);
  overlay.addEventListener("click",e=>{if(e.target===overlay) closeBookingTutorial();});
  overlay.querySelector(".gt-back").addEventListener("click",back);
  overlay.querySelector(".gt-next").addEventListener("click",next);
  renderStage();
}
export function closeBookingTutorial(){overlay?.remove();overlay=null;stage="home";formStep=0;walletStep=0;}
function renderStage(){
  const track=overlay?.querySelector(".gt-stage-track"); if(!track)return;
  const content=stage==="home"?renderTutorialHome():stage==="calendar"?renderTutorialCalendar():renderTutorialBookingForm();
  track.innerHTML=content;
  track.className="gt-stage-track "+(stage==="home"?"from-home":stage==="calendar"?"from-calendar":"from-form");
  overlay.querySelector(".gt-progress span").style.width=stage==="home"?"20%":stage==="calendar"?"45%":((55+(formStep+1)/FORM_STEPS.length*40)+"%");
  overlay.querySelector(".gt-step-label").textContent=stage==="home"?"Pengenalan":stage==="calendar"?"Pilih tanggal":"Form • "+(formStep+1)+"/"+FORM_STEPS.length;
  overlay.querySelector(".gt-back").disabled=stage==="home";
  overlay.querySelector(".gt-next").textContent=stage==="home"?"Buka Jadwal":stage==="calendar"?"Lanjut":"Lanjut";
  if(stage==="calendar") setupCalendar();
  if(stage==="form") setupFormStep();
}
function next(){
  if(stage==="home"){stage="calendar";renderStage();return;}
  if(stage==="calendar"){return;}
  if(stage==="form"){
    formStep++;
    if(formStep>=FORM_STEPS.length){showComplete();return;}
    renderStage();
  }
}
function back(){
  if(stage==="calendar"){stage="home";renderStage();return;}
  if(stage==="form"){
    if(formStep>0){formStep--;renderStage();}else{stage="calendar";renderStage();}
  }
}
function setupCalendar(){
  const days=overlay.querySelectorAll(".gt-calendar-day");
  const target=overlay.querySelector('.gt-calendar-day[data-day="17"]');
  days.forEach(btn=>btn.addEventListener("click",()=>{
    if(btn.dataset.day!=="17")return;
    stage="form";formStep=0;renderStage();
  }));
  target?.classList.add("is-target");
  const hint=document.createElement("div");
  hint.className="gt-guide-bubble";
  hint.innerHTML='<span class="gt-guide-arrow">➜</span><strong>Pilih tanggal ini dengan tanda lingkaran</strong>';
  overlay.querySelector(".gt-calendar-card").appendChild(hint);
  overlay.querySelector(".gt-next").textContent="Klik tanggal 17";
}
function setupFormStep(){
  const [field,title,description]=FORM_STEPS[formStep];
  const target=overlay.querySelector('[data-tutorial-field="'+field+'"]');
  target?.classList.add("is-highlighted");
  if(!target)return;
  const bubble=document.createElement("div");
  bubble.className="gt-guide-bubble gt-form-guide";
  bubble.innerHTML='<strong></strong><p></p><span class="gt-guide-arrow">➜</span>';
  bubble.querySelector("strong").textContent=title;
  bubble.querySelector("p").textContent=description;
  target.appendChild(bubble);
  overlay.querySelector(".gt-next").textContent=formStep===FORM_STEPS.length-1?"Selesai":"Lanjut";
}
function showComplete(){
  const track=overlay.querySelector(".gt-stage-track");
  track.innerHTML='<section class="gt-complete"><div class="gt-complete-icon">🎾</div><h3>Hebat, Kak!</h3><p>Kakak sudah mengenal alur memilih tanggal dan membaca form booking GMTC.</p><p><strong>Ini hanya simulasi.</strong> Untuk booking sungguhan, buka menu Jadwal pada aplikasi.</p><button type="button" class="gt-finish">Selesai</button></section>';
  track.querySelector(".gt-finish").addEventListener("click",closeBookingTutorial);
  overlay.querySelector(".gt-step-label").textContent="Selesai";
  overlay.querySelector(".gt-next").disabled=true;
  overlay.querySelector(".gt-back").disabled=true;
  overlay.querySelector(".gt-progress span").style.width="100%";
}
