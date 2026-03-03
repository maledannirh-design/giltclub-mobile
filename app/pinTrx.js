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
