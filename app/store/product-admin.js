import { db } from "../firebase.js";

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let editModeId = null;


/* ===============================
   RENDER PRODUCT ADMIN
================================= */

export async function renderProductAdmin(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `

  <div class="store-page">

    <h2>Store Products Admin</h2>

    <div class="store-card">

      <div class="card-body">

        <input id="productName"
               placeholder="Product Name">

        <input id="productImage"
               placeholder="Image filename (jersey.webp)">

        <input id="productCategory"
               placeholder="Category (apparel / accessories)">

        <input id="productNormalPrice"
               type="number"
               placeholder="Normal Price">

        <input id="productDiscountPrice"
               type="number"
               placeholder="Discount Price (optional)">

        <label>Available Size?</label>

        <select id="sizeEnabled">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>

        <div id="sizeInputs" style="display:none;">

          <label>Size Stock</label>

          ${renderSizeInputs()}

        </div>

        <div id="noSizeStock">

          <input id="productStock"
                 type="number"
                 placeholder="Stock">

        </div>

        <button class="btn-primary"
                id="saveProductBtn">
          Save Product
        </button>

      </div>

    </div>

    <h3 style="margin-top:20px;">
      Existing Products
    </h3>

    <div id="productList"></div>

  </div>
  `;

  const sizeSelect = document.getElementById("sizeEnabled");

  sizeSelect.onchange = ()=>{

    const enabled = sizeSelect.value === "yes";

    document.getElementById("sizeInputs").style.display =
      enabled ? "block" : "none";

    document.getElementById("noSizeStock").style.display =
      enabled ? "none" : "block";

  };

  document
    .getElementById("saveProductBtn")
    .onclick = saveProduct;

  loadProductList();

}


/* ===============================
   SIZE INPUT GENERATOR
================================= */

function renderSizeInputs(){

  const sizes = [
    "SS","S","SM","M","MM",
    "L","LL","LLL",
    "XL","XXL","XXXL"
  ];

  return sizes.map(s=>`
    <input type="number"
           id="size_${s}"
           placeholder="${s} qty"
           style="margin-bottom:6px;">
  `).join("");

}


/* ===============================
   AUTO ID
================================= */

function generateProductId(name){

  return (
    "product_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"_")
      .slice(0,25) +
    "_" +
    Date.now()
  );

}


/* ===============================
   SAVE PRODUCT
================================= */

async function saveProduct(){

  const name =
    document.getElementById("productName").value.trim();

  const image =
    document.getElementById("productImage").value.trim();

  const category =
    document.getElementById("productCategory").value.trim();

  const normalPrice =
    Number(document.getElementById("productNormalPrice").value);

  const discountPrice =
    Number(document.getElementById("productDiscountPrice").value);

  const sizeEnabled =
    document.getElementById("sizeEnabled").value === "yes";

  if(!name){
    alert("Product name wajib diisi");
    return;
  }

  let sizes = null;
  let stock = null;

  if(sizeEnabled){

    sizes = {};

    const sizeList = [
      "SS","S","SM","M","MM",
      "L","LL","LLL",
      "XL","XXL","XXXL"
    ];

    sizeList.forEach(s=>{

      const val =
        Number(document.getElementById("size_"+s).value);

      if(val>0){
        sizes[s] = val;
      }

    });

  }else{

    stock =
      Number(document.getElementById("productStock").value);

  }

  const payload = {

    name,
    image,
    category,

    normalPrice,
    discountPrice: discountPrice || null,

    sizeEnabled,
    sizes,
    stock,

    active:true,

    updatedAt:Timestamp.now()

  };

  if(editModeId){

    await updateDoc(
      doc(db,"products",editModeId),
      payload
    );

    alert("Product updated");

  }else{

    const newId = generateProductId(name);

    await setDoc(
      doc(db,"products",newId),
      {
        ...payload,
        id:newId,
        createdAt:Timestamp.now()
      }
    );

    alert("Product created");

  }

  editModeId = null;

  renderProductAdmin();

}


/* ===============================
   LOAD PRODUCT LIST
================================= */

async function loadProductList(){

  const container =
    document.getElementById("productList");

  container.innerHTML = "";

  const snap =
    await getDocs(collection(db,"products"));

  if(snap.empty){

    container.innerHTML =
      "<div style='opacity:.6'>Belum ada product.</div>";

    return;

  }

  snap.forEach(docSnap=>{

    const d = docSnap.data();

    container.innerHTML += `

      <div class="store-card">

        <div class="card-body">

          <strong>${d.name}</strong><br>

          Price: ${d.discountPrice || d.normalPrice}<br>

          Active: ${d.active}

          <div style="margin-top:10px;">

            <button onclick="toggleProduct('${docSnap.id}',${d.active})">
              ${d.active ? "Deactivate" : "Activate"}
            </button>

            <button onclick="editProduct('${docSnap.id}')">
              Edit
            </button>

            <button onclick="deleteProduct('${docSnap.id}')">
              Delete
            </button>

          </div>

        </div>

      </div>

    `;

  });

}


/* ===============================
   EDIT PRODUCT
================================= */

window.editProduct = async function(id){

  const snap =
    await getDoc(doc(db,"products",id));

  if(!snap.exists()) return;

  const d = snap.data();

  editModeId = id;

  document.getElementById("productName").value =
    d.name || "";

  document.getElementById("productImage").value =
    d.image || "";

  document.getElementById("productCategory").value =
    d.category || "";

  document.getElementById("productNormalPrice").value =
    d.normalPrice || 0;

  document.getElementById("productDiscountPrice").value =
    d.discountPrice || 0;

};


/* ===============================
   TOGGLE PRODUCT
================================= */

window.toggleProduct = async function(id,current){

  await updateDoc(
    doc(db,"products",id),
    {
      active:!current
    }
  );

  renderProductAdmin();

};


/* ===============================
   DELETE PRODUCT
================================= */

window.deleteProduct = async function(id){

  if(!confirm("Delete product ini?")) return;

  await deleteDoc(doc(db,"products",id));

  renderProductAdmin();

};
