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

  data.forEach((p, index)=>{

    const rank = index + 1;

    const el = document.createElement("div");
    el.className = "mm-entry";

    el.innerHTML = `
      <div class="mm-rank">#${rank}</div>

      <div class="mm-name">${p.name}</div>

      <div class="mm-stat">
        W:${p.win} | L:${p.lose}
      </div>

      <div class="mm-diff ${p.scoreDiff >= 0 ? "mm-pos" : "mm-neg"}">
        ${p.scoreDiff > 0 ? "+" : ""}${p.scoreDiff}
      </div>
    `;

    container.appendChild(el);
  });

}

export async function buildChampionClub(monthKey){

  const matchesSnap = await getDocs(collection(db,"matches"));
const usersSnap = await getDocs(collection(db,"users"));

  // mapping user biar cepat
  const usersMap = {};
  usersSnap.forEach(doc=>{
    usersMap[doc.id] = doc.data();
  });

  const table = {};

  function initPlayer(uid){
    if(!table[uid]){
      table[uid] = {
        uid,
        name: usersMap[uid]?.fullName || usersMap[uid]?.username || "Unknown",
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

    const teamA = [m.a1, m.a2];
    const teamB = [m.b1, m.b2];

    const diff = m.scoreA - m.scoreB;

    const teamAWin = m.scoreA > m.scoreB;

    [...teamA, ...teamB].forEach(uid=>initPlayer(uid));

    // update team A
teamA.forEach(uid=>{
  table[uid].matchPlayed++;

  if(teamAWin){
    table[uid].win++;
    table[uid].points += 3;
  }else{
    table[uid].lose++;
  }

  // ✅ FIX: pakai perspective A
  table[uid].scoreDiff += (m.scoreA - m.scoreB);
});

// update team B
teamB.forEach(uid=>{
  table[uid].matchPlayed++;

  if(!teamAWin){
    table[uid].win++;
    table[uid].points += 3;
  }else{
    table[uid].lose++;
  }

  // ✅ FIX: pakai perspective B
  table[uid].scoreDiff += (m.scoreB - m.scoreA);
});

  });

  // convert ke array
  const result = Object.values(table);

  // SORTING (INI KRUSIAL)
  result.sort((a,b)=>{
    if(b.win !== a.win) return b.win - a.win;
    if(b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    return b.matchPlayed - a.matchPlayed;
  });

  return result;
}

export function attachRankMovement(current, previous){

  const prevMap = {};

  previous.forEach((p, index)=>{
    prevMap[p.uid] = index + 1;
  });

  return current.map((p, index)=>{

    const currentRank = index + 1;
    const prevRank = prevMap[p.uid] || currentRank;

    let movement = 0;

    if(prevRank > currentRank){
      movement = prevRank - currentRank; // naik
    }else if(prevRank < currentRank){
      movement = -(currentRank - prevRank); // turun
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
