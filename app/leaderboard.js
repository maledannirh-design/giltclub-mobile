import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc
} from "./firestore.js";


function getRankReward(rank){

  if(rank === 1)
    return "🎟️ Voucher Semi Private GRATIS";

  if(rank === 2)
    return "🎟️ Voucher Mabar GRATIS + 1500 GPoint";

  if(rank === 3)
    return "🎟️ Voucher Mabar GRATIS";

  if(rank >=4 && rank <=5)
    return "⭐ Bonus Bulanan 2500 GPoint";
  
   if(rank >=6 && rank <=7)
    return "⭐ Bonus Bulanan 1500 GPoint";
  
  if(rank >=8 && rank <=10)
    return "⭐ Bonus Bulanan 1000 GPoint";

  return "";

}


/* ======================================================
   DATE UTIL
====================================================== */

function getCurrentMonthKey(){
  return new Date().toISOString().slice(0,7);
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
