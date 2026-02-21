import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "./firestore.js";

/* ============================
   DASHBOARD MAIN
============================ */
export async function loadDashboard(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="page-fade">
      <div class="dashboard-wrapper">

        <div class="dashboard-header">
          <h2>Dashboard</h2>
          <div id="roleBadge" class="role-badge"></div>
        </div>

        <div class="summary-grid">
          <div class="metric-card" id="cardAttendance"></div>
          <div class="metric-card" id="cardWallet"></div>
          <div class="metric-card" id="cardRank"></div>
          <div class="metric-card" id="cardSessions"></div>
          <div class="metric-card admin-only" id="cardRevenue"></div>
        </div>
        <div id="unreadSection" class="unread-section hidden">
  <div class="unread-header">
    <h3>Unread Messages</h3>
    <span id="unreadCountBadge" class="badge"></span>
  </div>

  <div id="unreadList"></div>
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
    </div>
  `;

  await loadUserSummary();
  await loadLeaderboard();
  await loadMiniLedger();
  await loadUnreadMessages();
}

/* ============================
   USER SUMMARY
============================ */
async function loadUserSummary(){

  const user = auth.currentUser;
  if(!user) return;

  const userSnap = await getDoc(doc(db,"users",user.uid));
  if(!userSnap.exists()) return;

  const userData = userSnap.data();

  // Role
  const roleBadge = document.getElementById("roleBadge");
  if(roleBadge){
    roleBadge.innerText = userData.role || "member";
  }

  // Wallet
  const cardWallet = document.getElementById("cardWallet");
  if(cardWallet){
    cardWallet.innerHTML = `
      <div class="metric-label">Wallet Balance</div>
      <div class="metric-value">Rp ${formatCurrency(userData.walletBalance || 0)}</div>
    `;
  }

  // Total Sessions (lifetime)
  const cardSessions = document.getElementById("cardSessions");
  if(cardSessions){
    cardSessions.innerHTML = `
      <div class="metric-label">Total Sessions</div>
      <div class="metric-value">${userData.attendanceCount || 0}</div>
    `;
  }

  // Monthly attendance & rank
  const currentMonth = new Date().toISOString().slice(0,7);

  const statSnap = await getDoc(
    doc(db,"leaderboards",currentMonth,"attendance",user.uid)
  );

  let attendance = 0;
  let rank = "-";

  if(statSnap.exists()){
    const stat = statSnap.data();
    attendance = stat.total || 0;
  }

  const cardAttendance = document.getElementById("cardAttendance");
  if(cardAttendance){
    cardAttendance.innerHTML = `
      <div class="metric-label">Attendance (Month)</div>
      <div class="metric-value">${attendance}</div>
    `;
  }

  const cardRank = document.getElementById("cardRank");
  if(cardRank){
    cardRank.innerHTML = `
      <div class="metric-label">Rank</div>
      <div class="metric-value">${rank}</div>
    `;
  }

  // Admin revenue (optional future)
  if(userData.role !== "admin"){
    const cardRevenue = document.getElementById("cardRevenue");
    if(cardRevenue) cardRevenue.remove();
  }
}

/* ============================
   LEADERBOARD
============================ */
async function loadLeaderboard(){

  const currentMonth = new Date().toISOString().slice(0,7);

  const q = query(
    collection(db,"leaderboards",currentMonth,"attendance"),
    orderBy("total","desc"),
    limit(10)
  );

  const snap = await getDocs(q);

  let html = "";
  let position = 1;

  snap.forEach(docSnap=>{
    const data = docSnap.data();

    html += `
      <div class="leader-item">
        <div>#${position} ${data.name || "-"}</div>
        <div>${data.total || 0} sessions</div>
      </div>
    `;

    position++;
  });

  const leaderboardList = document.getElementById("leaderboardList");
  if(leaderboardList){
    leaderboardList.innerHTML =
      html || `<div class="text-muted">No data</div>`;
  }
}

/* ============================
   MINI LEDGER
============================ */
async function loadMiniLedger(){

  const user = auth.currentUser;
  if(!user) return;

  const q = query(
    collection(db,"wallet_transactions"),
    where("userId","==",user.uid),
    orderBy("createdAt","desc"),
    limit(5)
  );

  const snap = await getDocs(q);

  let html = "";

  snap.forEach(docSnap=>{

    const data = docSnap.data();

    const date = data.createdAt?.seconds
      ? new Date(data.createdAt.seconds * 1000)
          .toLocaleDateString("id-ID")
      : "-";

    html += `
      <div class="ledger-item">
        <div>
          <div>${data.type}</div>
          <div class="text-muted">${date}</div>
        </div>
        <div>
          Rp ${formatCurrency(data.amount || 0)}
        </div>
      </div>
    `;
  });

  if(html === ""){
    html = `<div class="text-muted">No recent activity</div>`;
  }

  const walletMiniLedger = document.getElementById("walletMiniLedger");
  if(walletMiniLedger){
    walletMiniLedger.innerHTML = html;
  }
}

/* ============================
   UTIL
============================ */
function formatCurrency(num){
  return Number(num || 0).toLocaleString("id-ID");
}

async function loadUnreadMessages() {
  const user = auth.currentUser;
  if (!user) return;

  const unreadSection = document.getElementById("unreadSection");
  const unreadList = document.getElementById("unreadList");
  const unreadCountBadge = document.getElementById("unreadCountBadge");

  unreadList.innerHTML = "";

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", user.uid),
    where(`unreadCountByUser.${user.uid}`, ">", 0),
    orderBy("lastMessageTime", "desc"),
    limit(3)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    unreadSection.classList.add("hidden");
    return;
  }

  unreadSection.classList.remove("hidden");
  unreadCountBadge.textContent = snapshot.size;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    const item = document.createElement("div");
    item.className = "unread-item";
    item.onclick = () => {
      window.navigate("chat");
      localStorage.setItem("activeChatId", docSnap.id);
    };

    item.innerHTML = `
      <img src="${data.otherUserAvatar || 'default-avatar.png'}" class="unread-avatar"/>
      <div class="unread-content">
        <div class="unread-name">${data.otherUserName}</div>
        <div class="unread-preview">${data.lastMessage}</div>
        <div class="unread-time">${formatTime(data.lastMessageTime?.toDate())}</div>
      </div>
    `;

    unreadList.appendChild(item);
  });
}

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
