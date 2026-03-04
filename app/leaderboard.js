import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "./firestore.js";

/* ======================================================
   DATE UTIL
====================================================== */
function getTodayKey(){
  return new Date().toISOString().split("T")[0];
}

function getCurrentMonthKey(){
  return new Date().toISOString().slice(0,7);
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
        total: 0,
        monthly: 0
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
   2️⃣ GENERATE MONTHLY SNAPSHOT (TOP 10)
   Save to: leaderboards/{YYYY-MM}
====================================================== */
async function generateMonthlySnapshot(){

  const currentMonth = getCurrentMonthKey();

  const q = query(
    collection(db,"users"),
    orderBy("monthlyContribution","desc"),
    orderBy("attendanceCount","desc"),
    limit(10)
  );

  const snap = await getDocs(q);

  const top10 = [];

  snap.forEach(docSnap=>{
    const data = docSnap.data();

    top10.push({
      userId: docSnap.id,
      name: data.name || data.username || "Member",
      monthlyContribution: data.monthlyContribution || 0,
      attendanceCount: data.attendanceCount || 0
    });
  });

  await setDoc(doc(db,"leaderboards",currentMonth),{
    month: currentMonth,
    generatedAt: serverTimestamp(),
    top10: top10
  });

  return top10;
}

/* ======================================================
   3️⃣ ENSURE DAILY SYNC (1x PER HARI)
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
   4️⃣ RENDER LEADERBOARD
====================================================== */
export async function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = getCurrentMonthKey();

  // 1. Pastikan sudah sync hari ini
  await ensureDailySync();

  // 2. Ambil snapshot bulan ini
  const snapshotRef = doc(db,"leaderboards",currentMonth);
  const snapshotSnap = await getDoc(snapshotRef);

  let topUsers = [];

  if(snapshotSnap.exists()){
    topUsers = snapshotSnap.data().top10 || [];
  }else{
    topUsers = await generateMonthlySnapshot();
  }

  if(!topUsers.length){
    content.innerHTML = `
      <div style="padding:20px;">
        <h2>Leaderboard Kehadiran</h2>
        <p>Belum ada data bulan ini.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="padding:20px;">
      <h2>🏆 Leaderboard Bulan ${currentMonth}</h2>
  `;

  topUsers.forEach((user,index)=>{

    let crown = "";
    let crownSize = "18px";

    if(index === 0){ crown = "🥇"; crownSize="26px"; }
    if(index === 1){ crown = "🥈"; crownSize="22px"; }
    if(index === 2){ crown = "🥉"; crownSize="20px"; }

    html += `
      <div style="
        background:rgba(255,255,255,.95);
        padding:14px;
        border-radius:14px;
        margin-bottom:12px;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <div>
          <div style="font-weight:600;">
            ${crown ? `<span style="font-size:${crownSize};margin-right:6px;">${crown}</span>` : ""}
            #${index+1} ${user.name}
          </div>
          <div style="font-size:12px;opacity:.6;">
            Total Hadir: ${user.attendanceCount}
          </div>
        </div>
        <div>
          ${user.monthlyContribution} sesi bulan ini
        </div>
      </div>
    `;
  });

  html += `</div>`;

  content.innerHTML = html;
}
