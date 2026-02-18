import {
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderRanking() {

  const content = document.getElementById("content");

  const currentMonth = new Date().toISOString().slice(0,7); 
  // format: 2026-03

  const leaderboardRef = collection(
    db,
    "rankings",
    currentMonth,
    "leaderboard"
  );

  const q = query(
    leaderboardRef,
    orderBy("points", "desc"),
    limit(20)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    content.innerHTML = "<h2>Ranking</h2><p>Belum ada data ranking bulan ini.</p>";
    return;
  }

  let html = "<h2>Ranking Bulan Ini</h2>";

  let rank = 1;

  snap.forEach(docSnap => {
    const data = docSnap.data();

    html += `
      <div class="rank-item">
        <strong>#${rank}</strong> - ${data.name} 
        (${data.points} pts)
      </div>
    `;

    rank++;
  });

  content.innerHTML = html;
}
