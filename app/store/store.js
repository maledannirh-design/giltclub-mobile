import { auth, db } from "../firebase.js";
import { doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderStore() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div style="padding:20px;text-align:center;opacity:.6;">
      Loading store...
    </div>
  `;

  const user = auth.currentUser;
  if (!user) {
    content.innerHTML = "<p>Not logged in</p>";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    content.innerHTML = "<p>User data not found</p>";
    return;
  }

  const userData = snap.data();

  // sekarang aman
  renderStoreUI(userData);
}

function renderStoreUI(userData){

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="store-page">

      <div style="margin-bottom:16px;padding:12px;border-radius:12px;background:#111;">
        <div style="font-size:12px;opacity:.6;">Saldo</div>
        <div style="font-size:18px;font-weight:600;">
          Rp ${Number(userData.wallet || 0).toLocaleString()}
        </div>

        <div style="font-size:12px;opacity:.6;margin-top:8px;">GPoints</div>
        <div style="font-size:16px;font-weight:600;color:#f5c518;">
          ${Number(userData.gpoints || 0).toLocaleString()} GP
        </div>
      </div>

      <h2>Official Store</h2>
      <div id="storeProducts" class="store-grid"></div>

      <h2>Redeem Rewards</h2>
      <div id="storeRewards" class="store-grid"></div>

      <h2>Flash Redeem</h2>
      <div id="storeFlash" class="store-grid"></div>

    </div>
  `;

  // Panggil renderer masing-masing
  renderProducts(userData);
  renderRewards(userData);
  renderFlash(userData);
}
