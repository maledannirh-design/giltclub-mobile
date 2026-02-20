import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { doc, getDoc } from "./firestore.js";
import { initTheme, toggleTheme } from "./theme.js";

// Expose navigate ke global
window.navigate = navigate;

// ================= SPLASH CONTROL =================
window.addEventListener("load", () => {
  const splash = document.getElementById("splashScreen");

  if (!splash) return;

  // Tambah class fadeOut setelah 1.5 detik
  setTimeout(() => {
    splash.classList.add("fade-out");
  }, 1500);

  // Hapus total setelah 2.5 detik
  setTimeout(() => {
    splash.classList.add("hide");
  }, 2500);
});

// ================= APP INIT =================
document.addEventListener("DOMContentLoaded", () => {

  navigate("home");

  auth.onAuthStateChanged(async (user) => {

    const label = document.getElementById("currentUserLabel");
    if (!label) return;

    if (!user) {
      label.innerText = "Not logged in";
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists()) {
        label.innerText = "User data missing";
        return;
      }

      const data = snap.data();
      label.innerText = `${data.username} (${data.role})`;

    } catch (error) {
      console.error("Error loading user data:", error);
      label.innerText = "Error loading user";
    }

  });

});

initTheme();
window.toggleTheme = toggleTheme;
