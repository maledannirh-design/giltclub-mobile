import { evaluateVerifiedStatus } from "./verifiedEngine.js";
import { showVerifiedWarningPopup } from "./verifiedPopup.js";
import { showVerifiedSuccessPopup } from "./verifiedSuccessPopup.js";
import { showUpgradeChancePopup } from "./verifiedUpgradeChancePopup.js";
import { showAttendanceWarningPopup } from "./verifiedAttendancePopup.js";

export function runVerifiedCheck(user){

  if(!user) return;

  // WITA timezone
  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const day = witaDate.getDate();

  // hanya tanggal 1 - 7
  if(day < 1 || day > 7) return;

  const result = evaluateVerifiedStatus(user);
  if(isPopupDismissed()) return;

  if(result.state === "verified_warning"){
    showVerifiedWarningPopup();
  }

  if(result.state === "verified_stay"){
    showVerifiedSuccessPopup(user);
  }

  if(result.state === "verified_upgrade"){
    showVerifiedSuccessPopup(user);
  }

  if(result.state === "upgrade_chance"){
    showUpgradeChancePopup();
  }

  if(result.state === "attendance_warning"){
    showAttendanceWarningPopup();
  }


  function isPopupDismissed(){

  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const key =
    "verifiedPopupDismissed_" +
    witaDate.getFullYear() +
    "-" +
    String(witaDate.getMonth()+1).padStart(2,"0");

  return localStorage.getItem(key) === "true";
}

}
