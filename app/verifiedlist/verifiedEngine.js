export function evaluateVerifiedStatus(user) {

  if (!user) return { verified: false, warning: false };

  // VVIP always verified
  if (user.membership === "VVIP") {
    return { verified: true, warning: false };
  }

  const attendance = user.lastMonthAttendance || 0;
  const payment = user.lastMonthPayment || 0;
  const balance = user.walletBalance || 0;

  // attendance mandatory
  if (attendance < 2) {
    return {
      verified: false,
      warning: false
    };
  }

  // financial requirement
  if (payment >= 250000) {
    return {
      verified: true,
      warning: false
    };
  }

  if (balance >= 250000) {
    return {
      verified: true,
      warning: false
    };
  }

  // show warning
  return {
    verified: true,
    warning: true
  };

}
