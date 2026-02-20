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

  if(!/^\d{6}$/.test(pinLogin)){
    throw new Error("PIN Login harus 6 digit angka");
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
  bio: "",

  role: "member",            // member | admin | supercoach
  membership: "MEMBER",      // MEMBER | VVIP | COACH
  playingLevel: "newbie",

  status: "active",          // active | suspended | deactivated

  followersCount: 0,
  followingCount: 0,

  level: 1,
  points: 0,
  wins: 0,
  matches: 0,

  monthlyContribution: 0,
  attendanceCount: 0,

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

  if(!/^\d{6}$/.test(pinLogin)){
    throw new Error("PIN harus 6 digit");
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

  // ================= REGISTER =================
  if(e.target.id === "submitRegister"){

    try{

      const sheet = document.getElementById("loginSheet");

      const fullName   = sheet.querySelector('input[placeholder="Nama Lengkap"]').value.trim();
      const username   = sheet.querySelector('input[placeholder="Username"]').value.trim();
      const birthPlace = sheet.querySelector('input[placeholder="Tempat Lahir"]').value.trim();
      const birthDate  = sheet.querySelector('input[type="date"]').value;

      // ===== PHONE (2 COLUMN SYSTEM) =====
      const countryCode = document.getElementById("countryCode").value;
      const phoneNumber = document.getElementById("phoneNumber").value.trim();
      const phoneFull   = countryCode + phoneNumber;

      const email    = sheet.querySelector('input[type="email"]').value.trim();
      const pinLogin = sheet.querySelector("#pinLogin").value.replace(/\s/g,'');
const pinTrx   = sheet.querySelector("#pinTrx").value.replace(/\s/g,'');

      const terms = sheet.querySelector('.terms-row input').checked;

      if(!terms){
        throw new Error("Setujui syarat & ketentuan");
      }

      if(!phoneNumber){
        throw new Error("Nomor HP tidak valid");
      }
      await register(email, pinLogin, pinTrx, username);

    }catch(err){
      showToast(err.message, "error");
    }

  }

  // ================= LOGIN =================
  if(e.target.id === "submitLogin"){

    try{

      const sheet = document.getElementById("loginSheet");

     const email = sheet.querySelector('#sheetEmail').value.trim();

const pinLogin = sheet
  .querySelector('#sheetPinLogin')
  .value.replace(/\s/g,'');

      await login(email, pinLogin);

      const sheetEl = document.getElementById("loginSheet");
const overlay = document.querySelector(".sheet-overlay");

if (sheetEl) sheetEl.classList.remove("active");
if (overlay) overlay.classList.remove("active");
// Baru pindah halaman
navigate("home");
      
    }catch(err){
      showToast(err.message, "error");
    }

  }

});
