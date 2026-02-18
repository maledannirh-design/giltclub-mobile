import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { logout } from "./auth.js";

import { login } from "./auth.js";

window.openLogin = async function () {
  const email = prompt("Email:");
  const pass = prompt("Password:");
  await login(email, pass);
  renderProfile();
};


export async function renderProfile() {

  const content = document.getElementById("content");
  const user = auth.currentUser;

  if (!user) {
    content.innerHTML = `
      <h2>Profile</h2>
      <p>Anda belum login.</p>
      <button onclick="openLogin()">Login</button>
    `;
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    content.innerHTML = "<p>User data tidak ditemukan.</p>";
    return;
  }

  const data = snap.data();

  content.innerHTML = `
    <div class="profile-card">
      <h2>${data.name}</h2>
      <p>@${data.username}</p>
      <p>Membership: ${data.membership}</p>
      <p>Level: ${data.level}</p>
      <p>Points: ${data.points}</p>
      <p>Wins: ${data.wins}</p>
      <p>Matches: ${data.matches}</p>

      <button id="logoutBtn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logout();
    renderProfile();
  });
}
