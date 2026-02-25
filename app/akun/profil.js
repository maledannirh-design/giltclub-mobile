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

        <input id="birthPlace"
          placeholder="Tempat Lahir"
          value="${userData.birthPlace || ""}">

        <div class="akun-field-group">
  <label class="akun-label">Tanggal Lahir</label>
  <input type="date"
    id="birthDate"
    value="${userData.birthDate || ""}">
</div>

        <textarea id="bio"
          placeholder="Bio (maks 200 karakter)"
          maxlength="200">${userData.bio || ""}</textarea>

        <button class="akun-btn" id="saveProfileBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  // BACK BUTTON
  document.getElementById("backToAccount").onclick = async ()=>{
    const module = await import("../profile.js");
    module.renderAccountUI();
  };

  // SAVE PROFILE
  document.getElementById("saveProfileBtn").onclick = async () => {

    const username   = document.getElementById("username").value.trim();
    const fullName = document.getElementById("fullName").value.trim();
    const phone      = document.getElementById("phone").value.trim();
    const birthPlace = document.getElementById("birthPlace").value.trim();
    const birthDate  = document.getElementById("birthDate").value;
    const bio        = document.getElementById("bio").value.trim();

    // VALIDATION

    const usernameRegex = /^[A-Za-z0-9.\s]{3,30}$/;
    if(!usernameRegex.test(username)){
      alert("Nama publik hanya huruf, angka, titik, dan spasi (3–30 karakter).");
      return;
    }

    if(!fullName || fullName.trim().length < 3){
  alert("Nama lengkap minimal 3 karakter.");
  return;
}

    const birthPlaceRegex = /^[A-Za-z\s]{3,50}$/;
    if(birthPlace && !birthPlaceRegex.test(birthPlace)){
      alert("Tempat lahir hanya boleh huruf dan spasi.");
      return;
    }

    if(bio.length > 200){
      alert("Bio maksimal 200 karakter.");
      return;
    }

    try{

      await updateDoc(doc(db, "users", user.uid), {
        username: username,
        fullName: fullName,
        phone: phone,
        birthPlace: birthPlace,
        birthDate: birthDate,
        bio: bio
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
