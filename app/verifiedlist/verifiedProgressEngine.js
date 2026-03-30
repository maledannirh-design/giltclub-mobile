export function getVerifiedProgress(user){

  if(!user){
    return null;
  }

  // ===== ATTENDANCE =====
  const attendanceRaw = user.lastMonthAttendance || 0;
  const attendanceMax = 2;
  const attendanceValue = Math.min(attendanceRaw, attendanceMax);

  // ===== FINANCIAL =====
  const payment = user.lastMonthPayment || 0;
  const balance = user.walletBalance || 0;
  const financialMax = 250000;

  let financialValue = 0;
  let source = "payment";

  if(payment >= financialMax){
    financialValue = financialMax;
    source = "payment";
  }else{
    financialValue = Math.min(balance, financialMax);
    source = "balance";
  }

  return {
    attendance: {
      value: attendanceValue,
      max: attendanceMax
    },
    financial: {
      value: financialValue,
      max: financialMax,
      source: source
    }
  };
}
