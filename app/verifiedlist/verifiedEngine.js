export function evaluateVerifiedStatus(user){

  if(!user) return {verified:false, warning:false};

  if(user.membership === "VVIP"){
    return {verified:true, warning:false};
  }

  const attendance = user.lastMonthAttendance || 0;
  const payment = user.lastMonthPayment || 0;
  const balance = user.walletBalance || 0;

  const financialOk =
    payment >= 250000 || balance >= 250000;

  const attendanceOk =
    attendance >= 2;

  // verified status
  const verified =
    attendanceOk && financialOk;

  // warning jika finansial kurang
  const warning =
    attendanceOk && !financialOk;

  return {verified, warning};

}
