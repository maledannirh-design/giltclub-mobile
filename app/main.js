/* =========================================
   IMPORTS
========================================= */

import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { initTheme, toggleTheme } from "./theme.js";
import { doc, getDoc } from "./firestore.js";

import { getDatabase, ref, set, onDisconnect }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =========================================
   GLOBAL INIT
========================================= */

// Init theme once
initTheme();

// Expose to window
window.navigate = navigate;
window.toggleTheme = toggleTheme;

// Init Realtime Database
const rtdb = getDatabase();


/* =========================================
   SPLASH SCREEN CONTROL
========================================= */

window.addEventListener("load", () => {

  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("fade-out");
  }, 1200);

  setTimeout(() => {
    splash.classList.add("hide");
  }, 2000);

});


/* =========================================
   AUTH STATE (SINGLE SOURCE OF TRUTH)
========================================= */

onAuthStateChanged(auth, async (user)=>{

  const label = document.getElementById("currentUserLabel");
  const adminButton = document.querySelector('[data-page="admin"]');

  if(user){

    // Navigate once
    navigate("home");

    // =============================
    // PRESENCE SYSTEM
    // =============================
    const statusRef = ref(rtdb, "status/" + user.uid);

    set(statusRef,{
      online: true,
      lastSeen: Date.now()
    });

    onDisconnect(statusRef).set({
      online: false,
      lastSeen: Date.now()
    });

    // =============================
    // LOAD USER DATA (ROLE + LABEL)
    // =============================
    try{

      const snap = await getDoc(doc(db, "users", user.uid));

      if(snap.exists()){

        const data = snap.data();

        // Simpan global role (optional but good)
        window.currentUserRole = data.role || "MEMBER";

        // Update label
        if(label){
          label.innerText = `${data.username || "User"} (${data.role || "-"})`;
        }

        // =============================
        // SHOW / HIDE ADMIN MENU
        // =============================
        if(adminButton){
          if(data.role === "ADMIN" || data.role === "SUPERCOACH"){
            adminButton.style.display = "flex";
          }else{
            adminButton.style.display = "none";
          }
        }

      }else{

        if(label){
          label.innerText = "User data missing";
        }

        if(adminButton){
          adminButton.style.display = "none";
        }

      }

    }catch(error){

      console.error("User load error:", error);

      if(label){
        label.innerText = "Error loading user";
      }

      if(adminButton){
        adminButton.style.display = "none";
      }
    }

  }else{

    navigate("account");

    if(label){
      label.innerText = "Not logged in";
    }

    if(adminButton){
      adminButton.style.display = "none";
    }

  }

});
