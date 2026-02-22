import { recalculateUserStats } from "./userStats.js";

const stats = recalculateUserStats({
  totalTopup: item.totalTopup,
  totalPayment: item.totalPayment,
  membership: userData.membership
});

await updateDoc(userRef, {
  level: stats.level,
  exp: stats.expTotal,
  gPoint: stats.gPoint
});

