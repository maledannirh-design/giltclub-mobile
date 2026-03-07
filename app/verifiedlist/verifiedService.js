import { evaluateVerifiedStatus } from "./verifiedEngine.js";
import { showVerifiedWarningPopup } from "./verifiedPopup.js";

export function runVerifiedCheck(user){

  if(!user) return;

  // ambil tanggal WITA
  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Makassar" })
  );

  const day = witaDate.getDate();

  // popup hanya tanggal 1 - 7 WITA
  if(day < 1 || day > 7) return;

  const result = evaluateVerifiedStatus(user);

  if(result.warning){
    showVerifiedWarningPopup();
  }

}
