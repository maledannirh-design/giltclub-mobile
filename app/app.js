
import { 
  db, 
  ref, 
  set, 
  remove, 
  onDisconnect,
  onValue,
  get
} from "./firebase.js";

/* ===============================
   WEBRTC CLEAN ENGINE
=================================*/

let localStream = null;
let peerConnections = {};
let myUser = null;

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};
;


/* ===============================
   NAVIGATION SYSTEM
=================================*/

function navigate(page, el){

  document.querySelectorAll(".nav-btn")
    .forEach(btn=>btn.classList.remove("active"));

  if(el) el.classList.add("active");

  const content = document.getElementById("content");

  switch(page){

    case "home":
      content.innerHTML = `
        <h2>Welcome to GILT Club</h2>
        <p style="margin-top:10px;color:#64748b">
          Modern tennis community experience.
        </p>
      `;
      break;

    case "booking":
      content.innerHTML = `
        <h2>Booking</h2>
        <p style="margin-top:10px;color:#64748b">
          jadwal mabar dan pemesanan sesi latihan.
        </p>
      `;
      break;

    case "wallet":
      content.innerHTML = `
        <h2>Wallet</h2>
        <p style="margin-top:10px;color:#64748b">
          kelola saldo dan atur transaksimu.
        </p>
      `;
      break;

    case "store":
      renderStore();
      break;

    case "profile":
  renderProfile();
  break;

  }
}

/* ===============================
   CHAT
=================================*/

function openChat(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Member Chat</h2>

    <div class="chat-box">
      <div class="chat-message other">
        <span>Jasmine:</span> Main besok jam 12 siang?
      </div>

      <div class="chat-message me">
        Siap, aku join 🎾
      </div>
    </div>

    <div class="chat-input">
      <input placeholder="Tulis pesan...">
      <button>Kirim</button>
    </div>
  `;
}

/* ===============================
   STORE SYSTEM
=================================*/

const PRODUCTS = [
  {
    id:"FNBF001",
    name:"Keripik Pisang",
    base_price:25000,
    image:"images/products/keripik_pisang.webp",
    stock:3,
    discount:0
  },
  {
    id:"VISOR001",
    name:"GILT Visor Black",
    base_price:85000,
    image:"images/products/visorhat_black_giltlogo.webp",
    stock:5,
    discount:15
  },
   {
    id:"PRFM001",
    name:"Amitrea Perfume",
    base_price:200000,
    image:"images/products/amitrea_perfume.webp",
    stock:5,
    discount:25
  },
  {
    id:"FNBF002",
    name:"Keripik Singkong",
    base_price:25000,
    image:"images/products/keripik_singkong.webp",
    stock:3,
    discount:0
  },
  {
    id:"JERSEY001",
    name:"Official Jersey Club GILT",
    base_price:956000,
    image:"images/products/jersey_club1.webp",
    stock:2,
    discount:20
  }
];

/* ===============================
   MEMBERSHIP PRICING
=================================*/

function getMembership(){
  const user = JSON.parse(localStorage.getItem("guser"));
  return user?.membership || "MEMBER";
}

function calculatePrice(base, discount){

  const membership = getMembership();

  let extraDiscount = 0;

  if(membership==="SQUAD") extraDiscount = 5;
  if(membership==="VVIP") extraDiscount = 10;

  const totalDiscount = discount + extraDiscount;

  return Math.round(base - (base * totalDiscount / 100));
}

/* ===============================
   RENDER STORE GRID
=================================*/

function renderStore(){

  const content = document.getElementById("content");

  let html = `<h2>GILT Store</h2>
              <div class="product-grid">`;

  PRODUCTS.forEach(p=>{

    const finalPrice = calculatePrice(p.base_price, p.discount);
    const totalDiscount = p.discount +
      (getMembership()==="SQUAD" ? 5 :
       getMembership()==="VVIP" ? 10 : 0);

    html += `
      <div class="product-card">

        ${totalDiscount>0 ? 
          `<div class="badge-discount">-${totalDiscount}%</div>` 
          : ""}

        ${p.stock<=0 ?
          `<div class="stock-badge">Habis</div>`
          : ""}

        <img src="${p.image}"
             loading="lazy"
             style="width:100%;border-radius:12px;">

        <h4 style="margin:10px 0 5px 0">${p.name}</h4>

        ${totalDiscount>0 ?
          `<p style="text-decoration:line-through;color:#94a3b8">
             Rp ${p.base_price.toLocaleString("id-ID")}
           </p>`
          : ""
        }

        <p style="font-weight:bold;color:#ef4444">
          Rp ${finalPrice.toLocaleString("id-ID")}
        </p>

        <p style="font-size:12px;color:#64748b">
          Stok: ${p.stock}
        </p>

        <button onclick="addToCart('${p.id}')"
          style="margin-top:8px;">
          Add to Cart
        </button>

      </div>
    `;
  });

  html += `</div>`;

  content.innerHTML = html;
}

/* ===============================
   CART SYSTEM
=================================*/

let CART = [];

function addToCart(productId){

  const product = PRODUCTS.find(p=>p.id===productId);
  if(!product) return;

  if(product.stock<=0){
    alert("Stok habis");
    return;
  }

  const existing = CART.find(c=>c.id===productId);

  if(existing){
    existing.qty++;
  }else{
    CART.push({
      id:product.id,
      name:product.name,
      price:calculatePrice(product.base_price,product.discount),
      qty:1
    });
  }

  alert("Produk ditambahkan ke keranjang");
}

/* ===============================
   PROFILE SYSTEM
=================================*/
function renderProfile(){

  const content = document.getElementById("content");
  const user = JSON.parse(localStorage.getItem("guser"));

  const savedPhoto =
    localStorage.getItem("profilePhoto") ||
    "images/default_profile.webp";

  content.innerHTML = `
    <div style="text-align:center;margin-bottom:15px">

      <img id="profileAvatar"
           src="${savedPhoto}"
           style="width:110px;height:110px;border-radius:50%;object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.15);cursor:pointer"
           onclick="document.getElementById('photoInput').click()">
      <input type="file" id="photoInput" accept="image/*" style="display:none">

      <div style="margin-top:8px;font-size:13px;color:#16a34a;font-weight:600">
        Ganti Foto Profil
      </div>

    </div>

    <div style="display:flex;gap:10px;margin-bottom:15px">
      <button onclick="${user ? 'renderProfile()' : 'goLogin()'}"
        style="flex:1;padding:12px;border-radius:12px;border:none;background:#16a34a;color:white;font-weight:600">
        ${user ? user.name : "Masuk Akun"}
      </button>

      <button onclick="${user ? 'logout()' : 'goRegister()'}"
        style="flex:1;padding:12px;border-radius:12px;border:1px solid #cbd5e1;background:white;font-weight:600">
        ${user ? "Log Out" : "Daftar Akun"}
      </button>
    </div>

    <div style="height:1px;background:#e2e8f0;margin:15px 0"></div>

    <div class="section-title">Pengaturan Akun</div>
    <div class="menu-card">
      ${menuItem("Keamanan & Akun","requireLogin(renderAccountMenu)")}
      ${menuItem("Informasi Pribadi","requireLogin(renderPersonalInfo)")}
      ${menuItem("Verifikasi Informasi","requireLogin(renderVerificationMenu)")}
      ${menuItem("Pengaturan Privasi","requireLogin(renderPrivacyMenu)")}
    </div>
  `;
}

function requireLogin(callback){

  const user = JSON.parse(localStorage.getItem("guser"));

  if(!user){
    alert("Silakan masuk akun terlebih dahulu");
    return;
  }

  callback();
}

function menuItem(title, action){
  return `
    <div class="menu-item" onclick="${action}">
      <span>${title}</span>
      <span>›</span>
    </div>
  `;
}

function renderAccountMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
  ${subHeader("Akun Saya","renderProfile()")}
    <div class="section-title">Keamanan & Akun</div>
    <div class="menu-card">
      ${menuItem("Ganti PIN Login (4 digit)","")}
      ${menuItem("Ganti PIN Transaksi (6 digit)","")}
      ${menuItem("Ganti Username","")}
      ${menuItem("Ajukan Penghapusan Akun","")}
    </div>
  `;
}

function renderSecurityMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
   ${subHeader("Keamanan & Akun","renderProfile()")}
    <div class="section-title">Keamanan & Akun</div>
    <div class="menu-card">
      ${menuItem("Ganti PIN Login (4 digit)","")}
      ${menuItem("Ganti PIN Transaksi (6 digit)","")}
      ${menuItem("Ganti Username","")}
      ${menuItem("Ajukan Penghapusan Akun","")}
    </div>
  `;
}

function renderPersonalInfo(){

  const content = document.getElementById("content");

  content.innerHTML = `
   ${subHeader("Informasi Pribadi","renderProfile()")}
    <div class="section-title">Informasi Kontak</div>
    <div class="menu-card">
      ${menuItem("Ganti Nomor HP","")}
      ${menuItem("Ganti Email","")}
    </div>

    <div class="section-title">Akun Media Sosial</div>
    <div class="menu-card">
      ${menuItem("Hubungkan Facebook","")}
      ${menuItem("Hubungkan Instagram","")}
      ${menuItem("Hubungkan TikTok","")}
    </div>
  `;
}

function renderVerificationMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
     ${subHeader("Verifikasi Informasi","renderProfile()")}
    <div class="section-title">Verifikasi & Keamanan</div>
    <div class="menu-card">
      ${menuItem("Verifikasi Sidik Jari","")}
      ${menuItem("Login Cepat","")}
    </div>

    <div class="section-title">Alamat & Keuangan</div>
    <div class="menu-card">
      ${menuItem("Alamat Saya","renderAddressMenu()")}
      ${menuItem("Kartu / Rekening Bank","")}
      ${menuItem("Isi Alamat Dana","")}
      ${menuItem("Isi Nomor Rekening","")}
    </div>
  `;
}

function renderAddressMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
  ${subHeader("Alamat Saya","renderVerificationMenu()")}
    <div class="section-title">Alamat</div>
    <div class="menu-card">
      ${menuItem("Isi Alamat Toko","")}
      ${menuItem("Isi Alamat Rumah","")}
    </div>
  `;
}

function renderPrivacyMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
  ${subHeader("Pengaturan Privasi","renderProfile()")}
    <div class="section-title">Privasi</div>
    <div class="menu-card">
      ${menuItem("Kelihatan Online","")}
      ${menuItem("Daftar Blokir","")}
      ${menuItem("Daftar Teman","")}
    </div>
  `;
}

function logout(){
  localStorage.removeItem("guser");
  renderProfile();
}

function goLogin(){

  const modal = document.getElementById("modal-overlay");
  modal.style.display = "flex";

  modal.innerHTML = `
    <div class="modal-box">
      <h3>Masuk Akun</h3>

      <input id="login-username" placeholder="Username">
      <input id="login-pin" type="password" maxlength="6" placeholder="PIN">

      <button onclick="submitLogin()">Login</button>

      <button style="background:#334155;margin-top:8px">
        Login dengan QR
      </button>

      <div class="modal-close" onclick="closeModal()">Tutup</div>
    </div>
  `;
}
function goRegister(){

  const modal = document.getElementById("modal-overlay");
  modal.style.display = "flex";

  modal.innerHTML = `
    <div class="modal-box">
      <h3>Daftar Akun</h3>

      <input placeholder="Nama Lengkap">
      <input placeholder="Tempat Lahir">
      <input type="date">
      <input placeholder="Username">
      <input type="password" maxlength="6" placeholder="PIN Baru">
      <input type="email" placeholder="Alamat Email">

      <button onclick="fakeRegister()">Daftar</button>

      <div class="modal-close" onclick="closeModal()">Tutup</div>
    </div>
  `;
}

function closeModal(){
  const modal = document.getElementById("modal-overlay");
  modal.style.display = "none";
  modal.innerHTML = "";
}
function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'u-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function submitLogin(){

  const username = document.getElementById("login-username").value;

  if(!username){
    alert("Masukkan username");
    return;
  }

  const userId = generateId(); // 🔥 pakai ini

  localStorage.setItem("guser", JSON.stringify({
    id: userId,
    name: username,
    membership: "MEMBER"
  }));

  closeModal();
  renderProfile();
}

function fakeRegister(){
  alert("Akun berhasil dibuat (simulasi)");
  closeModal();
}

function subHeader(title, backFunction){
  return `
    <div class="sub-header">
      <div class="sub-back" onclick="${backFunction}">
        ←
      </div>
      <div class="sub-title">${title}</div>
    </div>
  `;
}

function connectToCinemaRoom() {

  const user = JSON.parse(localStorage.getItem("guser"));
  if (!user) {
    alert("Login dulu untuk masuk Cinema");
    return;
  }

  const userRef = ref(db, "cinema/presence/users/" + user.id);

  set(userRef, {
    username: user.name,
    joinedAt: Date.now()
  });

  onDisconnect(userRef).remove();

  console.log("Connected to Cinema:", user.name);
}

function openCinema(){

  connectToCinemaRoom();

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="cinema-container">

      <div class="cinema-video-area">
        <div class="video-placeholder">
          🎬 Live Stage
        </div>
      </div>

      <div class="cinema-host" onclick="takeSeat('host')">
        <div class="seat host-seat" id="seat-host">
          <span class="seat-icon">🎙️</span>
        </div>
      </div>

      <div class="cinema-seats">
        ${[1,2,3,4,5,6,7,8].map(n => `
          <div class="seat" id="seat-seat${n}" onclick="takeSeat('seat${n}')">
            <span class="seat-icon">🪑</span>
          </div>
        `).join("")}
      </div>

    </div>
  `;

  // 🔥 WAJIB di bawah innerHTML
  // 🔥 ROOM LEVEL LISTENERS
  listenSeats();
  if(myUser){
    listenOffers();
    listenAnswers();
    listenCandidates();
  }
}
async function takeSeat(seatName){

  const user = JSON.parse(localStorage.getItem("guser"));
  if(!user){
    alert("Login dulu");
    return;
  }

  myUser = user;

  await startLocalAudio();

  const seatRef = ref(db, "cinema/seats/" + seatName);

  await set(seatRef, {
    userId: user.id,
    username: user.name,
    joinedAt: Date.now()
  });

  console.log("🪑 Duduk di", seatName);
}

function listenSeats(){

  const seatsRef = ref(db, "cinema/seats");

  onValue(seatsRef, snapshot => {

    const data = snapshot.val() || {};

    // reset UI
    document.querySelectorAll(".seat").forEach(seat=>{
      seat.innerHTML = `<span class="seat-icon">🪑</span>`;
      seat.classList.remove("occupied");
    });

    Object.keys(data).forEach(seatName => {

      const seatData = data[seatName];
      const seatEl = document.getElementById("seat-" + seatName);

      if(!seatEl) return;

      seatEl.classList.add("occupied");

      seatEl.innerHTML = `
        <img src="images/default_profile.webp"
             style="width:100%;height:100%;border-radius:50%;object-fit:cover">
      `;

      // 🔥 CONNECT ENGINE
      if(myUser && seatData.userId !== myUser.id){

        if(!peerConnections[seatData.userId]){

          const pc = createPeer(seatData.userId);

          // user yang join terakhir kirim offer
          if(myUser.id > seatData.userId){
            sendOffer(pc, seatData.userId);
          }

        }
      }

    });

  });
}


async function startMic(){

  if(localStream) return; // jangan start dua kali

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  console.log("Mic started");
}

function listenCandidates(){

  const candRef = ref(db,
    "cinema/signaling/candidates/" + myUser.id
  );

  onValue(candRef, snapshot => {

    const candidates = snapshot.val();
    if(!candidates) return;

    for(const senderId in candidates){

      const pc = peerConnections[senderId];
      if(!pc) continue;

      pc.addIceCandidate(
        new RTCIceCandidate(candidates[senderId])
      );
    }

  });
}


function listenOffers(){

  const offersRef = ref(db,
    "cinema/signaling/offers/" + myUser.id
  );

  onValue(offersRef, async snapshot => {

    const offers = snapshot.val();
    if(!offers) return;

    for(const senderId in offers){

      if(peerConnections[senderId]) continue;

      const pc = createPeer(senderId);

      await pc.setRemoteDescription(
        new RTCSessionDescription(offers[senderId])
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerRef = ref(db,
        "cinema/signaling/answers/" +
        senderId + "/" + myUser.id
      );

      await set(answerRef, answer);

      console.log("📡 Answer sent to", senderId);
    }

  });
}

function listenAnswers(){

  const answersRef = ref(db,
    "cinema/signaling/answers/" + myUser.id
  );

  onValue(answersRef, async snapshot => {

    const answers = snapshot.val();
    if(!answers) return;

    for(const senderId in answers){

      const pc = peerConnections[senderId];
      if(!pc) continue;

      if(pc.currentRemoteDescription) continue;

      await pc.setRemoteDescription(
        new RTCSessionDescription(answers[senderId])
      );

      console.log("✅ Connected to", senderId);
    }

  });
}


async function startLocalAudio(){
  if(localStream) return;

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  console.log("🎤 Mic Ready");
}
function createPeer(remoteUserId){

  const pc = new RTCPeerConnection(rtcConfig);

  peerConnections[remoteUserId] = pc;

  // kirim audio kita
  localStream.getTracks().forEach(track=>{
    pc.addTrack(track, localStream);
  });

  // terima audio
  pc.ontrack = event => {

    let audioEl = document.getElementById("audio-" + remoteUserId);

    if(!audioEl){
      audioEl = document.createElement("audio");
      audioEl.id = "audio-" + remoteUserId;
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
    }

    audioEl.srcObject = event.streams[0];
  };

  // kirim ICE
  pc.onicecandidate = event=>{
    if(event.candidate){
      const candRef = ref(db,
        "cinema/signaling/candidates/" +
        remoteUserId + "/" + myUser.id
      );

      set(candRef, event.candidate.toJSON());
    }
  };

  return pc;
}

async function sendOffer(pc, remoteUserId){

  if(pc.signalingState !== "stable") return;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const offerRef = ref(db,
    "cinema/signaling/offers/" +
    remoteUserId + "/" + myUser.id
  );

  await set(offerRef, offer);

  console.log("📡 Offer sent to", remoteUserId);
}



window.navigate = navigate;
window.renderProfile = renderProfile;
window.goLogin = goLogin;
window.goRegister = goRegister;
window.logout = logout;
window.openCinema = openCinema;
window.requireLogin = requireLogin;
window.renderAccountMenu = renderAccountMenu;
window.renderSecurityMenu = renderSecurityMenu;
window.renderPersonalInfo = renderPersonalInfo;
window.renderVerificationMenu = renderVerificationMenu;
window.renderAddressMenu = renderAddressMenu;
window.renderPrivacyMenu = renderPrivacyMenu;
window.closeModal = closeModal;
window.submitLogin = submitLogin;
window.fakeRegister = fakeRegister;
window.openChat = openChat;
window.takeSeat = takeSeat;


document.addEventListener("DOMContentLoaded", function(){

  // 🔹 Default page
  navigate("home", document.querySelector(".nav-btn"));

  // 🔹 Photo upload handler
  const photoInput = document.getElementById("photoInput");

  if(photoInput){
    photoInput.addEventListener("change", function(e){

      const file = e.target.files[0];
      if(!file) return;

      const reader = new FileReader();

      reader.onload = function(event){

        const img = new Image();

        img.onload = function(){

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const size = 300;
          canvas.width = size;
          canvas.height = size;

          ctx.drawImage(img, 0, 0, size, size);

          const compressed = canvas.toDataURL("image/jpeg", 0.7);

          localStorage.setItem("profilePhoto", compressed);

          const avatar = document.getElementById("profileAvatar");
          if(avatar) avatar.src = compressed;
        };

        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    });
  }

});


