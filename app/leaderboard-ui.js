import { auth } from "./firebase.js";

export function renderChampionClub(data){

  const container = document.getElementById("championClub");
  if(!container) return;

  container.innerHTML = "";

  // ===== PODIUM =====
  const top3 = data.slice(0,3);

  const podium = document.createElement("div");
  podium.className = "champion-podium";

  top3.forEach((p,index)=>{

    const el = document.createElement("div");
    el.className = `podium-item rank-${index+1}`;

    el.innerHTML = `
      <div class="podium-rank">#${p.rank}</div>

      <div class="podium-name">${p.name}</div>

      <!-- ✅ TAMBAHAN W/L -->
      <div class="podium-stat">
        W:${p.win} | L:${p.lose}
      </div>

      <div class="podium-diff">
        ${p.scoreDiff > 0 ? "+" : ""}${p.scoreDiff}
      </div>

      <div class="movement ${getMoveClass(p.movement)}">
        ${getMoveSymbol(p.movement)}
      </div>
    `;

    podium.appendChild(el);
  });

  container.appendChild(podium);

  // ===== LIST =====
  data.slice(3).forEach(p=>{

    const el = document.createElement("div");
    el.className = "champion-entry fade-in";

    const isMe = p.uid === auth.currentUser?.uid;
    if(isMe){
      el.classList.add("me");
    }

    el.innerHTML = `
      <div class="rank">#${p.rank}</div>
      <div class="name">${p.name}</div>

      <!-- SUDAH BENAR -->
      <div class="stat">W:${p.win} | L:${p.lose}</div>

      <div class="diff">
        ${p.scoreDiff > 0 ? "+" : ""}${p.scoreDiff}
      </div>

      <div class="movement ${getMoveClass(p.movement)}">
        ${getMoveSymbol(p.movement)}
      </div>
    `;

    container.appendChild(el);
  });

}


// ================= HELPERS =================
function getMoveSymbol(m){
  if(m > 0) return `⬆ ${m}`;
  if(m < 0) return `⬇ ${Math.abs(m)}`;
  return "•";
}

function getMoveClass(m){
  if(m > 0) return "up";
  if(m < 0) return "down";
  return "same";
}
