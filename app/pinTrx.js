import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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


