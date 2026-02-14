function navigate(page, btn){

  // ===== Active Button =====
  document.querySelectorAll(".nav-btn")
    .forEach(b => b.classList.remove("active"));

  if(btn){
    btn.classList.add("active");
  }

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
      content.innerHTML = `
        <h2>GILT Store</h2>

        <div class="product-grid">

          <div class="product-card">
            <img src="images/products/grip.webp" alt="Grip">
            <h4>Pinky Grip</h4>
            <p>Rp 25.000</p>
          </div>

          <div class="product-card">
            <img src="images/products/visor.webp" alt="Visor">
            <h4>GILT Visor Hat - Premium Black</h4>
            <p>Rp 85.000</p>
          </div>

          <div class="product-card">
            <img src="images/products/jersey.webp" alt="Jersey">
            <h4>Official GILT Jersey</h4>
            <p>Rp 956.000</p>
          </div>

        </div>
      `;
      break;


    case "profile":
      content.innerHTML = `
        <div style="text-align:center">
          <img src="images/default_profile.webp"
               style="width:90px;height:90px;border-radius:50%;object-fit:cover;">
          <h3 style="margin-top:12px">Member Name</h3>
          <p style="color:#64748b">member@email.com</p>
        </div>
      `;
      break;


    case "settings":
      content.innerHTML = `
        <h2>Settings</h2>
        <p style="margin-top:10px;color:#64748b">
          Account & preferences.
        </p>
      `;
      break;

  }
}


function openSettings(){
  navigate("settings");
}

document.addEventListener("DOMContentLoaded", ()=>{
  navigate("home");
});

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

const PRODUCTS = [
  {
    id:"FNBF001",
    name:"Keripik Pisang",
    base_price:25000,
    image:"images/products/visorhat_black_giltlogo",
    stock:3,
    discount:0
  },
  {
    id:"VISOR001",
    name:"GILT Visor Black berlogo GILT",
    base_price:85000,
    image:"images/products/visorhat_black_giltlogo",
    stock:5,
    discount:15
  },
  {
    id:"FNBF002",
    name:"Keripik Singkong",
    base_price:25000,
    image:"images/products/keripik_singkong",
    stock:3,
    discount:0
  },
  {
    id:"JERSEY001",
    name:"Official Jersey Club GILT - ROK",
    base_price:956000,
    image:"images/products/jersey_club1",
    stock:2,
    discount:20
  }
];

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


