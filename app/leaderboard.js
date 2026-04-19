import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  setDoc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  doc,
  updateDoc
} from "./firestore.js";

function getRankReward(rank){

  if(rank === 1)
    return "🎟️ Voucher Semi Private GRATIS";

  if(rank === 2)
    return "🎟️ Voucher Mabar GRATIS + 750 GPoint";

  if(rank === 3)
    return "🎟️ Voucher Mabar GRATIS";

  if(rank >=4 && rank <=5)
    return "⭐ Bonus Bulanan 1250 GPoint";
  
  if(rank >=6 && rank <=7)
    return "⭐ Bonus Bulanan 900 GPoint";
  
  if(rank >=8 && rank <=9)
    return "⭐ Bonus Bulanan 750 GPoint";

  if(rank === 10)
    return "⭐ Bonus Bulanan 450 GPoint";

  return "";

}

/* ======================================================
   MONTHLY RESET
====================================================== */

async function ensureMonthlyReset(userDoc){

  const currentMonth = getCurrentMonthKey();
  const data = userDoc.data();

  if(data.monthlyKey !== currentMonth){

    const ref = doc(db,"users",userDoc.id);

    await updateDoc(ref,{
      monthlyContribution:0,
      monthlyKey:currentMonth
    });

    data.monthlyContribution = 0;
  }

  return data;
}

/* ======================================================
   REALTIME LEADERBOARD
====================================================== */

export function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = getCurrentMonthKey();

  const q = query(
    collection(db,"users"),
    where("monthlyContribution",">",0),
    orderBy("monthlyContribution","desc"),
    orderBy("attendanceCount","desc"),
    limit(10)
  );

  onSnapshot(q, async (snap)=>{

    const users = [];

    for(const docSnap of snap.docs){

      const data = await ensureMonthlyReset(docSnap);

      users.push({
        userId: docSnap.id,
        name: data.name || data.username || "Member",
        monthlyContribution: data.monthlyContribution || 0,
        attendanceCount: data.attendanceCount || 0
      });

    }

    if(!users.length){

      content.innerHTML = `
        <div style="padding:20px;">
          <h2 class="leaderboard-title">
🏆 Leaderboard ${formatMonthID(currentMonth)}
</h2>
          <p>Belum ada kehadiran bulan ini.</p>
        </div>
      `;

      return;
    }

    let html = `
      <div class="leaderboard-wrapper">

        <h2 class="leaderboard-title">
🏆 Leaderboard ${formatMonthID(currentMonth)}
</h2>
    `;

    users.forEach((user,index)=>{

      let crown = "";
      let crownSize = "18px";

      if(index === 0){ crown = "🥇"; crownSize="26px"; }
      if(index === 1){ crown = "🥈"; crownSize="22px"; }
      if(index === 2){ crown = "🥉"; crownSize="20px"; }

      html += `
        <div class="rank-item rank-${index+1}">

          <div>

            <div style="font-weight:600;">
              ${crown ? `<span style="font-size:${crownSize};margin-right:6px;">${crown}</span>` : ""}
              #${index+1} ${user.name}
            </div>

            <div style="font-size:12px;opacity:.6;">
              Total Hadir: ${user.attendanceCount}
            </div>

          </div>

          <div class="rank-right">

            <div class="rank-session">
              ${user.monthlyContribution} sesi bulan ini
            </div>

            <div class="rank-reward">
              ${getRankReward(index+1)}
            </div>

          </div>

        </div>
      `;
    });

    /* =============================
       OFFICIAL LEADERBOARD RULES
    ============================== */

    html += `

      <div class="leaderboard-rules">

        <div class="rules-title">
          ℹ️ Official Leaderboard Rules
        </div>

        <div class="rules-text">
          Penentuan rank 1 - 5 tidak memperhatikan total kehadiran,
          hanya berdasarkan jumlah sesi bulan ini.
          Jika terdapat kesamaan jumlah sesi maka akan dilakukan
          undian pada tanggal 8 dari beberapa member.
        </div>

        <div class="rules-text">
          Reward akan dibagikan ke inbox toko dan dapat mulai
          digunakan pada tanggal 9 setiap bulannya.
        </div>

      </div>

    </div>
    `;

    content.innerHTML = html;

  });

}
/* ======================================================
   FORMAT MONTH
====================================================== */

function formatMonthID(monthKey){

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  const [year,month] = monthKey.split("-");

  return `${months[parseInt(month)-1]} ${year}`;
}

// ===== MONTH KEY HELPER =====
export function getCurrentMonthKey(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

export function listenChampionClub(monthKey, callback){

  const q = collection(db,"matches");

  return onSnapshot(q, async (snapshot)=>{

    const data = await buildChampionClub(monthKey);

    callback(data);

  });

}

export function renderChampionClub(data){

  const container = document.getElementById("championClub");
  if(!container) return;

  container.innerHTML = "";

  if(!data || data.length === 0){
    container.innerHTML = "<div>Tidak ada data</div>";
    return;
  }

  // ===============================
  // GROUP (TIE LOGIC - SAME AS MATCHES)
  // ===============================
  const groups = [];
  let currentGroup = [];

  data.forEach((p,i)=>{
    if(i === 0){
      currentGroup.push(p);
    }else{
      const prev = data[i-1];

      if(p.win === prev.win && p.scoreDiff === prev.scoreDiff){
        currentGroup.push(p);
      }else{
        groups.push(currentGroup);
        currentGroup = [p];
      }
    }
  });

  if(currentGroup.length) groups.push(currentGroup);

  // ===============================
  // RANK ASSIGN
  // ===============================
  let currentRank = 1;

  const rankedGroups = groups.map((group, index)=>{

    if(index !== 0){
      const prev = groups[index - 1][0];
      const curr = group[0];

      if(curr.win !== prev.win || curr.scoreDiff !== prev.scoreDiff){
        currentRank++;
      }
    }

    return {
      rank: currentRank,
      players: group
    };
  });

  // ===============================
  // RENDER
  // ===============================
  rankedGroups.forEach(g=>{

    g.players.forEach(p=>{

      const el = document.createElement("div");
      el.className = "mm-entry";

      // ===============================
      // MOVEMENT ICON
      // ===============================
      let movementIcon = "•";

      if(p.movement !== undefined){
        if(p.movement === "NEW"){
          movementIcon = "🆕";
        }else if(p.movement > 0){
          movementIcon = `⬆️ ${p.movement}`;
        }else if(p.movement < 0){
          movementIcon = `⬇️ ${Math.abs(p.movement)}`;
        }
      }

      // ===============================
      // SAFE NAME
      // ===============================
      const displayName = p.name || "Unknown";

      el.innerHTML = `
        <div class="mm-rank">#${g.rank}</div>

        <div class="mm-name">${displayName}</div>

        <div class="mm-stat">
          W:${p.win || 0} | L:${p.lose || 0}
        </div>

        <div class="mm-diff ${p.scoreDiff >= 0 ? "mm-pos" : "mm-neg"}">
          ${p.scoreDiff > 0 ? "+" : ""}${p.scoreDiff || 0}
        </div>

        <div class="mm-move">
          ${movementIcon}
        </div>
      `;

      container.appendChild(el);

    });

  });

}

export async function buildChampionClub(monthKey){

  const matchesSnap = await getDocs(collection(db,"matches"));
  const usersSnap = await getDocs(collection(db,"users"));
  const guestSnap = await getDocs(collection(db,"guestPlayers")); // ✅ FIX: pastikan nama collection sama

  // ===============================
  // UNIFIED PLAYER MAP
  // ===============================
  const playerMap = {};

  // users
  usersSnap.forEach(doc=>{
    const d = doc.data();
    playerMap[doc.id] =
      d.fullName ||
      d.username ||
      d.name ||
      "User";
  });

  // guestPlayers (FIX UTAMA ADA DI SINI)
  guestSnap.forEach(doc=>{
    const d = doc.data();
    playerMap[doc.id] = d.name || "Guest";
  });

  const table = {};

  function initPlayer(uid){

    if(!uid) return;

    if(!table[uid]){

      const name = playerMap[uid];

      if(!name){
        console.warn("PLAYER NOT FOUND:", uid);
      }

      table[uid] = {
        uid,
        name: name || "Guest",
        matchPlayed: 0,
        win: 0,
        lose: 0,
        scoreDiff: 0,
        points: 0
      };

    }
  }

  matchesSnap.forEach(doc=>{
    const m = doc.data();

    if(!m.updatedAt) return;

    const date = m.updatedAt.toDate();
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;

    if(key !== monthKey) return;

    const teamA = [m.a1, m.a2].filter(Boolean);
    const teamB = [m.b1, m.b2].filter(Boolean);

    const teamAWin = m.scoreA > m.scoreB;

    [...teamA, ...teamB].forEach(uid=>initPlayer(uid));

    // TEAM A
    teamA.forEach(uid=>{
      if(!table[uid]) return;

      table[uid].matchPlayed++;

      if(teamAWin){
        table[uid].win++;
        table[uid].points += 3;
      }else{
        table[uid].lose++;
      }

      table[uid].scoreDiff += (m.scoreA - m.scoreB);
    });

    // TEAM B
    teamB.forEach(uid=>{
      if(!table[uid]) return;

      table[uid].matchPlayed++;

      if(!teamAWin){
        table[uid].win++;
        table[uid].points += 3;
      }else{
        table[uid].lose++;
      }

      table[uid].scoreDiff += (m.scoreB - m.scoreA);
    });

  });

  const result = Object.values(table);

  // SORT
  result.sort((a,b)=>{
    if(b.win !== a.win) return b.win - a.win;
    if(b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    return b.matchPlayed - a.matchPlayed;
  });

  return result;
}

export function attachRankMovement(current, previous){

  const prevMap = {};

  // build previous rank map
  previous.forEach((p, index)=>{
    prevMap[p.uid] = index + 1;
  });

  return current.map((p, index)=>{

    const currentRank = index + 1;
    const prevRank = prevMap[p.uid];

    let movement = 0;

    if(prevRank === undefined){
      // player baru (tidak ada di previous month)
      movement = 0; // bisa nanti di UI jadi "NEW"
    }else if(prevRank > currentRank){
      // naik rank
      movement = prevRank - currentRank;
    }else if(prevRank < currentRank){
      // turun rank
      movement = -(currentRank - prevRank);
    }

    return {
      ...p,
      rank: currentRank,
      movement
    };
  });

}

export async function saveChampionClub(monthKey, data){

  await setDoc(
  doc(db,"championClubMonthly",monthKey),
  {
    monthKey,
    createdAt: new Date(),
    rankings: data
  }
);

}

export async function loadChampionHistory(monthKey){

  const snap = await getDoc(
  doc(db,"championClubMonthly",monthKey)
);

if(!snap.exists()) return null;

return snap.data().rankings;
}
