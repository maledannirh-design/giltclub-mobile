import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =====================================================
   REQUEST TRANSACTION PIN (BOTTOM SHEET)
===================================================== */
export function requestTransactionPin() {

  return new Promise((resolve) => {

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

        <div style="
          text-align:center;
          font-weight:bold;
          margin-bottom:10px;
        ">
          Masukkan PIN Transaksi
        </div>

        <div id="pinDisplay" style="
          text-align:center;
          font-size:28px;
          letter-spacing:10px;
          margin:15px 0;
        ">○ ○ ○ ○ ○ ○</div>

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

    // 1-9
    for (let i = 1; i <= 9; i++) {

      pinPad.appendChild(
        createButton(i, () => {

          if (pin.length >= 6) return;

          pin += i;

          renderDots();

          if (pin.length === 6) {
            closePin(pin);
          }

        })
      );
    }

    // Backspace
    pinPad.appendChild(
      createButton("⌫", () => {

        pin = pin.slice(0, -1);

        renderDots();

      })
    );

    // 0
    pinPad.appendChild(
      createButton("0", () => {

        if (pin.length >= 6) return;

        pin += "0";

        renderDots();

        if (pin.length === 6) {
          closePin(pin);
        }

      })
    );

    // Cancel
    pinPad.appendChild(
      createButton("Batal", () => {

        closePin(null);

      })
    );

    renderDots();
  });
}



/* =====================================================
   VALIDATE TRANSACTION PIN (DATABASE CHECK)
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

    // 🔒 akun terkunci
    if (lockedUntil && now < lockedUntil) {

      const remaining = Math.ceil((lockedUntil - now) / 1000);

      return {
        valid: false,
        reason: `PIN terkunci. Coba lagi ${remaining} detik`
      };
    }

    const storedPin = userData.pinTrx;

    if (storedPin !== enteredPin) {

      const currentAttempt = userData.pinAttempt || 0;
      const newAttempt = currentAttempt + 1;

      // lock 5 menit setelah 3x gagal
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

    // reset attempt jika benar
    await updateDoc(userRef, {
      pinAttempt: 0,
      pinLockedUntil: 0
    });

    return { valid: true };

  } catch (error) {

    console.error("PIN validation error:", error);

    return {
      valid: false,
      reason: "Gagal validasi PIN"
    };
  }
}

