// ===============================
// GILT STORE DATA ENGINE
// ===============================


// ===============================
// BASE IMAGE PATH
// ===============================
const BASE_IMAGE_URL =
  "https://raw.githubusercontent.com/USERNAME/REPO/main/store/products/";


// ===============================
// OFFICIAL PRODUCTS (BUY WITH MONEY)
// ===============================
export const STORE_PRODUCTS = [
  {
    id: "jersey_club_1stEdition",
    type: "money",
    name: "GILT Jersey 1st Edition",
    price: 645000,
    stock: 15,
    sizes: ["S", "M", "L", "XL"],
    category: "apparel",
    image: BASE_IMAGE_URL + "jersey-black.webp",
    active: true,
  },
  {
    id: "visor_hat_black_rose",
    type: "money",
    name: "GILT Cap Classic-Gold Black",
    price: 85000,
    stock: 4,
    sizes: null,
    category: "accessories",
    image: BASE_IMAGE_URL + "visor-hat-black-rose.webp",
    active: true,
  },
  {
    id: "sticker_pack",
    type: "money",
    name: "GILT Sticker Pack",
    price: 15000,
    stock: 15,
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
    sessionId: "session_08mar_1800",
    pointCost: 9100,
    quota: 2,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    active: true,
    isFlash: false,
  },
];


// ===============================
// FLASH REDEEM (TIME BASED - WITA +08:00)
// ===============================
//
// FORMAT WAJIB:
// "YYYY-MM-DDTHH:MM:SS+08:00"
//
// Contoh:
// 28 Feb 2026 jam 19:00 WITA
// "2026-02-28T19:00:00+08:00"
//
// 06 Mar 2026 jam 20:00 WITA
// "2026-03-06T20:00:00+08:00"
//
// JANGAN pakai +07:00 lagi.
// Semua ke depan pakai +08:00 supaya konsisten WITA.
//

export const STORE_FLASH = [
  {
    id: "flash_semi_08mar_1800",
    type: "point",
    name: "FLASH - Semi Private 4org / 08 Mar 18:00 WITA",
    sessionId: "session_08mar_1800",
    normalPointCost: 5000,
    flashPointCost: 375,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,

    // 28 Feb 2026 - 00:00 WITA
    startTime: "2026-02-28T00:00:00+08:00",

    // 01 Mar 2026 - 21:00 WITA
    endTime: "2026-03-01T21:00:00+08:00",
  },

  {
    id: "flash_mabar_08mar_2100",
    type: "point",
    name: "FLASH - Mabar Fun All Class / 08 Mar 21:00 WITA",
    sessionId: "session_08mar_2100",
    normalPointCost: 4500,
    flashPointCost: 150,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    perUserLimit: 2,
    active: true,
    isFlash: true,

    // 28 Feb 2026 - 00:00 WITA
    startTime: "2026-02-28T00:00:00+08:00",

    // 01 Mar 2026 - 21:00 WITA
    endTime: "2026-03-01T21:00:00+08:00",
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
