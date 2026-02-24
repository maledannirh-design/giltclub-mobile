import { auth, db } from "../firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderAkunPage } from "./index.js";

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
    if(snap.exists()) userData = snap.data();
  }catch(err){
    console.error(err);
  }

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAkun">← Kembali</div>
      <div class="akun-title">Informasi Pribadi</div>

      <div class="akun-card">

        <input id="usernameID"
          placeholder="UsernameID"
          value="${userData.usernameID || ""}">

        <input id="displayName"
          placeholder="Display Name"
          value="${userData.displayName || ""}">

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

        <input type="date"
          id="birthDate"
          value="${userData.birthDate || ""}">

        <textarea id="bio"
          placeholder="Bio (maks 200 karakter)"
          maxlength="200">${userData.bio || ""}</textarea>

        <button class="akun-btn" id="saveProfileBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  document.getElementById("backToAkun").onclick = renderAkunPage;

  document.getElementById("saveProfileBtn").onclick = async () => {

    const usernameID = document.getElementById("usernameID").value.trim();
    const displayName = document.getElementById("displayName").value.trim();
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const birthPlace = document.getElementById("birthPlace").value.trim();
    const birthDate = document.getElementById("birthDate").value;
    const bio = document.getElementById("bio").value.trim();

    const usernameRegex = /^[a-z0-9_]{4,20}$/;
    if(!usernameRegex.test(usernameID)){
      alert("UsernameID tidak valid.");
      return;
    }

    const birthPlaceRegex = /^[A-Za-z\s]{3,50}$/;
    if(birthPlace && !birthPlaceRegex.test(birthPlace)){
      alert("Tempat lahir hanya huruf dan spasi.");
      return;
    }

    if(bio.length > 200){
      alert("Bio maksimal 200 karakter.");
      return;
    }

    try{
      await updateDoc(doc(db,"users",user.uid),{
        usernameID,
        displayName,
        fullName,
        phone,
        birthPlace,
        birthDate,
        bio
      });

      alert("Profil berhasil diperbarui.");
    }catch(err){
      console.error(err);
      alert("Gagal menyimpan perubahan.");
    }
  };
}

