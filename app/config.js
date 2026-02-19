export const CANCEL_POLICY = {
  deadlineHours: 3, // tidak bisa cancel kalau kurang dari ini

  tiers: [
    { minHoursBefore: 48, refundRate: 1.0 },
    { minHoursBefore: 36, refundRate: 0.5 },
    { minHoursBefore: 0,  refundRate: 0.0 }
  ]
};
