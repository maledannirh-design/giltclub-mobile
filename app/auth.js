import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { doc, setDoc } from "./firestore.js";
import { showToast } from "./ui.js";


export async function register(email, pinLogin, pinTrx, username) {

  if(pinLogin.length !== 4 || !/^\d+$/.test(pinLogin)){
    throw new Error("PIN login harus 4 digit angka");
  }

  if(pinTrx.length !== 6 || !/^\d+$/.test(pinTrx)){
    throw new Error("PIN transaksi harus 6 digit angka");
  }

  // Firebase tetap butuh password → kita pakai PIN login
  const userCredential =
    await createUserWithEmailAndPassword(auth, email, pinLogin);

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {

    name: username,
    username: username.toLowerCase(),

    role: "member",
    coachApproved: false,
    coachLevel: null,

    verifiedApproved: false,
    verifiedEligible: false,

    monthlyContribution: 0,
    attendanceCount: 0,

    membership: "MEMBER",

    level: 1,
    points: 0,
    wins: 0,
    matches: 0,

    followersCount: 0,
    followingCount: 0,

    isPublic: true,

    pinTrx,              // simpan PIN transaksi
    createdAt: new Date()

  });

  showToast("Pendaftaran berhasil", "success");
}


export async function login(email, pinLogin) {

  if(pinLogin.length !== 4){
    throw new Error("PIN login tidak valid");
  }

  await signInWithEmailAndPassword(auth, email, pinLogin);

  showToast("Login berhasil", "success");
}


export function logout() {
  return signOut(auth);
}
