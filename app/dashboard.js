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
      </div>

      <div class="panel">
        <h3>Monthly Leaderboard</h3>
        <div id="leaderboardList"></div>
      </div>

    </div>
  `;

  await loadUserSummary();
  await loadLeaderboard();
}
