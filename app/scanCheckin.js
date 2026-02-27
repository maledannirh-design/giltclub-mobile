import { auth } from "./firebase.js";
import { processCheckIn } from "./scanQR.js";

window.handleCheckinScan = async function(decodedText, scheduleId){

  try {

    const url = new URL(decodedText);
    const c = url.searchParams.get("c");
    const i = url.searchParams.get("i");
    const s = url.searchParams.get("s");

    const currentUser = auth.currentUser;

    const result = await processCheckIn(
      c,
      i,
      s,
      scheduleId,
      {
        uid: currentUser.uid,
        role: window.currentUserData?.role
      }
    );

    return result;

  } catch (err) {
    return { valid:false, reason:"QR tidak valid" };
  }
};
