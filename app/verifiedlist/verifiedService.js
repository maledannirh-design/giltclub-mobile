import { evaluateVerifiedStatus } from "./verifiedEngine.js";
import { showVerifiedWarningPopup } from "./verifiedPopup.js";

export function runVerifiedCheck(user) {

  if (!user) return;

  const result = evaluateVerifiedStatus(user);

  const today = new Date().getDate();

  if (result.warning && today <= 7) {
    showVerifiedWarningPopup();
  }

}
