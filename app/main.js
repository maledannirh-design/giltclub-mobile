/* =========================================
   IMPORTS
========================================= */

import { navigate } from "./navigation.js";
import { auth, db } from "./firebase.js";
import { initTheme, toggleTheme } from "./theme.js";
import { showToast } from "./ui.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
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
   MAINTENANCE GUARD
========================================= */

async function checkMaintenanceAndFreeze(user){

  const content = document.getElementById("content");
  if(!content) return false;

  try{

    const snap = await getDoc(doc(db,"system","maintenance"));
    if(!snap.exists()) return false;

    const data = snap.data();
    if(!data.enabled) return false;

    if(user){
      const userSnap = await getDoc(doc(db,"users", user.uid));
      if(userSnap.exists()){
        const role = userSnap.data().role;
        if(role === "ADMIN" || role === "SUPERCOACH"){
          return false;
        }
      }
    }

    content.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        background:#0f172a;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
        padding:30px;
        text-align:center;
        flex-direction:column;
      ">
        <h1 style="font-size:22px;margin-bottom:15px;">
          🚧 Sistem Sedang Maintenance
        </h1>

        <div style="opacity:.8;max-width:400px;">
          <p>Mutasi rekening saldo ke bank server yang lebih besar</p>
          <p>security dan keamanan sistem telah di tingkatkan</p>
          <p>penyesuaian software engine untuk kamera</p>
          <p>pembukaan toko, penjualan jersey dan product club telah diaktifkan<p> 
          <p>checkin sistem harian, checkin cashback dan sistem follow serta follow  diaktifkan</p>
          <p>perhitungan kehadiran, reward hadiah kehadiran diaktifkan</p>
          <p>dashboard skill tiap pemain kini dapat terlihat sesuai privasi member</p>

          <div style="margin-top:20px;">
            Perkiraan waktu:<br>
            <strong>1 – 3 Jam, sebagai kompensasi, gameplay tadi malam dpat double gpoint atau 2x lipat dari normal, semua penalty yg pernah dibuat di hapuskan dan saldo dikembalikan</strong>
          </div>
        </div>
      </div>
    `;

    return true;

  }catch(err){
    console.error("Maintenance check error:", err);
    return false;
  }
}


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
   ATTENDANCE LISTENER (SAFE SINGLE INSTANCE)
========================================= */

let unsubscribeAttendance = null;

function listenAttendanceNotification(uid){

  if(unsubscribeAttendance){
    unsubscribeAttendance();
    unsubscribeAttendance = null;
  }

  const q = query(
    collection(db,"bookings"),
    where("userId","==",uid),
    where("attendance","==",true)
  );

  unsubscribeAttendance = onSnapshot(q, snap=>{

    snap.docChanges().forEach(change=>{

      if(change.type !== "added" && change.type !== "modified") return;

      const data = change.doc.data();
      const attendedAt = data.attendedAt?.toDate?.();
      if(!attendedAt) return;

      const diff = Date.now() - attendedAt.getTime();
      if(diff > 60 * 60 * 1000) return;

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

    });

  });
}


/* =========================================
   AUTH STATE (SINGLE SOURCE OF TRUTH)
========================================= */

onAuthStateChanged(auth, async (user)=>{

  const label = document.getElementById("currentUserLabel");
  const adminButton = document.querySelector('[data-page="admin"]');

  if(user){

    if(await checkMaintenanceAndFreeze(user)) return;

    navigate("home");

    const statusRef = ref(rtdb, "status/" + user.uid);

    set(statusRef,{
      online: true,
      lastSeen: Date.now()
    });

    onDisconnect(statusRef).set({
      online: false,
      lastSeen: Date.now()
    });

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
          adminButton.style.display =
            (data.role === "ADMIN" || data.role === "SUPERCOACH")
            ? "flex"
            : "none";
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

    listenAttendanceNotification(user.uid);

  }else{

    if(unsubscribeAttendance){
      unsubscribeAttendance();
      unsubscribeAttendance = null;
    }

    navigate("account");

    if(label) label.innerText = "Not logged in";
    if(adminButton) adminButton.style.display = "none";
  }

});
