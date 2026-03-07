import { evaluateVerifiedStatus } from "./verifiedEngine.js";
import { showVerifiedWarningPopup } from "./verifiedPopup.js";
import { showVerifiedSuccessPopup } from "./verifiedSuccessPopup.js";

export function runVerifiedCheck(user){

  if(!user) return;

  // timezone WITA
  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Makassar" })
  );

  const day = witaDate.getDate();

  // hanya tanggal 1-7
  if(day < 1 || day > 7) return;

  const result = evaluateVerifiedStatus(user);

  if(result.warning){
    showVerifiedWarningPopup();
    return;
  }

  // jika tidak warning berarti lolos
  if(result.verified){
    showVerifiedSuccessPopup(user);
  }

}
