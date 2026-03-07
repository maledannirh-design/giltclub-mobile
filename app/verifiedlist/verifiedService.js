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

  }

}
