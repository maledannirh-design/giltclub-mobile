import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { doc, setDoc, serverTimestamp } from "./firestore.js";
import { showToast } from "./ui.js";

/* ================= REGISTER ================= */

export async function register(email, pinLogin, pinTrx, username){

  if(!/^\d{4}$/.test(pinLogin)){
    throw new Error("PIN Login harus 4 digit angka");
  }

  if(!/^\d{6}$/.test(pinTrx)){
    throw new Error("PIN Transaksi harus 6 digit angka");
  }

  const userCredential =
    await createUserWithEmailAndPassword(auth, email, pinLogin);

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {

    name: username,
    username: username.toLowerCase(),

    role: "member",
    membership: "MEMBER",

    level: 1,
    points: 0,
    wins: 0,
    matches: 0,

    monthlyContribution: 0,
    attendanceCount: 0,

    followersCount: 0,
    followingCount: 0,

    coachApproved: false,
    coachLevel: null,

    verifiedApproved: false,
    verifiedEligible: false,

    isPublic: true,

    pinTrx,
    createdAt: serverTimestamp()

  });

  // AUTO LOGIN SUDAH TERJADI DI SINI

  showToast("Akun berhasil dibuat", "success");

  // Tutup sheet
  const sheet = document.getElementById("loginSheet");
  const overlay = document.querySelector(".sheet-overlay");
  sheet.classList.remove("active");
  overlay.classList.remove("active");

}

/* ================= LOGIN ================= */

export async function login(email, pinLogin){

  if(!/^\d{4}$/.test(pinLogin)){
    throw new Error("PIN tidak valid");
  }

  await signInWithEmailAndPassword(auth, email, pinLogin);

  showToast("Login berhasil", "success");
}

/* ================= LOGOUT ================= */

export function logout(){
  return signOut(auth);
}
