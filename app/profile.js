import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { login, register, logout } from "./auth.js";

export async function renderProfile() {

  const content = document.getElementById("content");
  const user = auth.currentUser;

  // ======================
  // JIKA BELUM LOGIN
  // ======================
  if (!user) {

    content.innerHTML = `
      <h2>Login / Register</h2>

      <div class="auth-box">
        <input id="email" placeholder="Email">
        <input id="password" type="password" placeholder="Password">
        <input id="username" placeholder="Username (untuk daftar saja)">
        
        <button id="loginBtn">Login</button>
        <button id="registerBtn">Register</button>
      </div>
    `;

    document.getElementById("loginBtn").onclick = async () => {
      try {
        const email = document.getElementById("email").value;
        const pass = document.getElementById("password").value;
        await login(email, pass);
        renderProfile();
      } catch (err) {
        alert(err.message);
      }
    };

    document.getElementById("registerBtn").onclick = async () => {
      try {
        const email = document.getElementById("email").value;
        const pass = document.getElementById("password").value;
        const username = document.getElementById("username").value;

        if (!username) {
          alert("Isi username untuk daftar");
          return;
        }

        await register(email, pass, username);
        renderProfile();
      } catch (err) {
        alert(err.message);
      }
    };

    return;
  }

  // ======================
  // JIKA SUDAH LOGIN
  // ======================
  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.data();

  content.innerHTML = `
    <h2>Profile</h2>

    <div class="profile-card">
      <p><strong>${data.name}</strong></p>
      <p>Email: ${user.email}</p>
      <p>Level: ${data.level}</p>
      <p>Points: ${data.points}</p>
      <p>Followers: ${data.followersCount}</p>
      <p>Following: ${data.followingCount}</p>

      <button id="logoutBtn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = async () => {
    await logout();
    renderProfile();
  };
}
