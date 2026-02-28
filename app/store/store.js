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
