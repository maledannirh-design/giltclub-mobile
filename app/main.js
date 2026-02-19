import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { doc, getDoc } from "./firestore.js";

import { initTheme } from "./theme.js";
import { toggleTheme } from "./theme.js";

initTheme();
window.toggleTheme = toggleTheme;


// Expose navigate ke global (untuk onclick di HTML)
window.navigate = navigate;


document.addEventListener("DOMContentLoaded", () => {

  // Default page
  navigate("home");

  // ==============================
  // AUTH STATE LISTENER
  // ==============================
  auth.onAuthStateChanged(async (user) => {

    const label = document.getElementById("currentUserLabel");

    if (!label) return;

    // Jika belum login
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

      // Tampilkan username + role
      label.innerText = `${data.username} (${data.role})`;

    } catch (error) {

      console.error("Error loading user data:", error);
      label.innerText = "Error loading user";

    }

  });

});
