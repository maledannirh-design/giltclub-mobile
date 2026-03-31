export function getVerifiedProgress(user){

  if(!user){
    return null;
  }

  // ===== ATTENDANCE (MONTHLY) =====
  const attendanceRaw = user.monthlyContribution || 0;
  const attendanceMax = 2;
  const attendanceValue = Math.min(attendanceRaw, attendanceMax);

  // ===== FINANCIAL (MONTHLY) =====
  const payment = user.monthlyPayment || 0;
  const balance = user.walletBalance || 0;
  const financialMax = 250000;

  // ✅ AMBIL NILAI TERBESAR (BIAR PROGRESS TIDAK TURUN)
  const rawValue = Math.max(payment, balance);

  // ✅ CLAMP KE MAX
  const financialValue = Math.min(rawValue, financialMax);

  // ✅ DETEKSI SOURCE (OPSIONAL, BUAT DEBUG / UI)
  const source = payment >= balance ? "payment" : "balance";

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
      rawBalance: balance,
      source: source
    }
  };
}
