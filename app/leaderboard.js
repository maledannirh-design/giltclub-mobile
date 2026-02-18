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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ======================================
// INCREMENT ATTENDANCE
// ======================================
export async function recordAttendance() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  // Update total lifetime attendance
  await updateDoc(doc(db, "users", uid), {
    attendanceCount: increment(1)
  });

  // Update monthly leaderboard
  const currentMonth = new Date().toISOString().slice(0,7);

  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();

  await setDoc(
    doc(db, "leaderboards", currentMonth, "attendance", uid),
    {
      total: increment(1),
      name: userData.name
    },
    { merge: true }
  );
}


export async function renderAttendanceLeaderboard() {

  const content = document.getElementById("content");

  const currentMonth = new Date().toISOString().slice(0,7);

  const q = query(
    collection(db, "leaderboards", currentMonth, "attendance"),
    orderBy("total", "desc"),
    limit(20)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    content.innerHTML = "<h2>Attendance Leaderboard</h2><p>Belum ada data bulan ini.</p>";
    return;
  }

  let html = "<h2>Most Active Members</h2>";

  let rank = 1;

  snap.forEach(docSnap => {
    const data = docSnap.data();

    html += `
      <div class="rank-item">
        <strong>#${rank}</strong> - ${data.name} 
        (${data.total} sessions)
      </div>
    `;

    rank++;
  });

  content.innerHTML = html;
}
