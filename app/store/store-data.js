// ===============================
// GILT STORE DATA ENGINE
// ===============================


// ===============================
// BASE IMAGE PATH (RAW GITHUB)
// ===============================
const BASE_IMAGE_URL =
  "https://raw.githubusercontent.com/maledannirh-design/giltclub-mobile/main/app/store/products/";


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
    image: BASE_IMAGE_URL + "jersey_rok_1.webp",
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
    image: BASE_IMAGE_URL + "visorhat_giltlogo_black_rose.webp",
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
    image: BASE_IMAGE_URL + "sticker-pack-solo.webp",
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
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    active: true,
    isFlash: false,
    image: BASE_IMAGE_URL + "vouchersemiprivate001.webp",
  }
];


// ===============================
// FLASH REDEEM (WITA +08:00)
// FORMAT WAJIB:
// "YYYY-MM-DDTHH:MM:SS+08:00"
// ===============================
export const STORE_FLASH = [

  {
    id: "flash_semi_08mar_1800",
    type: "point",
    name: "FLASH - Semi Private 4org / 08 Mar 18:00 WITA",
    sessionId: "session_08mar_1800",
    normalPointCost: 9100,
    flashPointCost: 375,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,

    // 04 Mar 2026 - 21:00 WITA
    startTime: "2026-03-04T21:00:00+08:00",

    // 01 Jul 2026 - 21:00 WITA
    endTime: "2026-07-01T21:00:00+08:00",

    image: BASE_IMAGE_URL + "vouchersemiprivate001.webp",
  },

  {
    id: "flash_mabar_08mar_2100_a",
    type: "point",
    name: "FLASH - Mabar Fun All Class 2 Slot / 08 Mar 21:00 WITA",
    sessionId: "session_08mar_2100",
    normalPointCost: 6700,
    flashPointCost: 265,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,

    // 02 Mar 2026 - 03:45 WITA
    startTime: "2026-03-02T03:45:00+08:00",

    // 02 Mar 2026 - 16:00 WITA
    endTime: "2026-03-02T16:00:00+08:00",

    image: BASE_IMAGE_URL + "vouchermabar001.webp",
  },

  {
    id: "flash_mabar_08mar_2100_b",
    type: "point",
    name: "FLASH - Mabar Fun All Class 2 Slot / 08 Mar 21:00 WITA",
    sessionId: "session_08mar_2100",
    normalPointCost: 4500,
    flashPointCost: 195,
    quota: 1,
    redeemedCount: 0,
    eligibleRoles: ["member", "coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,

    // 02 Mar 2026 - 03:45 WITA
    startTime: "2026-03-02T03:45:00+08:00",

    // 02 Mar 2026 - 16:00 WITA
    endTime: "2026-03-02T16:00:00+08:00",

    image: BASE_IMAGE_URL + "vouchermabar002.webp",
  }

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
