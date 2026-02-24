import { auth, db } from "../firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderAkunPage } from "./index.js";

export async function renderSosial(){

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

  const social = userData.social || {};

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAkun">← Kembali</div>
      <div class="akun-title">Sosial Media</div>

      <div class="akun-card">

        <input id="instagramUrl"
          placeholder="URL Instagram"
          value="${social.instagramUrl || ""}">

        <input id="tiktokUrl"
          placeholder="URL TikTok"
          value="${social.tiktokUrl || ""}">

        <input id="facebookUrl"
          placeholder="URL Facebook"
          value="${social.facebookUrl || ""}">

        <button class="akun-btn" id="saveSocialBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  document.getElementById("backToAkun").onclick = renderAkunPage;

  document.getElementById("saveSocialBtn").onclick = async () => {

    const instagramUrl = document.getElementById("instagramUrl").value.trim();
    const tiktokUrl = document.getElementById("tiktokUrl").value.trim();
    const facebookUrl = document.getElementById("facebookUrl").value.trim();

    try{
      await updateDoc(doc(db,"users",user.uid),{
        social:{
          instagramUrl,
          tiktokUrl,
          facebookUrl
        }
      });

      alert("Sosial media berhasil diperbarui.");
    }catch(err){
      console.error(err);
      alert("Gagal menyimpan perubahan.");
    }
  };
}
