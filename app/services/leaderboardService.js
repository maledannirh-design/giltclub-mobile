import { db } from "../firebase.js";
import { 
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "../firestore.js";
import { getCache, setCache } from "../cache.js";

export async function getMonthlyTopUsers(month, top = 10){

  const cacheKey = `leaderboard_${month}_${top}`;
  const cached = getCache(cacheKey, 60000);

  if (cached) return cached;

  const leaderboardRef = collection(db, "leaderboards", month, "attendance");

  const q = query(
    leaderboardRef,
    orderBy("total", "desc"),
    limit(top)
  );

  const snap = await getDocs(q);

  const result = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  setCache(cacheKey, result);

  return result;
}
