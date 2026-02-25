import { db, auth } from "./firebase.js";
import { doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================
   CORE PIN VALIDATION
===================================================== */
async function validatePin(inputPin){

  if(!auth.currentUser){
    return { valid:false, reason:"Not logged in" };
  }

  if(!inputPin || inputPin.length !== 6){
    return { valid:false, reason:"PIN tidak valid" };
  }

  try {

    const userRef = doc(db,"users",auth.currentUser.uid);
    const snap = await getDoc(userRef);

    if(!snap.exists()){
      return { valid:false, reason:"User tidak ditemukan" };
    }

    const userData = snap.data();

    if(inputPin !== userData.pinTrx){
      return { valid:false, reason:"PIN salah" };
    }

    return { valid:true };

  } catch(error){
    console.error("PIN validation error:", error);
    return { valid:false, reason:"Validation error" };
  }
}

/* =====================================================
   OPEN PIN SHEET UI
===================================================== */
window.openPinSheet = function({ onSuccess }){

  const containerId = "pinSheetContainer";

  let container = document.getElementById(containerId);
  if(!container){
    container = document.createElement("div");
    container.id = containerId;
    document.body.appendChild(container);
  }

  container.innerHTML = `
    <div class="pin-overlay"></div>
    <div class="pin-sheet">
      <div class="pin-title">Masukkan PIN Transaksi</div>
      <div class="pin-display" id="pinDisplay"></div>

      <div class="pin-keypad">
        ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(n=>`
          <button class="pin-key">${n}</button>
        `).join("")}
      </div>
    </div>
  `;

  let input = "";
  const display = document.getElementById("pinDisplay");

  const keys = container.querySelectorAll(".pin-key");

  keys.forEach(key=>{
    key.onclick = async ()=>{

      const value = key.innerText;

      if(value === "⌫"){
        input = input.slice(0,-1);
      } else if(value !== ""){
        if(input.length >= 6) return;
        input += value;
      }

      display.innerText = "•".repeat(input.length);

      if(input.length === 6){

        const result = await validatePin(input);

        if(result.valid){
          container.innerHTML = "";
          if(typeof onSuccess === "function"){
            onSuccess();
          }
        } else {
          input = "";
          display.innerText = "";
          alert(result.reason);
        }

      }

    };
  });

  container.querySelector(".pin-overlay").onclick = ()=>{
    container.innerHTML = "";
  };

};
