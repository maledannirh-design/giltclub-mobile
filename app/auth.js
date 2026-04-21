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


let registerLock = false;


/* =========================================
   REGISTER
========================================= */
export async function register(
  email,
  pinLogin,
  pinTrx,
  username,
  fullName,
  phone,
  birthPlace,
  birthDate
){

  if (registerLock) return;
  registerLock = true;

  try {

    if(!/^\d{6}$/.test(pinLogin)){
      throw new Error("PIN Login harus 6 digit angka");
    }

    if(!/^\d{6}$/.test(pinTrx)){
      throw new Error("PIN Transaksi harus 6 digit angka");
    }

    const cleanUsername = username.toLowerCase();

    const q = query(
      collection(db, "users"),
      where("username", "==", cleanUsername)
    );

    const snap = await getDocs(q);

    if(!snap.empty){
      throw new Error("Username sudah digunakan");
    }

    const userCredential =
      await createUserWithEmailAndPassword(auth, email, pinLogin);

    const user = userCredential.user;
    await user.getIdToken();

    await setDoc(doc(db, "users", user.uid), {

      fullName,
      username: cleanUsername,
      email,
      phone,
      birthPlace,
      birthDate,

      bio: "",

      role: "MEMBER",
      membership: "MEMBER",
      playingLevel: "New Player (NTRP 1.0)",

      status: "active",

      followersCount: 0,
      followingCount: 0,

      level: 1,
      points: 0,
      wins: 0,
      matches: 0,

      monthlyContribution: 0,
      attendanceCount: 0,

      coachApproved: false,
      verified: false,

      isPublic: true,

      privacy: {
        showOnlineStatus: false,
        dashboardVisibility: "private",
        showNameInBooking: false,
        chatPermission: "followers"
      },

      pinTrx,
      createdAt: serverTimestamp()

    });

    showToast("Akun berhasil dibuat", "success");

  } finally {
    registerLock = false;
  }
}


/* =========================================
   LOGIN
========================================= */
export async function login(email, pinLogin){

  if(!/^\d{6}$/.test(pinLogin)){
    throw new Error("PIN harus 6 digit");
  }

  await signInWithEmailAndPassword(auth, email, pinLogin);

  showToast("Login berhasil", "success");
}


/* =========================================
   LOGOUT (CLEAN)
========================================= */
export function logout(){
  return signOut(auth);
}

/* =========================================
   BUTTON HANDLER (SAFE VERSION)
========================================= */

document.addEventListener("click", async (e) => {

  // ================= REGISTER =================
  if (e.target.id === "submitRegister") {

    e.preventDefault();

    if (registerLock) return;

    try {

      const sheet = document.getElementById("loginSheet");

      const fullName   = sheet.querySelector("#regFullName").value.trim();
      const username   = sheet.querySelector("#regUsername").value.trim();
      const email      = sheet.querySelector("#regEmail").value.trim();

      const birthPlace = sheet.querySelector("#birthPlace").value.trim();
      const birthDate  = sheet.querySelector("#birthDate").value;

      const countryCode = sheet.querySelector("#countryCode").value;
      const phoneNumber = sheet.querySelector("#phoneNumber").value.trim();
      const phoneFull   = countryCode + phoneNumber;

      const pinLogin = sheet.querySelector("#pinLogin").value.replace(/\s/g,'');
      const pinTrx   = sheet.querySelector("#pinTrx").value.replace(/\s/g,'');

      const terms = sheet.querySelector("#termsCheck").checked;

      if (!terms) {
        throw new Error("Setujui syarat & ketentuan");
      }

      if (!/^8[0-9]{8,12}$/.test(phoneNumber)) {
        throw new Error("Nomor HP tidak valid");
      }

      if (!birthPlace || !birthDate) {
        throw new Error("Lengkapi data kelahiran");
      }

      await register(
        email,
        pinLogin,
        pinTrx,
        username,
        fullName,
        phoneFull,
        birthPlace,
        birthDate
      );

    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // ================= LOGIN =================
  if(e.target.id === "submitLogin"){

    e.preventDefault();

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

      navigate("home");

    }catch(err){
      showToast(err.message, "error");
    }
  }

});
