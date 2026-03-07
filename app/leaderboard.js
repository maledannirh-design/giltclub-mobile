import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc
} from "./firestore.js";

/* ======================================================
   DATE UTIL
====================================================== */

function getCurrentMonthKey(){
  return new Date().toISOString().slice(0,7);
}


/* ======================================================
   MONTHLY RESET CHECK
   reset monthlyContribution saat bulan berganti
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
   GET TOP USERS
====================================================== */

async function getTopUsers(){

  const q = query(
    collection(db,"users"),
    where("monthlyContribution",">",0),
    orderBy("monthlyContribution","desc"),
    orderBy("attendanceCount","desc"),
    limit(10)
  );

  const snap = await getDocs(q);

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

  return users;
}


/* ======================================================
   RENDER LEADERBOARD
====================================================== */

export async function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = getCurrentMonthKey();

  const topUsers = await getTopUsers();

  if(!topUsers.length){

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

  topUsers.forEach((user,index)=>{

    let crown = "";
    let crownSize = "18px";

    if(index === 0){
      crown = "🥇";
      crownSize = "26px";
    }

    if(index === 1){
      crown = "🥈";
      crownSize = "22px";
    }

    if(index === 2){
      crown = "🥉";
      crownSize = "20px";
    }

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

        <div style="font-weight:600;">
          ${user.monthlyContribution} sesi bulan ini
        </div>

      </div>

    `;

  });

  html += `</div>`;

  content.innerHTML = html;

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
