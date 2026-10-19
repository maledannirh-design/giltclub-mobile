import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp
} from "./firestore.js";
import { renderMemberCard } from "./utils.js";
import { onSnapshot } from "./firestore.js";
import { getVerifiedProgress } from "./verifiedlist/verifiedProgressEngine.js";
import { listenBroadcast } from "./broadcastListener.js";

let userUnsubscribe = null;

window.stopHomeListeners = function(){
  if(userUnsubscribe){
    userUnsubscribe();
    userUnsubscribe = null;
  }
};
let dailyLock = false;
let broadcastStarted = false;

// Reset the scan guard when the app is restored after cancelling the camera.
// Mobile browsers may restore the previous page from the back-forward cache.
window.addEventListener("pageshow", () => {
  dailyLock = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") dailyLock = false;
});


/* =========================================
   HOME DASHBOARD 
========================================= */
export async function renderHome(){

  const content = document.getElementById("content");
  const user = auth.currentUser;
  if(!content) return;
  if(!user){
    await renderPublicActivitySummary(content);
    return;
  }
  try{
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const today = new Date().toISOString().split("T")[0];
    const alreadyClaimed = userData.lastCheckinDate === today;

    const rewardMatrix = userData.membership === "VVIP"
      ? [15,15,15,15,15,15,200]
      : [10,10,10,10,10,10,150];

    const streak = userData.currentStreak || 0;

  /* =============================
   RENDER UI (CLEAN)
============================= */
content.innerHTML = `
  <div class="home-container">

    <div class="home-header">

      <div class="home-profile-left">
        <div class="home-avatar">
          ${
            userData.photoURL
              ? `<img src="${userData.photoURL}" />`
              : `<div class="avatar-placeholder">👤</div>`
          }
        </div>

        <div class="home-user-text">
          <div class="home-username">
            ${userData.username || "User"}
          </div>

          <div class="home-gpoint">
            ${userData.gPoint || 0} G-Point
          </div>
        </div>

      </div>

      <div class="home-profile-right">
        <div class="leaderboard-btn">
          <i class="fa-solid fa-crown"></i>
          <span>Leaderboard</span>
        </div>
        <div class="championclub-btn">
          <i class="fa-solid fa-trophy"></i>
          <span>Champion Club</span>
        </div>
      </div>

    </div>

    <!-- DAILY CHECK-IN -->
    <div class="home-progress-group">
    <div class="daily-card">

      <div class="daily-header">
        <div class="daily-title">Check-In Harian</div>
        <div class="daily-info">Informasi Check-In</div>
      </div>

      <div class="daily-days">
        ${rewardMatrix.map((reward, index)=>{
          const dayNumber = index + 1;
          const claimed = dayNumber <= streak;

          return `
            <div class="daily-box ${claimed ? 'claimed' : ''}"
                 ${alreadyClaimed ? '' : `onclick="openDailyScan(${dayNumber})"`}>
              <div class="daily-day">Hari ${dayNumber}</div>
              <div class="daily-reward">🪙 +${reward}</div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="daily-status ${alreadyClaimed ? 'done' : ''}">
        ${
          alreadyClaimed
            ? "Poin diterima, Check-In lagi besok ya!"
            : "Scan kartu Anda untuk check-in hari ini"
        }
      </div>

    </div>
    ${renderVerifiedProgress(userData)}
    </div>
    ${await renderActivitySummaryCard()}

  </div>
`;

  renderWelcomeMascot(false);

  // =============================
  // NAVIGATION BUTTON
  // =============================
  document.querySelector(".leaderboard-btn")
    ?.addEventListener("click", ()=>{
      if (window.navigate) {
        window.navigate("leaderboard");
      }
    });

  document.querySelector(".championclub-btn")
    ?.addEventListener("click", ()=>{
      if (window.navigate) {
        window.navigate("championClub");
      }
    });

  /* =============================
     REALTIME GPOINT LISTENER
  ============================= */
  if(userUnsubscribe){
    userUnsubscribe();
  }

  userUnsubscribe = onSnapshot(doc(db,"users",user.uid),(snap)=>{
    if(!snap.exists()) return;

    const data = snap.data();

    const gPointEl = document.querySelector(".home-gpoint");
    if(gPointEl){
      gPointEl.textContent = `${data.gPoint || 0} G-Point`;
    }

    document.querySelectorAll(".daily-box").forEach((el, index) => {
      const dayNumber = index + 1;

      if (dayNumber <= (data.currentStreak || 0)) {
        el.classList.add("claimed");
      } else {
        el.classList.remove("claimed");
      }
    });

  }, (err)=>{
    if(err.code === "permission-denied" && !auth.currentUser){
      console.log("Home user listener stopped after logout");
      return;
    }
    console.error("Home user listener error:", err);
  });

  // =============================
  // SYSTEM INIT
  // =============================
  startResetCountdown();

  // 🔥 BROADCAST LISTENER (ANTI DOUBLE)
  if(!broadcastStarted){
    listenBroadcast();
    broadcastStarted = true;
  }

  }catch(error){

    console.error("Home error:", error);

    content.innerHTML = `
      ${await renderActivitySummaryCard()}
      <div style="padding:20px;color:#8b5e3c;">Beranda member gagal dimuat. Ringkasan aktivitas tetap ditampilkan.</div>
    `;
  }
}



// =========================================
 // GMTC WELCOME MASCOT — floating home assistant
 // =========================================
function positionWelcomeBubble(welcome, bubble, mascot){
  if(!welcome || !bubble || !mascot || bubble.classList.contains("is-hidden")) return;
  const mascotRect = mascot.getBoundingClientRect();
  const bubbleWidth = Math.min(320, window.innerWidth - 24);
  bubble.style.width = bubbleWidth + "px";
  // Keep the comic bubble inside the viewport regardless of where the mascot is dragged.
  if(mascotRect.left + mascotRect.width / 2 < window.innerWidth / 2){
    bubble.classList.add("align-left");
  } else {
    bubble.classList.remove("align-left");
  }
}

function renderWelcomeMascot(isGuest){
  document.getElementById("g-mascot-welcome")?.remove();
  const welcome = document.createElement("div");
  welcome.id = "g-mascot-welcome";
  welcome.className = "g-mascot-welcome";
  const guestMessage = isGuest
    ? '<p class="g-mascot-guest-copy">Yuk kak, daftar di sistem GMTC — gratis tanpa biaya! Langsung dapat potongan diskon mabar dan latihan drill sebagai member.</p><button type="button" class="g-mascot-register" onclick="window.navigate?.(\'account\');setTimeout(()=>document.getElementById(\'registerBtn\')?.click(),150)">Daftar gratis</button>'
    : "";
  welcome.innerHTML = `
    <div class="g-mascot-bubble" id="g-mascot-bubble" role="status">
      <button type="button" class="g-mascot-bubble-close" aria-label="Tutup sambutan" title="Tutup">×</button>
      <p class="g-mascot-greeting">Selamat datang di GMTC, <strong>Home sweet Home!</strong> 🎾</p>
      ${guestMessage}
      <span class="g-mascot-bubble-tail" aria-hidden="true"></span>
    </div>
    <button type="button" class="g-mascot-float" aria-label="Buka sambutan GMTC" aria-expanded="true">
      <img src="./image/mascot-welcome.webp" alt="Maskot Welcome GMTC">
    </button>
    <button type="button" class="g-mascot-name-cta">Kak tutorial dong, butuh panduan sistem?</button>
  `;
  document.body.appendChild(welcome);
  const bubble=welcome.querySelector("#g-mascot-bubble");
  const mascot=welcome.querySelector(".g-mascot-float");
  const nameCta=welcome.querySelector(".g-mascot-name-cta");
  nameCta?.addEventListener("click",()=>{
    mascotContestTuit();
    welcome.querySelector(".g-mascot-faq-bubble")?.remove();
    showMascotFaq(welcome,mascot,positionWelcomeBubble,"Kak tutorial dong, butuh panduan sistem?");
  });
  welcome.querySelector(".g-mascot-bubble-close")?.addEventListener("click",()=>{
    bubble.classList.add("is-hidden");
    mascot.setAttribute("aria-expanded","false");
  });
  positionWelcomeBubble(welcome, bubble, mascot);
  let dragStartX = 0, dragStartY = 0, mascotStartX = 0, mascotStartY = 0;
  let didDrag = false;
  mascot?.addEventListener("pointerdown",(event)=>{
    if(event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const rect = mascot.getBoundingClientRect();
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    mascotStartX = rect.left;
    mascotStartY = rect.top;
    didDrag = false;
    welcome.classList.add("is-dragging");
    try { mascot.setPointerCapture(event.pointerId); } catch (_) {}
  });
  mascot?.addEventListener("pointermove",(event)=>{
    if(!mascot.hasPointerCapture?.(event.pointerId)) return;
    event.preventDefault();
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if(Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
    if(!didDrag) return;
    const mascotWidth = mascot.offsetWidth || 112;
    const mascotHeight = mascot.offsetHeight || 112;
    const maxX = Math.max(0, window.innerWidth - mascotWidth);
    const maxY = Math.max(0, window.innerHeight - mascotHeight);
    welcome.style.left = Math.min(maxX, Math.max(0, mascotStartX + dx)) + "px";
    welcome.style.top = Math.min(maxY, Math.max(0, mascotStartY + dy)) + "px";
    welcome.style.right = "auto";
    welcome.style.bottom = "auto";
    positionWelcomeBubble(welcome, bubble, mascot);
  });
  const finishMascotDrag = (event)=>{
    if(mascot?.hasPointerCapture?.(event.pointerId)) {
      try { mascot.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    welcome.classList.remove("is-dragging");
    if(didDrag){
      mascot.dataset.dragged = "true";
      setTimeout(()=>{ delete mascot.dataset.dragged; },100);
    }
  };
  mascot?.addEventListener("pointerup",finishMascotDrag);
  mascot?.addEventListener("pointercancel",finishMascotDrag);
  mascot?.addEventListener("click",()=>{
    if(mascot.dataset.dragged === "true") return;
    const hidden = bubble.classList.toggle("is-hidden");
    mascot.setAttribute("aria-expanded",String(!hidden));
    if(!hidden) positionWelcomeBubble(welcome, bubble, mascot);
    if(!hidden) showMascotContest(welcome, mascot, positionWelcomeBubble);
  });
  if(sessionStorage.getItem("gmtcMascotContestDismissedThisSession") !== "1") {
    setTimeout(()=>showMascotContest(welcome, mascot, positionWelcomeBubble), 1100);
  }
}
 
function mascotContestTuit(){
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    const ctx = new AC();
    if(ctx.state === "suspended") ctx.resume().catch(()=>{});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1046,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1568,ctx.currentTime + .075);
    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.07,ctx.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime + .13);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + .14);
    osc.onended=()=>ctx.close().catch(()=>{});
  } catch(_) {}
}

function showMascotContest(welcome, mascot, reposition){
  const uid = auth.currentUser?.uid || "";
  const doneKey = uid ? "gmtcMascotContestDone_" + uid : "gmtcMascotContestGuestDone";
  const dismissedKey = "gmtcMascotContestDismissedThisSession";
  if(sessionStorage.getItem(dismissedKey)==="1" || localStorage.getItem(doneKey)==="1") return;
  let prompt = welcome.querySelector(".g-mascot-contest-bubble");
  if(prompt) { prompt.classList.remove("is-hidden"); return; }
  prompt=document.createElement("div");
  prompt.className="g-mascot-bubble g-mascot-contest-bubble";
  prompt.innerHTML='<button type="button" class="g-mascot-bubble-close" aria-label="Tutup">×</button><p class="g-mascot-greeting">Saya adalah... eumm... saya belum dikasih nama. Mauukah kamu kasih nama ke saya?</p><div class="g-mascot-contest-actions"><button type="button" class="g-mascot-contest-yes">Ya, mau!</button><button type="button" class="g-mascot-contest-no">Tidak</button></div><span class="g-mascot-bubble-tail" aria-hidden="true"></span>';
  welcome.appendChild(prompt);
  const dismiss=()=>{mascotContestTuit();prompt.classList.add("is-hidden");sessionStorage.setItem(dismissedKey,"1");};
  prompt.querySelector(".g-mascot-bubble-close").addEventListener("click",dismiss);
  prompt.querySelector(".g-mascot-contest-no").addEventListener("click",dismiss);
  prompt.querySelector(".g-mascot-contest-yes").addEventListener("click",()=>{
    mascotContestTuit();
    prompt.classList.add("is-hidden");
    openMascotContestForm(welcome,mascot,reposition,prompt,doneKey,dismissedKey);
  });
  if(reposition) reposition(welcome,prompt,mascot);
  mascotContestTuit();
}

function openMascotContestForm(welcome, mascot, reposition, prompt, doneKey, dismissedKey){
  document.getElementById("g-mascot-contest-modal")?.remove();
  const modal=document.createElement("div");
  modal.id="g-mascot-contest-modal";
  modal.className="g-mascot-contest-overlay";
  modal.innerHTML='<section class="g-mascot-contest-card" role="dialog" aria-modal="true" aria-labelledby="g-mascot-contest-title"><button type="button" class="g-mascot-contest-modal-close" aria-label="Tutup">×</button><p class="g-mascot-contest-eyebrow">SAYEMBARA NAMA MASKOT GMTC</p><h2 id="g-mascot-contest-title">Bantu aku punya nama! 🎾</h2><p class="g-mascot-contest-intro">Nama usulan belum menjadi nama resmi. Nama terpilih akan ditentukan GMTC.</p><form class="g-mascot-contest-form"><label for="g-mascot-proposed-name">Nama maskot</label><input id="g-mascot-proposed-name" name="name" maxlength="40" required placeholder="Contoh: Gimo"><label for="g-mascot-proposed-reason">Alasan memilih nama</label><textarea id="g-mascot-proposed-reason" name="reason" maxlength="500" required rows="4" placeholder="Ceritakan alasan kamu..."></textarea><fieldset class="g-mascot-prize-fieldset"><legend>Pilih Hadiah</legend><label class="g-mascot-prize-option"><input type="radio" name="prize" value="1 x Sesi Mabar" required><span>1 × Sesi Mabar</span></label><label class="g-mascot-prize-option"><input type="radio" name="prize" value="1 x Sesi Latihan Drill" required><span>1 × Sesi Latihan Drill</span></label><label class="g-mascot-prize-option"><input type="radio" name="prize" value="1 x Grip Alien Pros" required><span>1 × Grip Alien Pros</span></label></fieldset><p class="g-mascot-contest-status" aria-live="polite"></p><div class="g-mascot-contest-form-actions"><button type="submit" class="g-mascot-contest-submit">Submit</button><button type="button" class="g-mascot-contest-reset">Reset</button><button type="button" class="g-mascot-contest-cancel">Nanti saja</button></div></form></section>';
  document.body.appendChild(modal);
  document.body.style.overflow="hidden";
  const form=modal.querySelector("form"), name=modal.querySelector('[name="name"]'), reason=modal.querySelector('[name="reason"]'), status=modal.querySelector(".g-mascot-contest-status"), submit=modal.querySelector(".g-mascot-contest-submit");
  const close=()=>{mascotContestTuit();modal.remove();document.body.style.overflow="";sessionStorage.setItem(dismissedKey,"1");};
  modal.querySelector(".g-mascot-contest-modal-close").addEventListener("click",close);
  modal.querySelector(".g-mascot-contest-cancel").addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  modal.querySelector(".g-mascot-contest-reset").addEventListener("click",()=>{form.reset();status.textContent="";mascotContestTuit();name.focus();});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const proposedName=name.value.trim(), why=reason.value.trim(), prize=modal.querySelector('[name="prize"]:checked')?.value || "";
    if(!proposedName || !why || !prize){status.textContent="Nama, alasan, dan pilihan hadiah wajib diisi.";return;}
    submit.disabled=true;status.textContent="Mengirim usulan...";
    const user=auth.currentUser;
    if(!user?.uid){
      submit.disabled=false;
      status.textContent="";
      const gate=document.createElement("div");
      gate.className="g-mascot-register-gate";
      gate.innerHTML='<section class="g-mascot-register-gate-card" role="dialog" aria-modal="true" aria-labelledby="g-mascot-register-gate-title"><h3 id="g-mascot-register-gate-title">Yuk, Kak, daftar dulu! 🎾</h3><p>Agar ide nama bagusnya tersimpan di sistem club, Kakak perlu daftar atau masuk ke akun GMTC terlebih dahulu.</p><p>Dengan begitu, Kakak juga berkesempatan masuk nominasi dan memenangkan hadiah pilihan Kakak.</p><div class="g-mascot-register-gate-actions"><button type="button" class="g-mascot-register-gate-yes">Daftar / Masuk</button><button type="button" class="g-mascot-register-gate-later">Nanti saja</button></div></section>';
      modal.appendChild(gate);
      gate.querySelector(".g-mascot-register-gate-later").addEventListener("click",()=>{gate.remove();mascotContestTuit();});
      gate.querySelector(".g-mascot-register-gate-yes").addEventListener("click",()=>{
        mascotContestTuit();
        // Close without dismissing the contest for this session; the user can reopen it after registration.
        mascotContestTuit();
        modal.remove();
        document.body.style.overflow="";
        window.navigate?.("account");
        setTimeout(()=>document.getElementById("registerBtn")?.click(),150);
      });
      mascotContestTuit();
      return;
    }
    try{
      if(user?.uid){
        const existing=await getDocs(query(collection(db,"mascotNameSubmissions"),where("userId","==",user.uid)));
        if(!existing.empty){
          localStorage.setItem(doneKey,"1");status.textContent="Anda sudah pernah submit.";
          submit.disabled=false;setTimeout(()=>{close();showMascotFaq(welcome,mascot,reposition,"Kamu sudah pernah mengirim usulan. Terima kasih!");},900);return;
        }
      }
      await addDoc(collection(db,"mascotNameSubmissions"),{name:proposedName,reason:why,prize,userId:user?.uid||null,status:"pending",createdAt:serverTimestamp()});
      localStorage.setItem(doneKey,"1");
      close();
      showMascotFaq(welcome,mascot,reposition,"Makasih! Aku senang sekali! Mudah-mudahan nama yang kamu kasih terpilih jadi namaku, ya!");
      if(!user) setTimeout(()=>{window.navigate?.("account");setTimeout(()=>document.getElementById("registerBtn")?.click(),150);},2200);
    }catch(err){
      console.error("Mascot name submission failed:",err);
      status.textContent=err?.code==="permission-denied"?"Firebase belum mengizinkan pengiriman ini. Fitur perlu pengaturan Rules sebelum digunakan.":"Usulan belum terkirim. Periksa koneksi lalu coba lagi.";
      submit.disabled=false;
    }
  });
  mascotContestTuit();name.focus();
}

function showMascotFaq(welcome,mascot,reposition,heading){
  welcome.querySelector(".g-mascot-contest-bubble")?.remove();
  const faq=[
    ["Cara bergabung dengan GMTC?","Daftar gratis melalui menu Akun dan lengkapi data pendaftaran."],
    ["Cara booking sesi tenis?","Buka jadwal sesi, pilih sesi yang memiliki slot tersedia, lalu ikuti proses booking."],
    ["Apa perbedaan Member, VVIP, dan Visitor?","Visitor belum terdaftar, Member memperoleh harga member, dan VVIP memiliki manfaat khusus sesuai ketentuan GMTC."],
    ["Berapa harga mabar dan drill?","Harga mengikuti jenis sesi dan status keanggotaan. Periksa harga terbaru di website atau detail sesi."],
    ["Bagaimana cara kerja G-WALLET?","G-WALLET adalah saldo akun untuk transaksi GMTC. Saldo dan mutasi dapat dilihat di menu wallet."],
    ["Bagaimana cara mendapatkan diskon member?","Daftar dan gunakan akun member saat booking sesuai ketentuan harga yang berlaku."],
    ["Di mana melihat jadwal dan slot tersedia?","Buka kalender atau menu jadwal di aplikasi GMTC."],
    ["Bagaimana menghubungi admin GMTC?","Gunakan kanal kontak resmi GMTC yang tercantum di website atau aplikasi."]
  ];
  const bubble=document.createElement("div");
  bubble.className="g-mascot-bubble g-mascot-contest-bubble g-mascot-faq-bubble";
  bubble.innerHTML='<button type="button" class="g-mascot-bubble-close" aria-label="Tutup FAQ">×</button><p class="g-mascot-greeting"></p><div class="g-mascot-faq-list"></div><div class="g-mascot-faq-answer" hidden></div><span class="g-mascot-bubble-tail" aria-hidden="true"></span>';
  bubble.querySelector(".g-mascot-greeting").textContent=heading;
  const list=bubble.querySelector(".g-mascot-faq-list");
  faq.forEach((item,i)=>{const b=document.createElement("button");b.type="button";b.className="g-mascot-faq-item";b.textContent=item[0];b.addEventListener("click",()=>{mascotContestTuit();const answer=bubble.querySelector(".g-mascot-faq-answer");answer.textContent=item[1];answer.hidden=false;});list.appendChild(b);});
  bubble.querySelector(".g-mascot-bubble-close").addEventListener("click",()=>{mascotContestTuit();bubble.classList.add("is-hidden");});
  welcome.appendChild(bubble);
  if(reposition) reposition(welcome,bubble,mascot);
  mascotContestTuit();
}


async function renderPublicActivitySummary(content){
  // Guest sees the same TERAS layout as a logged-in member, with account values set to zero.
  // Protected actions open the member-access modal; no private user document/listener is read.
  const rewardMatrix = [10,10,10,10,10,10,150];
  content.innerHTML = `
    <div class="home-container guest-home-container">
      <div class="home-header">
        <div class="home-profile-left">
          <div class="home-avatar"><div class="avatar-placeholder">👤</div></div>
          <div class="home-user-text">
            <div class="home-username">Guest</div>
            <div class="home-gpoint">0 G-Point</div>
          </div>
        </div>
        <div class="home-profile-right">
          <div class="leaderboard-btn"><i class="fa-solid fa-crown"></i><span>Leaderboard</span></div>
          <div class="championclub-btn"><i class="fa-solid fa-trophy"></i><span>Champion Club</span></div>
        </div>
      </div>
      <div class="home-progress-group guest-progress-group"><div class="daily-card guest-protected-card">
        <div class="daily-header"><div class="daily-title">Check-In Harian</div><div class="daily-info">Informasi Check-In</div></div>
        <div class="daily-days">
          ${rewardMatrix.map((reward,index)=>`<div class="daily-box guest-checkin-box" role="button" tabindex="0" onclick="openGuestCheckinAccess()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openGuestCheckinAccess();}"><div class="daily-day">Hari ${index+1}</div><div class="daily-reward">🪙 +${reward}</div></div>`).join("")}
        </div>
        <div class="daily-status guest-checkin-box" role="button" tabindex="0" onclick="openGuestCheckinAccess()">Scan kartu Anda untuk check-in hari ini</div>
      </div>
      <div class="verified-progress-card guest-protected-card" role="button" tabindex="0" onclick="openGuestCheckinAccess()">
        <div class="verified-title">Progress Verified (Bulan Ini)</div>
        <div class="verified-row"><div>Kehadiran bulan ini</div><div>0 / 2</div></div>
        <div class="verified-bar"><div class="verified-fill" style="width:0%"></div></div>
        <div class="verified-row"><div>Kontribusi bulan ini</div><div>Rp 0 / Rp 250.000</div></div>
        <div class="verified-bar"><div class="verified-fill gold" style="width:0%"></div></div>
      </div></div>
      ${await renderActivitySummaryCard()}
    </div>
    <div id="guestCheckinAccessOverlay" class="member-access-overlay" onclick="if(event.target===this)closeGuestCheckinAccess()">
      <div class="member-access-card" role="dialog" aria-modal="true" aria-labelledby="guestCheckinAccessTitle">
        <button class="member-access-close" type="button" aria-label="Tutup" onclick="closeGuestCheckinAccess()">×</button>
        <div class="member-access-icon">🔒</div><h2 class="member-access-title" id="guestCheckinAccessTitle">Akses Khusus Member</h2>
        <div class="member-access-actions">
          <div class="member-access-option"><button type="button" class="member-access-register" onclick="closeGuestCheckinAccess();window.navigate('account');setTimeout(()=>document.getElementById('registerBtn')?.click(),150)">Daftar</button><p>Belum jadi anggota? Klik daftar</p></div>
          <div class="member-access-option"><button type="button" class="member-access-login" onclick="closeGuestCheckinAccess();window.navigate('account');setTimeout(()=>document.getElementById('loginBtn')?.click(),150)">Masuk</button><p>Sudah punya akun? Klik masuk</p></div>
        </div>
      </div>
    </div>
  `;
  renderWelcomeMascot(true);
  document.querySelector(".leaderboard-btn")?.addEventListener("click",()=>window.navigate?.("leaderboard"));
  document.querySelector(".championclub-btn")?.addEventListener("click",()=>window.navigate?.("championClub"));
}
window.openGuestCheckinAccess = function(){document.getElementById("guestCheckinAccessOverlay")?.classList.add("show");};
window.closeGuestCheckinAccess = function(){document.getElementById("guestCheckinAccessOverlay")?.classList.remove("show");};

async function renderActivitySummaryCard(){
  let d = null;
  let readFailed = false;
  try{
    const snap = await getDoc(doc(db,"websiteStats","ActivitySummary"));
    d = snap.exists() ? snap.data() : null;
  }catch(error){
    console.error("Activity Summary read failed:",error);
    readFailed = true;
  }

  const fmt = n => Number(n || 0).toLocaleString("id-ID");
  const value = (key, suffix = "") => d ? `${fmt(d[key])}${suffix}` : "—";
  const updated = d?.generatedDateWita ? `${d.generatedDateWita} (WITA)` : "Belum diperbarui";

  return `
    <button type="button" onclick="openActivitySummaryModal()" aria-haspopup="dialog" style="
      width:100%;text-align:left;background:#fff;border:1px solid #e8eee7;
      border-radius:18px;padding:18px;margin:18px 0;box-shadow:0 8px 24px #0000000d;
      cursor:pointer;color:#355742;display:block;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7b8c78;margin-bottom:5px;">Community Statistics</div>
          <div style="font-size:18px;font-weight:800;color:#2E5D3A;">GMTC Activity Summary</div>
          <div style="font-size:12px;color:#71816f;margin-top:5px;">${d ? "Lihat statistik aktivitas komunitas" : "Statistik belum diperbarui"}</div>
        </div>
        <span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;flex-shrink:0;border-radius:50%;background:#edf4ec;color:#2E5D3A;font-size:22px;">›</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px;">
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Sessions Hosted</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("sessionsHosted")}</div>
        </div>
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Player Attendances</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("playerAttendances")}</div>
        </div>
        <div style="background:#f7f8f4;border-radius:12px;padding:10px 8px;">
          <div style="font-size:10px;color:#7b8c78;line-height:1.4;">Court Hours</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">${value("courtHoursPlayed"," jam")}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#879184;margin-top:12px;">Terakhir diperbarui: ${updated} <span style="float:right;color:#2E5D3A;font-weight:700;">Lihat detail ↗</span></div>
    </button>

    <div id="activitySummaryModal" role="dialog" aria-modal="true" aria-labelledby="activitySummaryModalTitle" style="
      display:none;position:fixed;inset:0;z-index:9999;background:rgba(18,34,22,.58);
      padding:18px;align-items:center;justify-content:center;box-sizing:border-box;
    " onclick="if(event.target===this)closeActivitySummaryModal()">
      <section style="width:100%;max-width:460px;max-height:85vh;overflow:auto;background:#fff;border-radius:22px;padding:22px;box-sizing:border-box;box-shadow:0 20px 60px #00000030;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px;">
          <div>
            <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#879184;">GMTC Community</div>
            <h2 id="activitySummaryModalTitle" style="margin:5px 0 0;color:#2E5D3A;font-size:22px;">Activity Summary</h2>
            <p style="font-size:12px;color:#71816f;margin:6px 0 0;">Ringkasan aktivitas komunitas</p>
          </div>
          <button type="button" onclick="closeActivitySummaryModal()" aria-label="Tutup" style="border:0;background:#f1f4ef;color:#355742;width:36px;height:36px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;">×</button>
        </div>
        ${readFailed ? '<p style="padding:14px;background:#fff6f0;border-radius:12px;color:#9a4b20;font-size:13px;">Ringkasan tidak dapat dimuat saat ini.</p>' : !d ? '<p style="padding:14px;background:#f7f8f4;border-radius:12px;color:#71816f;font-size:13px;">Belum ada data statistik. Ringkasan akan tampil setelah admin menjalankan Refresh Statistic.</p>' : `
          <div style="display:grid;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Sessions Hosted</span><strong style="font-size:22px;color:#2E5D3A;">${value("sessionsHosted")}</strong></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Player Attendances</span><strong style="font-size:22px;color:#2E5D3A;">${value("playerAttendances")}</strong></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;background:#f7f8f4;border-radius:14px;"><span style="font-size:13px;color:#526653;">Court Hours Played</span><strong style="font-size:22px;color:#2E5D3A;">${value("courtHoursPlayed"," jam")}</strong></div>
          </div>
          <p style="font-size:11px;color:#879184;margin:16px 0 0;">Terakhir diperbarui: ${updated}</p>
        `}
        <button type="button" onclick="closeActivitySummaryModal()" style="width:100%;margin-top:20px;padding:13px;border:0;border-radius:12px;background:#2E5D3A;color:#fff;font-weight:700;cursor:pointer;">Tutup</button>
      </section>
    </div>
  `;
}

window.openActivitySummaryModal = function(){
  const modal = document.getElementById("activitySummaryModal");
  if(!modal) return;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

window.closeActivitySummaryModal = function(){
  const modal = document.getElementById("activitySummaryModal");
  if(modal) modal.style.display = "none";
  document.body.style.overflow = "";
};

/* =========================================
   COUNTDOWN ENGINE
========================================= */
let countdownInterval = null;

function startResetCountdown(){

  if(countdownInterval){
    clearInterval(countdownInterval);
  }

  function update(){

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setHours(24,0,0,0);

    const diff = tomorrow - now;

    const hours = String(Math.floor(diff / (1000*60*60))).padStart(2,"0");
    const minutes = String(Math.floor((diff % (1000*60*60)) / (1000*60))).padStart(2,"0");
    const seconds = String(Math.floor((diff % (1000*60)) / 1000)).padStart(2,"0");

    const el = document.getElementById("resetTimer");
    if(el){
      el.textContent = `${hours}:${minutes}:${seconds}`;
    }
  }

  update();
  countdownInterval = setInterval(update,1000);
}

function renderVerifiedProgress(userData){

  const data = getVerifiedProgress(userData);
  if(!data) return "";

  // ✅ SAFE + CLAMP
  const attPercent = Math.min(
    data.attendance.max > 0
      ? (data.attendance.value / data.attendance.max) * 100
      : 0,
    100
  );

  const finPercent = Math.min(
    data.financial.max > 0
      ? (data.financial.value / data.financial.max) * 100
      : 0,
    100
  );

  const attendanceDone = data.attendance.value >= data.attendance.max;
  const financialDone = data.financial.value >= data.financial.max;

  return `
    <div class="verified-progress-card">

      <div class="verified-title">
        Progress Verified (Bulan Ini)
      </div>

      <!-- ATTENDANCE -->
      <div class="verified-row">
        <div>Kehadiran bulan ini (tanpa voucher)</div>
        <div>
          ${data.attendance.value} / ${data.attendance.max}
          ${attendanceDone ? '<span class="verified-check">✔</span>' : ''}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill ${attendanceDone ? 'full' : ''}"
             style="width:${attPercent}%">
        </div>
      </div>

      <!-- FINANCIAL -->
      <div class="verified-row">
        <div>Kontribusi bulan ini</div>
        <div>
          ${formatRupiah(data.financial.value)} /
          ${formatRupiah(data.financial.max)}
          ${financialDone ? '<span class="verified-check">✔</span>' : ''}
        </div>
      </div>

      <div class="verified-bar">
        <div class="verified-fill ${
          financialDone ? 'full' : 'gold'
        }"
             style="width:${finPercent}%">
        </div>
      </div>

    </div>
  `;
}


function formatRupiah(num){
  return "Rp " + (num || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g,".");
}

window.openDailyScan = function(day){

  if(dailyLock) return;
  dailyLock = true;

  window.location.href = `scanDaily.html?day=${day}`;
};
