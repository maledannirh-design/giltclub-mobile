import { auth, db } from "../firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderAkunPage } from "./index.js";

export async function renderPrivasi(){

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

  const privacy = userData.privacy || {};

  content.innerHTML = `
    <div class="akun-container">

      <div class="akun-back" id="backToAkun">← Kembali</div>
      <div class="akun-title">Pengaturan Privasi</div>

      <div class="akun-card">

        <div class="akun-checkbox-row">
          <input type="checkbox" id="showOnlineStatus"
            ${privacy.showOnlineStatus ? "checked" : ""}>
          <label for="showOnlineStatus">Tampilkan Status Online</label>
        </div>

        <div class="akun-checkbox-row">
          <input type="checkbox" id="showSkillDashboard"
            ${privacy.showSkillDashboard ? "checked" : ""}>
          <label for="showSkillDashboard">Tampilkan Dashboard Skill</label>
        </div>

        <select id="chatPermission">
          <option value="all" ${privacy.chatPermission === "all" ? "selected" : ""}>Semua</option>
          <option value="followers" ${privacy.chatPermission === "followers" ? "selected" : ""}>Followers</option>
          <option value="none" ${privacy.chatPermission === "none" ? "selected" : ""}>Tidak ada</option>
        </select>

        <button class="akun-btn" id="savePrivacyBtn">
          Simpan Perubahan
        </button>

      </div>

    </div>
  `;

  document.getElementById("backToAkun").onclick = renderAkunPage;

  document.getElementById("savePrivacyBtn").onclick = async () => {

    const showOnlineStatus = document.getElementById("showOnlineStatus").checked;
    const showSkillDashboard = document.getElementById("showSkillDashboard").checked;
    const chatPermission = document.getElementById("chatPermission").value;

    try{
      await updateDoc(doc(db,"users",user.uid),{
        privacy:{
          showOnlineStatus,
          showSkillDashboard,
          chatPermission
        }
      });

      alert("Pengaturan privasi diperbarui.");
    }catch(err){
      console.error(err);
      alert("Gagal menyimpan perubahan.");
    }
  };
}
