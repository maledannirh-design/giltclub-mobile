import { auth, db } from "../firebase.js";
import { doc, getDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderProfil(){

  const content = document.getElementById("content");
  if(!content) return;

  const user = auth.currentUser;

  if(!user){
    content.innerHTML = "<p>User tidak ditemukan.</p>";
    return;
  }

  let userData = {};

  try{
    const snap = await getDoc(doc(db,"users",user.uid));
    if(snap.exists()){
      userData = snap.data();
    }
  }catch(err){
    console.error("Load profile error:", err);
  }

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAccount">← Kembali</div>
      <div class="akun-title">Informasi Pribadi</div>

      <div class="akun-card">

        <input id="username"
          placeholder="Nama Publik"
          value="${userData.username || ""}">

        <input id="fullName"
          placeholder="Nama Lengkap"
          value="${userData.fullName || ""}">

        <input id="email"
          value="${userData.email || user.email || ""}"
          disabled>

        <input id="phone"
          placeholder="Nomor HP"
          inputmode="numeric"
          value="${userData.phone || ""}">

        <select id="genre">
          <option value="">Pilih Gender</option>
          <option value="male" ${userData.genre === "male" ? "selected" : ""}>Male</option>
          <option value="female" ${userData.genre === "female" ? "selected" : ""}>Female</option>
        </select>

        <select id="playingLevel">

  <option value="">Playing Level</option>

  <option value="1.0" ${userData.playingLevel === "1.0" ? "selected" : ""}>
    New Player (NTRP 1.0)
  </option>

  <option value="1.5" ${userData.playingLevel === "1.5" ? "selected" : ""}>
    Beginner – Basic Strokes (NTRP 1.5)
  </option>

  <option value="2.0" ${userData.playingLevel === "2.0" ? "selected" : ""}>
    Beginner – Limited Rally (NTRP 2.0)
  </option>

  <option value="2.5" ${userData.playingLevel === "2.5" ? "selected" : ""}>
    Advanced Beginner (NTRP 2.5)
  </option>

  <option value="3.0" ${userData.playingLevel === "3.0" ? "selected" : ""}>
    Lower Intermediate (NTRP 3.0)
  </option>

  <option value="3.5" ${userData.playingLevel === "3.5" ? "selected" : ""}>
    Intermediate (NTRP 3.5)
  </option>

  <option value="4.0" ${userData.playingLevel === "4.0" ? "selected" : ""}>
    Advanced Intermediate (NTRP 4.0)
  </option>

  <option value="4.5" ${userData.playingLevel === "4.5" ? "selected" : ""}>
    Advanced (NTRP 4.5)
  </option>

  <option value="5.0" ${userData.playingLevel === "5.0" ? "selected" : ""}>
    Expert / Tournament Player (NTRP 5.0)
  </option>

  <option value="5.5" ${userData.playingLevel === "5.5" ? "selected" : ""}>
    Elite Amateur (NTRP 5.5)
  </option>

  <option value="6.0" ${userData.playingLevel === "6.0" ? "selected" : ""}>
    National Level Player (NTRP 6.0)
  </option>

  <option value="7.0" ${userData.playingLevel === "7.0" ? "selected" : ""}>
    Touring Professional (NTRP 7.0)
  </option>

</select>

        <input id="birthPlace"
          placeholder="Tempat Lahir"
          value="${userData.birthPlace || ""}">

        <div class="akun-field-group">
          <label class="akun-label">Tanggal Lahir</label>
          <input type="date"
            id="birthDate"
            value="${userData.birthDate || ""}">
        </div>

        <textarea id="alamat"
          placeholder="Alamat Lengkap"
          maxlength="200">${userData.alamat || ""}</textarea>

        <textarea id="bio"
          placeholder="Bio (maks 200 karakter)"
          maxlength="200">${userData.bio || ""}</textarea>

        <button class="akun-btn" id="saveProfileBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  document.getElementById("backToAccount").onclick = async ()=>{
    const module = await import("../profile.js");
    module.renderAccountUI();
  };

  document.getElementById("saveProfileBtn").onclick = async () => {

    const username     = document.getElementById("username").value.trim();
    const fullName     = document.getElementById("fullName").value.trim();
    const phone        = document.getElementById("phone").value.trim();
    const birthPlace   = document.getElementById("birthPlace").value.trim();
    const birthDate    = document.getElementById("birthDate").value;
    const bio          = document.getElementById("bio").value.trim();
    const genre        = document.getElementById("genre").value;
    const alamat       = document.getElementById("alamat").value.trim();
    const playingLevel = document.getElementById("playingLevel").value;

    const usernameRegex = /^[A-Za-z0-9.\s]{3,30}$/;
    if(!usernameRegex.test(username)){
      alert("Nama publik hanya huruf, angka, titik, dan spasi (3–30 karakter).");
      return;
    }

    if(!fullName || fullName.length < 3){
      alert("Nama lengkap minimal 3 karakter.");
      return;
    }

    if(!genre){
      alert("Silakan pilih gender.");
      return;
    }

    try{

      let memberCode = userData.memberCode;

      if(!memberCode){
        const year = new Date().getFullYear().toString().slice(-2);
        memberCode = `GC-${year}${Math.floor(Math.random()*90000)+10000}`;
      }

      await updateDoc(doc(db, "users", user.uid), {
        username,
        fullName,
        phone,
        birthPlace,
        birthDate,
        bio,
        genre,
        alamat,
        playingLevel,
        memberCode,
        membership: userData.membership || "MEMBER"
      });

      alert("Profil berhasil diperbarui.");

      const module = await import("../profile.js");
      module.renderAccountUI();

    }catch(err){
      console.error("Update profile error:", err);
      alert("Gagal menyimpan perubahan.");
    }

  };

}
