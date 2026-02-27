/* =========================================
   IMPORTS
========================================= */

import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { initTheme, toggleTheme } from "./theme.js";
import { doc, getDoc } from "./firestore.js";
import { showToast, showConfirm } from "./ui.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =========================================
   GLOBAL INIT
========================================= */

initTheme();

window.navigate = navigate;
window.toggleTheme = toggleTheme;

const rtdb = getDatabase();


/* =========================================
   SPLASH SCREEN CONTROL
========================================= */

window.addEventListener("load", () => {

  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  setTimeout(() => splash.classList.add("fade-out"), 1200);
  setTimeout(() => splash.classList.add("hide"), 2000);

});


/* =========================================
   AUTH STATE (SINGLE SOURCE OF TRUTH)
========================================= */

onAuthStateChanged(auth, async (user)=>{

  const label = document.getElementById("currentUserLabel");
  const adminButton = document.querySelector('[data-page="admin"]');

  if(user){

    navigate("home");

    /* =============================
       PRESENCE SYSTEM
    ============================= */
    const statusRef = ref(rtdb, "status/" + user.uid);

    set(statusRef,{
      online: true,
      lastSeen: Date.now()
    });

    onDisconnect(statusRef).set({
      online: false,
      lastSeen: Date.now()
    });

    /* =============================
       LOAD USER DATA
    ============================= */
    try{

      const snap = await getDoc(doc(db, "users", user.uid));

      if(snap.exists()){

        const data = snap.data();

        window.currentUserRole = data.role || "MEMBER";

        if(label){
          label.innerText =
            `${data.username || "User"} (${data.role || "-"})`;
        }

        if(adminButton){
          if(data.role === "ADMIN" || data.role === "SUPERCOACH"){
            adminButton.style.display = "flex";
          }else{
            adminButton.style.display = "none";
          }
        }

      }else{

        if(label) label.innerText = "User data missing";
        if(adminButton) adminButton.style.display = "none";

      }

    }catch(error){

      console.error("User load error:", error);

      if(label) label.innerText = "Error loading user";
      if(adminButton) adminButton.style.display = "none";

    }

    /* =============================
       ATTENDANCE REALTIME LISTENER
    ============================= */
    listenAttendanceNotification(user.uid);

  }else{

    navigate("account");

    if(label) label.innerText = "Not logged in";
    if(adminButton) adminButton.style.display = "none";

  }

});

function listenAttendanceNotification(uid){

  const q = query(
    collection(db,"bookings"),
    where("userId","==",uid),
    where("attendance","==",true)
  );

  onSnapshot(q, snap=>{

    snap.docChanges().forEach(change=>{

      if(change.type === "added" || change.type === "modified"){

        const data = change.doc.data();
        const attendedAt = data.attendedAt?.toDate?.();
        if(!attendedAt) return;

        const diff = Date.now() - attendedAt.getTime();
        if(diff > 60 * 60 * 1000) return; // 1 jam window

        const bookingId = change.doc.id;

        const notified =
          JSON.parse(localStorage.getItem("notifiedBookings") || "[]");

        if(notified.includes(bookingId)) return;

        const cashback = data.rewardCashback || 0;
        const gpoint = data.rewardGPoint || 0;
        const date = data.rewardSessionDate || "-";

        let message = "✅ Check-in berhasil!\n";

        if(cashback > 0){
          message += `💰 Cashback Rp ${cashback.toLocaleString("id-ID")}\n`;
        }

        if(gpoint > 0){
          message += `⭐ GPoint +${gpoint}\n`;
        }

        message += `📅 ${date}`;

        showToast(message);

        notified.push(bookingId);
        localStorage.setItem(
          "notifiedBookings",
          JSON.stringify(notified)
        );
      }

    });

  });

}
