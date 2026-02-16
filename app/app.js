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
          Schedule & reserve your court.
        </p>
      `;
      break;

    case "wallet":
      content.innerHTML = `
        <h2>Wallet</h2>
        <p style="margin-top:10px;color:#64748b">
          Manage your balance & transactions.
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

document.addEventListener("DOMContentLoaded", ()=>{
  navigate("home", document.querySelector(".nav-btn"));
});

/* ===============================
   CHAT
=================================*/

function openChat(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Member Chat</h2>

    <div class="chat-box">
      <div class="chat-message other">
        <span>Lisa:</span> Main besok jam 7?
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

  if(!user){
    content.innerHTML = `
      <div style="text-align:center;margin-top:40px">
        <img src="images/default_profile.webp"
             style="width:90px;height:90px;border-radius:50%;">
        <h3 style="margin-top:12px">Guest</h3>

        <button onclick="goLogin()" style="margin-top:20px;width:100%">
          Masuk Akun
        </button>

        <button onclick="goRegister()" 
                style="margin-top:10px;width:100%;background:#64748b">
          Daftar Akun
        </button>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div style="text-align:center">
      <img src="images/default_profile.webp"
           style="width:90px;height:90px;border-radius:50%;">
      <h3 style="margin-top:12px">${user.name}</h3>
      <p style="color:#64748b">${user.membership}</p>
    </div>

    <div style="margin-top:25px">

      ${profileMenuItem("Akun Saya","renderAccountMenu()")}
      ${profileMenuItem("Informasi Pribadi","renderPersonalInfo()")}
      ${profileMenuItem("Verifikasi Informasi","renderVerificationMenu()")}
      ${profileMenuItem("Pengaturan Privasi","renderPrivacyMenu()")}

      <div onclick="logout()" 
           style="margin-top:25px;color:#ef4444;font-weight:600;cursor:pointer">
        Log Out
      </div>

    </div>
  `;
}
function profileMenuItem(title, action){
  return `
    <div onclick="${action}"
         style="
          padding:14px;
          border-bottom:1px solid #e2e8f0;
          display:flex;
          justify-content:space-between;
          cursor:pointer">
      <span>${title}</span>
      <span>></span>
    </div>
  `;
}
function renderAccountMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Akun Saya</h2>

    ${profileMenuItem("Keamanan & Akun","renderSecurityMenu()")}
  `;
}
function renderSecurityMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Keamanan & Akun</h2>

    ${profileMenuItem("Ganti PIN Login (4 digit)","")}
    ${profileMenuItem("Ganti PIN Transaksi (6 digit)","")}
    ${profileMenuItem("Ganti Username","")}
    ${profileMenuItem("Ajukan Penghapusan Akun","")}
  `;
}
function renderPersonalInfo(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Informasi Pribadi</h2>

    ${profileMenuItem("Ganti Nomor HP","")}
    ${profileMenuItem("Ganti Email","")}

    <h3 style="margin-top:20px">Akun Media Sosial</h3>

    ${profileMenuItem("Hubungkan Facebook","")}
    ${profileMenuItem("Hubungkan Instagram","")}
    ${profileMenuItem("Hubungkan TikTok","")}
  `;
}
function renderVerificationMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Verifikasi Informasi</h2>

    ${profileMenuItem("Verifikasi Sidik Jari","")}
    ${profileMenuItem("Login Cepat","")}
    ${profileMenuItem("Alamat Saya","renderAddressMenu()")}
    ${profileMenuItem("Kartu / Rekening Bank","")}
    ${profileMenuItem("Isi Alamat Dana","")}
    ${profileMenuItem("Isi Nomor Rekening","")}
  `;
}
function renderAddressMenu(){
  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Alamat Saya</h2>

    ${profileMenuItem("Isi Alamat Toko","")}
    ${profileMenuItem("Isi Alamat Rumah","")}
  `;
}
function renderPrivacyMenu(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Pengaturan Privasi</h2>

    ${profileMenuItem("Kelihatan Online","")}
    ${profileMenuItem("Daftar Blokir","")}
    ${profileMenuItem("Daftar Teman","")}
  `;
}
function goLogin(){
  alert("Halaman login nanti sambung ke Excel backend");
}

function goRegister(){
  alert("Halaman register nanti sambung ke Excel backend");
}

function logout(){
  localStorage.removeItem("guser");
  renderProfile();
}
