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

  try {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;

    // Ensure user doc exists before update
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const userData = userSnap.data() || {};

    // Update lifetime attendance safely
    await setDoc(
      userRef,
      {
        attendanceCount: increment(1)
      },
      { merge: true }
    );

    // Monthly leaderboard key: YYYY-MM
    const currentMonth = new Date().toISOString().slice(0, 7);

    const leaderboardRef = doc(
      db,
      "leaderboards",
      currentMonth,
      "attendance",
      uid
    );

    // Update leaderboard safely with merge
    await setDoc(
      leaderboardRef,
      {
        total: increment(1),
        name: userData.name || "Member"
      },
      { merge: true }
    );

  } catch (error) {
    console.error("recordAttendance error:", error);
  }
}


// ======================================
// RENDER LEADERBOARD
// ======================================
export async function renderAttendanceLeaderboard() {

  try {
    const content = document.getElementById("content");
    if (!content) return;

    const currentMonth = new Date().toISOString().slice(0, 7);

    const leaderboardCol = collection(
      db,
      "leaderboards",
      currentMonth,
      "attendance"
    );

    const q = query(
      leaderboardCol,
      orderBy("total", "desc"),
      limit(20)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      content.innerHTML = `
        <h2>Attendance Leaderboard</h2>
        <p>Belum ada data bulan ini.</p>
      `;
      return;
    }

    let html = `<h2>Most Active Members</h2>`;
    let rank = 1;

    snap.forEach(docSnap => {
      const data = docSnap.data() || {};

      html += `
        <div class="rank-item">
          <strong>#${rank}</strong> - ${data.name || "Member"} 
          (${data.total || 0} sessions)
        </div>
      `;

      rank++;
    });

    content.innerHTML = html;

  } catch (error) {
    console.error("renderAttendanceLeaderboard error:", error);
  }
}
