import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  getDoc
} from "./firestore.js";

/* ======================================================
   DATE UTIL
====================================================== */

function getCurrentMonthKey(){
  return new Date().toISOString().slice(0,7);
}

function getTodayKey(){
  return new Date().toISOString().split("T")[0];
}

/* ======================================================
   1️⃣ SYNC ATTENDANCE SUMMARY FROM BOOKINGS
====================================================== */

export async function syncAttendanceSummary(){

  const todayKey = getTodayKey();
  const currentMonth = getCurrentMonthKey();

  const bookingsRef = collection(db,"bookings");

  const q = query(
    bookingsRef,
    where("attendance","==",true)
  );

  const snap = await getDocs(q);

  const userMap = {};

  snap.forEach(docSnap=>{

    const data = docSnap.data();

    const userId = data.userId;
    const attendedAt = data.attendedAt?.toDate?.();

    if(!userId || !attendedAt) return;

    if(!userMap[userId]){
      userMap[userId] = {
        total:0,
        monthly:0
      };
    }

    userMap[userId].total += 1;

    const monthKey = attendedAt.toISOString().slice(0,7);

    if(monthKey === currentMonth){
      userMap[userId].monthly += 1;
    }

  });

  for(const uid in userMap){

    const userRef = doc(db,"users",uid);

    await updateDoc(userRef,{
      attendanceCount: userMap[uid].total,
      monthlyContribution: userMap[uid].monthly,
      monthlyKey: currentMonth,
      lastAttendanceSync: todayKey
    });

  }

  return true;
}


/* ======================================================
   2️⃣ ENSURE DAILY SYNC (1x PER HARI)
====================================================== */

async function ensureDailySync(){

  const user = auth.currentUser;
  if(!user) return;

  const userRef = doc(db,"users",user.uid);
  const userSnap = await getDoc(userRef);

  if(!userSnap.exists()) return;

  const todayKey = getTodayKey();
  const lastSync = userSnap.data().lastAttendanceSync;

  if(lastSync !== todayKey){
    await syncAttendanceSummary();
  }

}


/* ======================================================
   3️⃣ MONTHLY RESET CHECK
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
   4️⃣ GET TOP 10 USERS
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
   5️⃣ RENDER LEADERBOARD
====================================================== */

export async function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = getCurrentMonthKey();

  /* jalankan sync harian */
  await ensureDailySync();

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
   MONTH FORMAT
====================================================== */

function formatMonthID(monthKey){

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  const [year,month] = monthKey.split("-");

  return `${months[parseInt(month)-1]} ${year}`;
}
