import { db } from "../firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  increment
} from "../firestore.js";

export async function incrementAttendance(uid){

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data() || {};

  await setDoc(
    userRef,
    { attendanceCount: increment(1) },
    { merge: true }
  );

  const currentMonth = new Date().toISOString().slice(0,7);

  const leaderboardRef = doc(
    db,
    "leaderboards",
    currentMonth,
    "attendance",
    uid
  );

  await setDoc(
    leaderboardRef,
    {
      total: increment(1),
      name: userData.name || "Member"
    },
    { merge: true }
  );
}
