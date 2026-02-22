// userStats.js

export function recalculateUserStats({
  totalTopup = 0,
  totalPayment = 0,
  membership = "MEMBER"
}) {

  // =============================
  // LEVEL & EXP (FROM TOTAL TOPUP)
  // =============================

  const level = Math.floor(totalTopup / 50000);

  const expTotal = Math.floor(totalTopup / 500) * 10;
  const expCurrent = expTotal % 1000;

  // =============================
  // GPOINT (FROM TOTAL PAYMENT)
  // =============================

  let gPointPerLevel = 150;

  if(membership === "VVIP"){
    gPointPerLevel = 250;
  }

  const gPoint = Math.floor(totalPayment / 50000) * gPointPerLevel;

  // =============================
  // RETURN OBJECT
  // =============================

  return {
    level,
    expTotal,
    expCurrent,
    gPoint
  };
}
