import { buildChampionClub, listenChampionClub, attachRankMovement } from "./leaderboard.js";
import { renderChampionClub } from "./leaderboard-ui.js";

let unsubscribeChampion = null;
let lastSnapshot = [];

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

  document.getElementById("closeChampion")
    ?.addEventListener("click", ()=>{
      if(unsubscribeChampion){
        unsubscribeChampion(); // 🔥 penting stop listener
      }
      window.navigate("home");
    });

  // ✅ INIT REALTIME DI SINI (INI YANG LO CARI)
  initChampionClub();

}


function initChampionClub(){

  const user = auth.currentUser;
  if(!user) return;

  const monthKey = getCurrentMonthKey(); // kita bikin helper

  if(unsubscribeChampion){
    unsubscribeChampion();
  }

  unsubscribeChampion = listenChampionClub(monthKey, async (data)=>{

    // 🔥 movement logic
    const withMovement = attachRankMovement(data, lastSnapshot);

    renderChampionClub(withMovement);

    lastSnapshot = data;

  });

}
