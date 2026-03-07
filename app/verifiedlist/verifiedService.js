import { evaluateVerifiedStatus } from "./verifiedEngine.js";
import { showVerifiedWarningPopup } from "./verifiedPopup.js";
import { showVerifiedSuccessPopup } from "./verifiedSuccessPopup.js";
import { showUpgradeChancePopup } from "./verifiedUpgradeChancePopup.js";


export function runVerifiedCheck(user){

  if(!user) return;

  const now = new Date();
  const witaDate = new Date(
    now.toLocaleString("en-US",{timeZone:"Asia/Makassar"})
  );

  const day = witaDate.getDate();

  if(day < 1 || day > 7) return;

  const result = evaluateVerifiedStatus(user);

  switch(result.state){

    case "verified_warning":
      showVerifiedWarningPopup();
      break;

    case "verified_stay":
      showVerifiedSuccessPopup(user);
      break;

    case "verified_upgrade":
      showVerifiedSuccessPopup(user);
      break;

    case "upgrade_chance":
      showUpgradeChancePopup();
      break;

  }

}
