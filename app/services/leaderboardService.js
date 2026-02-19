import { db } from "../firebase.js";
import { 
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "../firestore.js";

export async function getMonthlyTopUsers(month, top = 10){

  const leaderboardRef = collection(db, "monthly_stats", month, "users");

  const q = query(
    leaderboardRef,
    orderBy("attendance", "desc"),
    limit(top)
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
