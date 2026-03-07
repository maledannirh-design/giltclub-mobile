export function evaluateVerifiedStatus(user){

  if(!user) return {state:"none"};

  if(user.membership === "VVIP"){
    return {state:"vvip"};
  }

  const attendance = user.lastMonthAttendance || 0;
  const payment = user.lastMonthPayment || 0;
  const balance = user.walletBalance || 0;

  const attendanceOk = attendance >= 2;
  const financialOk = payment >= 250000 || balance >= 250000;

  // sudah memenuhi semua syarat
  if(attendanceOk && financialOk){

    if(user.verified){
      return {state:"verified_stay"};
    }

    return {state:"verified_upgrade"};
  }

  // attendance cukup tapi finansial kurang
  if(attendanceOk && !financialOk){

    if(user.verified){
      return {state:"verified_warning"};
    }

    return {state:"upgrade_chance"};
  }

  // attendance kurang
  if(!attendanceOk){

    if(user.verified){
      return {state:"verified_warning"};
    }

    return {state:"attendance_warning"};
  }

  return {state:"none"};
}
