import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot
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
        <div style="opacity:.6">Belum ada item.</div>
      `;
      return;
    }

    snap.forEach(docu=>{

      const d = docu.data();

      container.innerHTML += `
        <div class="store-card">

          <div class="card-image">
            <img src="/app/store/products/${d.image}">
          </div>

          <div class="card-body">

            <h3>${d.name}</h3>

            <div class="card-info">
              <span class="status ${d.status}">
                ${d.status}
              </span>
            </div>

            ${
              d.expiresAt
              ? `<div class="expire">
                   Exp: ${new Date(d.expiresAt.seconds*1000).toLocaleDateString()}
                 </div>`
              : ""
            }

          </div>

        </div>
      `;

    });

  });

}
