import { auth, db } from "../firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


export function renderStoreInbox(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="store-page">

      <h2>Inbox Toko</h2>

      <div id="storeInboxList" class="store-grid"></div>

    </div>
  `;

  loadInbox();

}


function loadInbox(){

  const user = auth.currentUser;
  if(!user) return;

  const container = document.getElementById("storeInboxList");

  const q = query(
    collection(db,"users",user.uid,"storeInbox"),
    orderBy("createdAt","desc")
  );

  onSnapshot(q,(snap)=>{

    container.innerHTML = "";

    if(snap.empty){

      container.innerHTML = `
        <div style="opacity:.6">
          Belum ada item.
        </div>
      `;

      return;
    }

    snap.forEach(docSnap=>{

      const d = docSnap.data();
      const id = docSnap.id;

      const expireText = d.expiresAt
        ? new Date(d.expiresAt.seconds*1000).toLocaleDateString("id-ID")
        : "-";

      const isExpired =
        d.expiresAt
        && Date.now() > d.expiresAt.seconds*1000;

      const status = isExpired ? "expired" : d.status;

      container.innerHTML += `
        <div class="store-card ${status === "expired" ? "expired" : ""}">

          <div class="card-image">

            ${
              d.image
              ? `<img src="/app/store/products/${d.image}">`
              : `<div class="no-image">No Image</div>`
            }

          </div>

          <div class="card-body">

            <div class="inbox-type ${d.type}">
</div>

<h3>${d.name}</h3>

            <div class="card-info">

              <span class="status ${status}">
                ${status}
              </span>

            </div>

            ${
              d.expiresAt
              ? `<div class="expire">
                   Exp: ${expireText}
                 </div>`
              : ""
            }

            ${
              status === "unused"
              && d.type === "voucher"
              ? `<button
                   class="btn-use"
                   onclick="useVoucher('${id}')">
                   Gunakan Voucher
                 </button>`
              : ""
            }

          </div>

        </div>
      `;

    });

  });

}



window.useVoucher = async function(itemId){

  const user = auth.currentUser;
  if(!user) return;

  try{

    await updateDoc(
      doc(db,"users",user.uid,"storeInbox",itemId),
      {
        status:"used",
        usedAt:Timestamp.now()
      }
    );

    alert("Voucher digunakan.");

  }catch(err){

    console.log(err);
    alert("Gagal menggunakan voucher.");

  }

}
