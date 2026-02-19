import { auth, db } from "./firebase.js";

import {
  doc,
  updateDoc,
  increment,
  setDoc,
  getDoc,
  limit,
  orderBy,
  query,
  collection,
  getDocs
} from "./firestore.js";

import { getMonthlyTopUsers } from "./services/leaderboardService.js";
import { getCache, setCache } from "../cache.js";

// ======================================
// INCREMENT ATTENDANCE
// ======================================
export async function recordAttendance() {

  const user = auth.currentUser;
  if (!user) return;

  try {
    await incrementAttendance(user.uid);
  } catch(e){
    console.error(e);
  }
}



// ======================================
// RENDER LEADERBOARD
// ======================================
export async function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = new Date().toISOString().slice(0,7);

  const users = await getMonthlyTopUsers(currentMonth, 20);

  if(!users.length){
    content.innerHTML = `
      <h2>Attendance Leaderboard</h2>
      <p>Belum ada data bulan ini.</p>
    `;
    return;
  }

  let html = `<h2>Most Active Members</h2>`;
  let rank = 1;

  users.forEach(user=>{
    html += `
      <div class="rank-item">
        <strong>#${rank}</strong> - ${user.name || "Member"}
        (${user.total || 0} sessions)
      </div>
    `;
    rank++;
  });

  content.innerHTML = html;
}

async function loadLeaderboard(){

  const currentMonth = new Date().toISOString().slice(0,7);

  const users = await getMonthlyTopUsers(currentMonth, 10);

  let html = "";
  let position = 1;

  users.forEach(user => {
    html += `
      <div class="leader-item">
        <div>#${position} ${user.name || "-"}</div>
        <div>${user.attendance || 0} sessions</div>
      </div>
    `;
    position++;
  });

  const leaderboardList = document.getElementById("leaderboardList");
  if(leaderboardList){
    leaderboardList.innerHTML = html || `<div style="opacity:.6;font-size:13px;">No data</div>`;
  }
}
