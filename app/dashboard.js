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

  snap.forEach(doc=>{
    const data = doc.data();

    const sign = data.type === "credit" ? "+" : "-";

    html += `
      <div class="ledger-item">
        <div>
          <div class="ledger-desc">${data.description}</div>
          <div class="ledger-date">${new Date(data.createdAt.seconds*1000).toLocaleDateString()}</div>
        </div>
        <div class="ledger-amount ${data.type}">
          ${sign} Rp ${formatCurrency(data.amount)}
        </div>
      </div>
    `;
  });

  document.getElementById("walletMiniLedger").innerHTML = html;
}

