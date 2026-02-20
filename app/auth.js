import { auth, db } from "./firebase.js";
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getDocs 
} from "./firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showToast } from "./ui.js";
import { navigate } from "./navigation.js";

/* ================= REGISTER ================= */

export async function register(email, pinLogin, pinTrx, username){

  if(!/^\d{4}$/.test(pinLogin)){
    throw new Error("PIN Login harus 4 digit angka");
  }

  if(!/^\d{6}$/.test(pinTrx)){
    throw new Error("PIN Transaksi harus 6 digit angka");
  }

  const cleanUsername = username.toLowerCase();

  // ==============================
  // CEK USERNAME UNIK
  // ==============================
  const q = query(
    collection(db, "users"),
    where("username", "==", cleanUsername)
  );

  const snap = await getDocs(q);

  if(!snap.empty){
    throw new Error("Username sudah digunakan");
  }

  // ==============================
  // BUAT USER AUTH
  // ==============================
  const userCredential =
    await createUserWithEmailAndPassword(auth, email, pinLogin);

  const user = userCredential.user;

  // ==============================
  // SIMPAN DATA PROFILE
  // ==============================
  await setDoc(doc(db, "users", user.uid), {

    name: username,
    username: cleanUsername,

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

  showToast("Akun berhasil dibuat", "success");
  navigate("home");
  
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

// ================= BUTTON HANDLER =================

document.addEventListener("click", async (e) => {

  // REGISTER
  if(e.target.id === "submitRegister"){

    try{

      const sheet = document.getElementById("loginSheet");
      const inputs = sheet.querySelectorAll("input, select");

      const fullName   = inputs[0].value.trim();
      const username   = inputs[1].value.trim();
      const birthPlace = inputs[2].value.trim();
      const birthDate  = inputs[3].value;
      const country    = inputs[4].value;
      const phone      = inputs[5].value.trim();
      const email      = inputs[6].value.trim();
      const pinLogin   = inputs[7].value.trim();
      const pinTrx     = inputs[8].value.trim();
      const terms      = inputs[9].checked;

      if(!terms){
        throw new Error("Setujui syarat & ketentuan");
      }

      await register(email, pinLogin, pinTrx, username);

    }catch(err){
      showToast(err.message, "error");
    }

  }

  // LOGIN
  if(e.target.id === "submitLogin"){

    try{

      const sheet = document.getElementById("loginSheet");
      const inputs = sheet.querySelectorAll("input");

      const email    = inputs[0].value.trim();
      const pinLogin = inputs[1].value.trim();

      await login(email, pinLogin);

      const sheetEl = document.getElementById("loginSheet");
      const overlay = document.querySelector(".sheet-overlay");

      sheetEl.classList.remove("active");
      overlay.classList.remove("active");

    }catch(err){
      showToast(err.message, "error");
    }

  }

});
