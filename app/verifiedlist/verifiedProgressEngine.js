export function getVerifiedProgress(user){

  if(!user){
    return null;
  }

  // ===== ATTENDANCE (MONTHLY) =====
  const attendanceRaw = user.monthlyAttendance || 0;
  const attendanceMax = 2;
  const attendanceValue = Math.min(attendanceRaw, attendanceMax);

  // ===== FINANCIAL (MONTHLY) =====
  const payment = user.monthlyPayment || 0;
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
      max: attendanceMax,
      raw: attendanceRaw
    },
    financial: {
      value: financialValue,
      max: financialMax,
      rawPayment: payment,
      source: source
    }
  };
}
