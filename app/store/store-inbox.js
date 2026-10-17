import { auth, db } from "../firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
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

      let status = d.status || "";

// override untuk product
if(d.type === "product"){

  if(status === "unused"){
    status = "belum_diterima";
  }

}

      let expireHTML = "";

      /* ==========================
         VOUCHER SYSTEM
      ========================== */

      if(d.type === "voucher"){

        const expireText = d.expiresAt
          ? new Date(d.expiresAt.seconds*1000)
              .toLocaleDateString("id-ID")
          : "-";

        const isExpired =
          d.expiresAt &&
          Date.now() > d.expiresAt.seconds*1000;

        if(isExpired){
          status = "expired";
        }

        if(d.expiresAt){

          expireHTML = `
            <div class="expire">
              Exp: ${expireText}
            </div>
          `;

        }

      }

      /* ==========================
         PRODUCT SYSTEM
      ========================== */

      if(d.type === "product"){

        if(!status){
          status = "belum_diterima";
        }

      }


      container.innerHTML += `
        <div class="store-card ${status === "expired" ? "expired" : ""}" style="position:relative;">
          <button type="button" aria-label="Hapus item" title="Hapus item" onclick="confirmDeleteStoreInboxItem(\'${id}\')" style="position:absolute;top:8px;right:8px;z-index:2;width:32px;height:32px;border:0;border-radius:50%;background:#fff0ed;color:#b42318;font-size:17px;font-weight:700;cursor:pointer;">🗑</button>

          <div class="card-image">

            ${
              d.image
              ? `<img src="/app/store/products/${d.image}">`
              : `<div class="no-image">No Image</div>`
            }

          </div>

          <div class="card-body">

            <div class="inbox-type ${d.type}"></div>

            <h3>${d.name}</h3>

            <div class="card-info">

              <span class="status ${status}">
                ${status}
              </span>

            </div>

            ${expireHTML}

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

            ${
              d.type === "product"
              && status === "belum_diterima"
              ? `<button
                   class="btn-use"
                   onclick="confirmProductReceived('${id}')">
                   Tandai Sudah Diterima
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


window.confirmProductReceived = async function(itemId){

  const user = auth.currentUser;
  if(!user) return;

  try{

    await updateDoc(
      doc(db,"users",user.uid,"storeInbox",itemId),
      {
        status:"diterima",
        receivedAt:Timestamp.now()
      }
    );

    alert("Barang ditandai sudah diterima.");

  }catch(err){

    console.log(err);
    alert("Gagal update status.");

  }

};


/* Delete an inbox item after explicit confirmation. */
window.confirmDeleteStoreInboxItem = function(itemId) {
  document.getElementById('deleteStoreInboxConfirm')?.remove();
  const modal = document.createElement('div');
  modal.id = 'deleteStoreInboxConfirm';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55);';
  modal.innerHTML = '<div role="dialog" aria-modal="true" style="width:100%;max-width:360px;background:#fff;color:#245b46;border-radius:20px;padding:24px;box-shadow:0 16px 48px rgba(0,0,0,.28);"><h3 style="margin:0 0 12px;font-size:19px;">Hapus item?</h3><p style="margin:0 0 22px;line-height:1.5;">Anda yakin menghapus item ini? Item yang dihapus tidak bisa dikembalikan lagi.</p><div style="display:flex;gap:10px;"><button type="button" id="cancelDeleteStoreInbox" style="flex:1;padding:12px;border:1px solid #d6ded8;border-radius:12px;background:transparent;color:inherit;font-weight:600;cursor:pointer;">Batal</button><button type="button" id="confirmDeleteStoreInbox" style="flex:1;padding:12px;border:0;border-radius:12px;background:#b42318;color:#fff;font-weight:700;cursor:pointer;">Hapus</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#cancelDeleteStoreInbox').onclick = () => modal.remove();
  modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
  modal.querySelector('#confirmDeleteStoreInbox').onclick = async () => {
    const button = modal.querySelector('#confirmDeleteStoreInbox');
    button.disabled = true; button.textContent = 'Menghapus...';
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Silakan login kembali.');
      await deleteDoc(doc(db, 'users', user.uid, 'storeInbox', itemId));
      modal.remove();
    } catch (error) {
      console.error('Delete store inbox item failed:', error);
      button.disabled = false; button.textContent = 'Hapus';
      alert('Gagal menghapus item. Periksa izin Firestore lalu coba lagi.');
    }
  };
};