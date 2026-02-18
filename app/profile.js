import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { login, register, logout } from "./auth.js";
import { followUser, unfollowUser, isFollowing } from "./social.js";


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
      <p><button id="openPublic">View Public Profile</button></p>

      <button id="logoutBtn">Logout</button>
    </div>
  `;
document.getElementById("openPublic").onclick = () => {
  viewUserProfile(user.uid);
};
  document.getElementById("logoutBtn").onclick = async () => {
    await logout();
    renderProfile();
  };
}

export async function viewUserProfile(targetUserId) {

  const content = document.getElementById("content");
  const currentUser = auth.currentUser;

  const snap = await getDoc(doc(db, "users", targetUserId));

  if (!snap.exists()) {
    content.innerHTML = "<p>User tidak ditemukan</p>";
    return;
  }

  const data = snap.data();

  const isOwnProfile =
    currentUser && currentUser.uid === targetUserId;

  let followButtonHTML = "";

  if (!isOwnProfile && currentUser) {
    const alreadyFollowing = await isFollowing(targetUserId);

    followButtonHTML = alreadyFollowing
      ? `<button id="followBtn">Unfollow</button>`
      : `<button id="followBtn">Follow</button>`;
  }

  content.innerHTML = `
    <h2>${data.name}</h2>
    <p>@${data.username}</p>
    <p>Level: ${data.level ?? 0}</p>
    <p>Points: ${data.points ?? 0}</p>
    <p>Followers: ${data.followersCount ?? 0}</p>
    <p>Following: ${data.followingCount ?? 0}</p>

    ${followButtonHTML}

    <br><br>
    <button id="backBtn">Back</button>
  `;

  if (!isOwnProfile && currentUser) {
    const btn = document.getElementById("followBtn");

    btn.onclick = async () => {
      const alreadyFollowing = await isFollowing(targetUserId);

      if (alreadyFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }

      viewUserProfile(targetUserId);
    };
  }

  document.getElementById("backBtn").onclick = () => {
    renderProfile();
  };
}

