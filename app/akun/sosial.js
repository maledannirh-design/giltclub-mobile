import { auth, db } from "../firebase.js";
import { doc, getDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    if(snap.exists()){
      userData = snap.data();
    }
  }catch(err){
    console.error("Load social error:", err);
  }

  const social = userData.social || {
    instagramUrl: "",
    tiktokUrl: "",
    facebookUrl: ""
  };

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAccount">← Kembali</div>
      <div class="akun-title">Sosial Media</div>

      <div class="akun-card">

        <input id="instagramUrl"
          placeholder="Instagram (username / @username / link)"
          value="${social.instagramUrl || ""}">

        <input id="tiktokUrl"
          placeholder="TikTok (username / @username / link)"
          value="${social.tiktokUrl || ""}">

        <input id="facebookUrl"
          placeholder="Facebook (username / link)"
          value="${social.facebookUrl || ""}">

        <button class="akun-btn" id="saveSocialBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  // 🔙 BACK
  document.getElementById("backToAccount").onclick = async ()=>{
    const module = await import("../profile.js");
    module.renderAccountUI();
  };

  // ===== HELPER NORMALIZE =====
  function normalizeInstagram(input){
    if(!input) return "";
    input = input.replace("@","").trim();

    if(input.includes("instagram.com")){
      return input.startsWith("http") ? input : "https://" + input;
    }

    return `https://instagram.com/${input}`;
  }

  function normalizeTiktok(input){
    if(!input) return "";
    input = input.replace("@","").trim();

    if(input.includes("tiktok.com")){
      return input.startsWith("http") ? input : "https://" + input;
    }

    return `https://tiktok.com/@${input}`;
  }

  function normalizeFacebook(input){
    if(!input) return "";
    input = input.trim();

    if(input.includes("facebook.com")){
      return input.startsWith("http") ? input : "https://" + input;
    }

    return `https://facebook.com/${input}`;
  }

  // ===== PLATFORM VALIDATION =====
  const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/;
  const tiktokRegex    = /^https?:\/\/(www\.)?tiktok\.com\/@?[A-Za-z0-9._]+\/?$/;
  const facebookRegex  = /^https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9._]+\/?$/;

  // 💾 SAVE
  document.getElementById("saveSocialBtn").onclick = async () => {

    let igInput = document.getElementById("instagramUrl").value.trim();
    let ttInput = document.getElementById("tiktokUrl").value.trim();
    let fbInput = document.getElementById("facebookUrl").value.trim();

    const instagramUrl = normalizeInstagram(igInput);
    const tiktokUrl    = normalizeTiktok(ttInput);
    const facebookUrl  = normalizeFacebook(fbInput);

    if(instagramUrl && !instagramRegex.test(instagramUrl)){
      alert("Format Instagram tidak valid.");
      return;
    }

    if(tiktokUrl && !tiktokRegex.test(tiktokUrl)){
      alert("Format TikTok tidak valid.");
      return;
    }

    if(facebookUrl && !facebookRegex.test(facebookUrl)){
      alert("Format Facebook tidak valid.");
      return;
    }

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
      console.error("Update social error:", err);
      alert("Gagal menyimpan perubahan.");
    }
  };
}
