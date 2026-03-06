import { db } from "../firebase.js";

import {
  doc,
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =====================================================
   ADD ITEM TO INBOX (UNIVERSAL STORE ENGINE)
===================================================== */

export async function addItemToInbox({

  uid,
  type,
  source,

  name,
  image,

  sessionId = null,
  productId = null,

  expireDays = null,

  meta = {}

}){

  if(!uid) throw new Error("uid required");

  const inboxRef =
    collection(db,"users",uid,"storeInbox");

  let expireAt = null;

  if(expireDays){

    const d = new Date();
    d.setDate(d.getDate() + expireDays);

    expireAt = Timestamp.fromDate(d);
  }

  const payload = {

    type,        // voucher | product | ticket
    source,      // flash | reward | purchase

    name,
    image,

    sessionId,
    productId,

    status:"unused",

    expireAt,

    meta,

    createdAt:Timestamp.now()

  };

  await addDoc(inboxRef,payload);

}
