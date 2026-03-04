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
// RENDER LEADERBOARD (BEACH STYLE)
// ======================================
export async function renderAttendanceLeaderboard(){

  const content = document.getElementById("content");
  if(!content) return;

  const currentMonth = new Date().toISOString().slice(0,7);

  const users = await getMonthlyTopUsers(currentMonth, 10);

  if(!users.length){
    content.innerHTML = `
      <div class="leaderboard-wrapper">
        <h2>Leaderboard Kehadiran</h2>
        <p>Belum ada data bulan ini.</p>
      </div>
    `;
    return;
  }

  let topThree = users.slice(0,3);
  let others = users.slice(3,10);

  let html = `
  <div class="leaderboard-wrapper">
    <h2>🏖 Leaderboard Kehadiran</h2>

    <div class="top-three">
  `;

  topThree.forEach((user, index)=>{

    let crown = "";
    let sizeClass = "";

    if(index === 0){
      crown = "🥇";
      sizeClass = "gold";
    }
    if(index === 1){
      crown = "🥈";
      sizeClass = "silver";
    }
    if(index === 2){
      crown = "🥉";
      sizeClass = "bronze";
    }

    html += `
      <div class="top-card ${sizeClass}">
        <div class="avatar">
          <span class="crown">${crown}</span>
        </div>
        <div class="info">
          <div class="name">${user.fullname || user.username || "Member"}</div>
          <div class="level">${user.playingLevel || "-"}</div>
          <div class="stats">
            Kontribusi: ${user.monthlyContribution || 0} |
            Total Hadir: ${user.attendanceCount || 0}
          </div>
        </div>
      </div>
    `;
  });

  html += `
    </div>
    <div class="other-ranks">
  `;

  let position = 4;

  others.forEach(user=>{
    html += `
      <div class="rank-item">
        <div>#${position} ${user.fullname || user.username || "-"}</div>
        <div>${user.monthlyContribution || 0} kontribusi</div>
      </div>
    `;
    position++;
  });

  html += `
    </div>
  </div>
  `;

  content.innerHTML = html;
}
