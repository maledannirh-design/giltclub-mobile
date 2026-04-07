// ================= IMPORT =================
import { auth } from "./firebase.js";

import {
  buildChampionClub,
  listenChampionClub,
  attachRankMovement,
  saveChampionClub,
  loadChampionHistory,
  getCurrentMonthKey
} from "./leaderboard.js";

import { renderChampionClub } from "./leaderboard-ui.js";


// ================= STATE =================
let unsubscribeChampion = null;
let lastSnapshot = [];

// ================= MAIN PAGE =================
export function renderChampionClubPage(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="champion-page">

      <div class="champion-header">
        <div class="title">🏆 Champion Club</div>
        <div class="close-btn" id="closeChampion">✕</div>
      </div>

      <div id="championClub"></div>

    </div>
  `;

  // ===== CLOSE BUTTON =====
  document.getElementById("closeChampion")
    ?.addEventListener("click", ()=>{
      if(unsubscribeChampion){
        unsubscribeChampion(); // 🔥 stop realtime
      }
      window.navigate("home");
    });

  // ===== INIT SYSTEM =====
  initChampionClub();

}


// ================= INIT ENGINE =================
async function initChampionClub(){

  const user = auth.currentUser;
  if(!user) return;

  const monthKey = getCurrentMonthKey();

  // ===== AUTO SAVE BULANAN (1x CHECK) =====
  try{
    const history = await loadChampionHistory(monthKey);

    if(!history){
      const initialData = await buildChampionClub(monthKey);
      await saveChampionClub(monthKey, initialData);
    }
  }catch(err){
    console.error("Champion save init error:", err);
  }

  // ===== STOP LISTENER LAMA =====
  if(unsubscribeChampion){
    unsubscribeChampion();
  }

  // ===== REALTIME LISTENER =====
  unsubscribeChampion = listenChampionClub(monthKey, async (data)=>{

    // ===== RANK MOVEMENT =====
    const withMovement = attachRankMovement(data, lastSnapshot);

    // ===== RENDER =====
    renderChampionClub(withMovement);

    // ===== SAVE SNAPSHOT =====
    lastSnapshot = data;

  });

}
