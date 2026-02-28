// ===============================
// GILT STORE DATA ENGINE
// ===============================

// ===== IMAGE BASE PATH =====
const BASE_IMAGE_URL =
  "https://raw.githubusercontent.com/USERNAME/REPO/main/store/products/";

// ===============================
// OFFICIAL PRODUCTS (BUY WITH MONEY)
// ===============================
export const STORE_PRODUCTS = [
  {
    id: "jersey_black",
    type: "money",
    name: "GILT Jersey Black Edition",
    price: 250000,
    stock: 20,
    sizes: ["S", "M", "L", "XL"],
    category: "apparel",
    image: BASE_IMAGE_URL + "jersey-black.webp",
    active: true,
  },
  {
    id: "cap_classic",
    type: "money",
    name: "GILT Cap Classic",
    price: 85000,
    stock: 15,
    sizes: null,
    category: "accessories",
    image: BASE_IMAGE_URL + "cap-classic.webp",
    active: true,
  },
  {
    id: "sticker_pack",
    type: "money",
    name: "GILT Sticker Pack",
    price: 15000,
    stock: 25,
    sizes: null,
    category: "accessories",
    image: BASE_IMAGE_URL + "sticker-pack.webp",
    active: true,
  },
];

// ===============================
// NORMAL REWARDS (REDEEM WITH GPOINTS)
// ===============================
export const STORE_REWARDS = [
  {
    id: "semi_08mar_1800",
    type: "point",
    name: "Voucher Semi Private - 08 Mar 18:00",
    sessionId: "session_108mar_1700",
    pointCost: 375,
    quota: 2,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    active: true,
    isFlash: false,
  },
];

// ===============================
// FLASH REDEEM (AUTO BY TIME)
// ===============================
export const STORE_FLASH = [
  {
    id: "flash_semi_15feb",
    type: "point",
    name: "FLASH - Semi Private 15 Feb 18:00",
    sessionId: "session_15feb_1800",
    normalPointCost: 5000,
    flashPointCost: 500,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    startTime: "2026-02-28T00:00:00+07:00",
endTime:   "2026-03-06T23:59:00+07:00",
    perUserLimit: 1,
    active: true,
    isFlash: true,
  },
];

// ===============================
// REWARD POINT CALCULATION
// ===============================

export function calculateRewardPoints(role, totalAmount) {
  const base = Math.floor(totalAmount / 50000);

  if (role === "member") return base * 1000;
  if (role === "verified") return base * 1500;
  if (role === "vvip") return base * 2500;

  return 0;
}

// ===============================
// FLASH ACTIVE CHECK
// ===============================

export function isFlashActive(item) {
  if (!item.isFlash || !item.active) return false;

  const now = new Date();
  const start = new Date(item.startTime);
  const end = new Date(item.endTime);

  return now >= start && now <= end && item.redeemedCount < item.quota;
}
