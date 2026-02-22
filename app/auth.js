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

  role: "MEMBER",            // member | admin | coach | supercoach 
  membership: "MEMBER",      // MEMBER | VVIP
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

  verifiedApproved: false, // VERIFIED/ UNVERIFIED
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
 if(mode === "register"){
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Pendaftaran Member</h3>

    <input id="regFullName" type="text" placeholder="Nama Lengkap">
    <input id="regUsername" type="text" placeholder="Username">
    <input id="regEmail" type="email" placeholder="Email">

    <!-- PHONE 2 COLUMN -->
    <div class="phone-group">
      <select id="countryCode">
        <option value="+62">🇮🇩 +62</option>
        <option value="+60">🇲🇾 +60</option>
        <option value="+65">🇸🇬 +65</option>
      </select>
      <input id="phoneNumber"
        type="tel"
        placeholder="8123456789"
        maxlength="13"
        inputmode="numeric">
    </div>

    <input id="birthPlace" type="text" placeholder="Tempat Lahir">
    <input id="birthDate" type="date">

    <input id="pinLogin"
      type="password"
      maxlength="6"
      inputmode="numeric"
      placeholder="Buat PIN Login (6 digit)">

    <input id="pinTrx"
      type="password"
      maxlength="6"
      inputmode="numeric"
      placeholder="Buat PIN Transaksi (6 digit)">

    <div class="terms-row">
      <input type="checkbox" id="termsCheck">
      <label for="termsCheck">Saya setuju syarat & ketentuan</label>
    </div>

    <button class="btn-primary full" id="submitRegister">
      Daftar
    </button>
  `;
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
