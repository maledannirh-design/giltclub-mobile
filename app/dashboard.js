import { 
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";


// ============================
// DASHBOARD MODULE
// ============================

async function loadDashboard(){

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="dashboard-wrapper">

      <div class="dashboard-header">
        <h2>Dashboard</h2>
        <div id="roleBadge" class="role-badge"></div>
      </div>

      <div class="summary-grid">
        <div class="card" id="cardAttendance"></div>
        <div class="card" id="cardWallet"></div>
        <div class="card" id="cardRank"></div>
        <div class="card" id="cardSessions"></div>
        <div class="card admin-only" id="cardRevenue"></div>
      </div>

      <div class="panel">
        <h3>Attendance Trend</h3>
        <canvas id="attendanceChart" height="120"></canvas>
      </div>

      <div class="panel">
        <h3>Monthly Leaderboard</h3>
        <div id="leaderboardList"></div>
      </div>

      <div class="panel">
        <h3>Recent Wallet Activity</h3>
        <div id="walletMiniLedger"></div>
      </div>

    </div>
  `;

  await loadUserSummary();
  await loadLeaderboard();
  await loadMiniLedger();
  await loadAttendanceChart();
}


async function loadUserSummary(){

  const user = JSON.parse(localStorage.getItem("g_user"));
  if(!user) return;

  const userRef = doc(db,"users",user.uid);
  const userSnap = await getDoc(userRef);

  if(!userSnap.exists()) return;

  const userData = userSnap.data();

  // ROLE
  document.getElementById("roleBadge").innerText = userData.role || "member";

  // WALLET
  document.getElementById("cardWallet").innerHTML = `
    <div class="label">Wallet Balance</div>
    <div class="value">Rp ${formatCurrency(userData.balance || 0)}</div>
  `;

  // TOTAL SESSION
  document.getElementById("cardSessions").innerHTML = `
    <div class="label">Total Sessions</div>
    <div class="value">${userData.totalSessions || 0}</div>
  `;

  // MONTHLY STATS
  const currentMonth = new Date().toISOString().slice(0,7);

  const statRef = doc(db,"monthly_stats",currentMonth,"users",user.uid);
  const statSnap = await getDoc(statRef);

  let attendance = 0;
  let rank = "-";

  if(statSnap.exists()){
    const stat = statSnap.data();
    attendance = stat.attendance || 0;
    rank = stat.rank || "-";
  }
  
  if(userData.role === "admin"){

  const revenueRef = doc(db,"monthly_revenue",currentMonth);
  const revenueSnap = await getDoc(revenueRef);

  let revenue = 0;
  if(revenueSnap.exists()){
    revenue = revenueSnap.data().total || 0;
  }

  document.getElementById("cardRevenue").innerHTML = `
    <div class="label">Monthly Revenue</div>
    <div class="value">Rp ${formatCurrency(revenue)}</div>
  `;

}else{
  document.getElementById("cardRevenue")?.remove();
}

  document.getElementById("cardAttendance").innerHTML = `
    <div class="label">Attendance (Month)</div>
    <div class="value">${attendance}</div>
  `;

  document.getElementById("cardRank").innerHTML = `
    <div class="label">Rank</div>
    <div class="value">${rank}</div>
  `;
}

async function loadLeaderboard(){

  const currentMonth = new Date().toISOString().slice(0,7);

  const leaderboardRef = collection(db,"monthly_stats",currentMonth,"users");

  const q = query(
    leaderboardRef,
    orderBy("attendance","desc"),
    limit(10)
  );

  const snap = await getDocs(q);

  let html = "";
  let position = 1;

  snap.forEach(doc=>{
    const data = doc.data();

    html += `
      <div class="leader-item">
        <div>#${position} ${data.name}</div>
        <div>${data.attendance} sessions</div>
      </div>
    `;

    position++;
  });

  document.getElementById("leaderboardList").innerHTML = html;
}

async function loadMiniLedger(){

  const user = JSON.parse(localStorage.getItem("g_user"));
  if(!user) return;

  const ledgerRef = collection(db,"wallet_ledger");

  const q = query(
    ledgerRef,
    where("uid","==",user.uid),
    orderBy("createdAt","desc"),
    limit(5)
  );

  const snap = await getDocs(q);

  let html = "";

  snap.forEach(docSnap=>{

    const data = docSnap.data();

    const sign = data.type === "credit" ? "+" : "-";

    // SAFE DATE PARSING
    const date = data.createdAt?.seconds
      ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("id-ID")
      : "-";

    html += `
      <div class="ledger-item">
        <div>
          <div class="ledger-desc">${data.description || "-"}</div>
          <div class="ledger-date">${date}</div>
        </div>
        <div class="ledger-amount ${data.type}">
          ${sign} Rp ${formatCurrency(data.amount || 0)}
        </div>
      </div>
    `;
  });

  if(html === ""){
    html = `<div style="opacity:.6;font-size:13px;">No recent activity</div>`;
  }

  document.getElementById("walletMiniLedger").innerHTML = html;
}


async function loadAttendanceChart(){

  const user = JSON.parse(localStorage.getItem("g_user"));
  if(!user) return;

  const monthsSnap = await getDocs(collection(db,"monthly_stats"));

  let labels = [];
  let dataPoints = [];

  for(const monthDoc of monthsSnap.docs){

    const month = monthDoc.id;

    const statRef = doc(db,"monthly_stats",month,"users",user.uid);
    const statSnap = await getDoc(statRef);

    if(statSnap.exists()){
      labels.push(month);
      dataPoints.push(statSnap.data().attendance || 0);
    }
  }

  // SORT BY MONTH ASCENDING (YYYY-MM format)
  labels = labels.sort();
  dataPoints = labels.map((m,i)=>dataPoints[i]);

  const ctx = document.getElementById("attendanceChart");
  if(!ctx) return;

  // 🔥 DESTROY OLD INSTANCE (ANTI DUPLICATE)
  if(window.attendanceChartInstance){
    window.attendanceChartInstance.destroy();
  }

  window.attendanceChartInstance = new Chart(ctx,{
    type:"line",
    data:{
      labels:labels,
      datasets:[{
        label:"Attendance",
        data:dataPoints,
        borderColor:"#4caf50",
        backgroundColor:"rgba(76,175,80,.2)",
        tension:0.3,
        fill:true
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false}
      },
      scales:{
        y:{
          beginAtZero:true,
          ticks:{precision:0}
        }
      }
    }
  });
}



