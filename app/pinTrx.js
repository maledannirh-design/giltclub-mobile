import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================
   REQUEST TRANSACTION PIN (MODAL SIMPLE VERSION)
===================================================== */
export function requestTransactionPin(){

  return new Promise((resolve)=>{

    // Hindari double modal
    if(document.getElementById("trxPinModal")){
      resolve(null);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "trxPinModal";

    wrapper.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.6);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
      ">
        <div style="
          background:#1e293b;
          padding:24px;
          border-radius:16px;
          width:280px;
          text-align:center;
          color:white;
        ">
          <h3 style="margin-bottom:15px;">
            Masukkan PIN Transaksi
          </h3>

          <input 
            type="password"
            id="trxPinInput"
            maxlength="6"
            style="
              width:100%;
              padding:10px;
              font-size:18px;
              text-align:center;
              letter-spacing:6px;
              border-radius:10px;
              border:none;
              margin-bottom:15px;
            "
            placeholder="••••••"
          />

          <div style="display:flex;gap:10px;">
            <button id="trxPinCancel"
              style="
                flex:1;
                padding:8px;
                border:none;
                border-radius:10px;
                background:#475569;
                color:white;
              ">
              Batal
            </button>

            <button id="trxPinSubmit"
              style="
                flex:1;
                padding:8px;
                border:none;
                border-radius:10px;
                background:#22c55e;
                color:black;
                font-weight:bold;
              ">
              OK
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const input = document.getElementById("trxPinInput");
    input.focus();

    document.getElementById("trxPinCancel").onclick = ()=>{
      wrapper.remove();
      resolve(null);
    };

    document.getElementById("trxPinSubmit").onclick = ()=>{
      const pin = input.value.trim();
      wrapper.remove();
      resolve(pin);
    };

  });
}


/* =====================================================
   VALIDATE TRANSACTION PIN (6 DIGIT)
===================================================== */
export async function validateTransactionPin(uid, enteredPin) {

  if (!uid) {
    return { valid: false, reason: "User tidak valid" };
  }

  if (!enteredPin || enteredPin.length !== 6) {
    return { valid: false, reason: "PIN harus 6 digit" };
  }

  try {

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { valid: false, reason: "User tidak ditemukan" };
    }

    const userData = userSnap.data();
    const now = Date.now();

    const lockedUntil = userData.pinLockedUntil || 0;

    // 🔒 Cek apakah sedang terkunci
    if (lockedUntil && now < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - now) / 1000);
      return {
        valid: false,
        reason: `PIN terkunci. Coba lagi ${remaining} detik`
      };
    }

    const storedPin = userData.pinTrx;

    // ❌ PIN SALAH
    if (storedPin !== enteredPin) {

      const currentAttempt = userData.pinAttempt || 0;
      const newAttempt = currentAttempt + 1;

      // Jika 3x salah → lock 5 menit
      if (newAttempt >= 3) {

        const lockTime = now + (5 * 60 * 1000);

        await updateDoc(userRef, {
          pinAttempt: 0,
          pinLockedUntil: lockTime
        });

        return {
          valid: false,
          reason: "PIN salah 3x. Akun terkunci 5 menit"
        };
      }

      await updateDoc(userRef, {
        pinAttempt: newAttempt
      });

      return {
        valid: false,
        reason: "PIN transaksi salah"
      };
    }

    // ✅ PIN BENAR → reset attempt
    await updateDoc(userRef, {
      pinAttempt: 0,
      pinLockedUntil: 0
    });

    return { valid: true };

  } catch (error) {

    console.error("PIN validation error:", error);
    return { valid: false, reason: "Gagal validasi PIN" };
  }
}

/* ===============================
   REQUEST TRANSACTION PIN (6 DIGIT)
================================= */
window.requestTransactionPin = function() {

  return new Promise(async (resolve) => {

    const existing = document.getElementById("pinTxOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "pinTxOverlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.bottom = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "flex-end";

    overlay.innerHTML = `
      <div style="
        width:100%;
        background:#fff;
        border-radius:20px 20px 0 0;
        padding:20px;
        animation: slideUp .2s ease-out;
      ">
        <div style="text-align:center;font-weight:bold;margin-bottom:10px;">
          Masukkan PIN Transaksi
        </div>

        <div id="pinDisplay" style="
          text-align:center;
          font-size:28px;
          letter-spacing:10px;
          margin:15px 0;
        ">● ● ● ● ● ●</div>

        <div id="pinError" style="
          text-align:center;
          color:red;
          font-size:14px;
          height:18px;
        "></div>

        <div id="pinPad" style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:10px;
          margin-top:15px;
        ">
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let pin = "";
    let attempts = 0;
    const maxAttempts = 3;

    const pinDisplay = document.getElementById("pinDisplay");
    const pinError = document.getElementById("pinError");
    const pinPad = document.getElementById("pinPad");

    function renderDots() {
      const dots = Array(6).fill("○");
      for (let i = 0; i < pin.length; i++) {
        dots[i] = "●";
      }
      pinDisplay.innerText = dots.join(" ");
    }

    function closePin(result) {
      overlay.remove();
      resolve(result);
    }

    function createButton(text, onClick) {
      const btn = document.createElement("button");
      btn.innerText = text;
      btn.style.padding = "15px";
      btn.style.fontSize = "18px";
      btn.style.borderRadius = "12px";
      btn.style.border = "1px solid #eee";
      btn.style.background = "#f7f7f7";
      btn.onclick = onClick;
      return btn;
    }

    for (let i = 1; i <= 9; i++) {
      pinPad.appendChild(
        createButton(i, () => {
          if (pin.length >= 6) return;
          pin += i;
          renderDots();
          if (pin.length === 6) verifyPin();
        })
      );
    }

    pinPad.appendChild(
      createButton("⌫", () => {
        pin = pin.slice(0, -1);
        renderDots();
      })
    );

    pinPad.appendChild(
      createButton("0", () => {
        if (pin.length >= 6) return;
        pin += "0";
        renderDots();
        if (pin.length === 6) verifyPin();
      })
    );

    pinPad.appendChild(
      createButton("Batal", () => {
        closePin(null);
      })
    );

    async function verifyPin() {

      const user = auth.currentUser;
      if (!user) {
        closePin(null);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        closePin(null);
        return;
      }

      const userData = snap.data();

      if (userData.pinTrx !== pin) {

        attempts++;
        pinError.innerText = "PIN salah";

        pin = "";
        renderDots();

        if (attempts >= maxAttempts) {
          pinError.innerText = "Terlalu banyak kesalahan";
          setTimeout(() => closePin(null), 1000);
        }

        return;
      }

      closePin(pin);
    }

    renderDots();
  });
};
