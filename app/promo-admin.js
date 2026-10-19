import { auth, db, storage } from "./firebase.js";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export async function renderPromoAdmin(){
  const content=document.getElementById("content");
  if(!content) return;
  content.innerHTML=`
    <div class="admin-container">
      <button class="admin-btn" id="promoBackBtn" type="button">← Kembali ke Admin</button>
      <div class="admin-card promo-admin-card">
        <h2>Promo Teras</h2>
        <p>Upload gambar promo yang sudah berisi semua informasi. Setelah upload berhasil, promo langsung tampil di Teras.</p>
        <label for="promoImageFile">Pilih gambar promo</label>
        <input id="promoImageFile" type="file" accept="image/*" style="display:block;width:100%;margin:10px 0 14px;">
        <div id="promoImagePreview" class="promo-admin-preview">Preview gambar akan muncul di sini.</div>
        <button class="admin-btn" id="uploadPromoBtn" type="button">Upload Promo</button>
        <div id="promoUploadStatus" role="status" style="margin-top:10px;font-size:13px;"></div>
      </div>
      <div class="admin-card">
        <h3>Daftar Promo</h3>
        <p>Nonaktifkan promo untuk menyembunyikannya dari Teras tanpa menghapus gambar.</p>
        <div id="promoAdminList">Memuat promo…</div>
      </div>
    </div>`;
  document.getElementById("promoBackBtn").onclick=()=>window.navigate?.("admin");
  const input=document.getElementById("promoImageFile");
  input.onchange=()=>{
    const file=input.files?.[0], preview=document.getElementById("promoImagePreview");
    if(!file){preview.textContent="Preview gambar akan muncul di sini.";return;}
    if(!file.type.startsWith("image/")){preview.textContent="File harus berupa gambar.";return;}
    preview.innerHTML="";
    const img=document.createElement("img");img.src=URL.createObjectURL(file);img.alt="Preview promo";
    preview.appendChild(img);
  };
  document.getElementById("uploadPromoBtn").onclick=uploadPromo;
  await loadPromoList();
}

async function uploadPromo(){
  const input=document.getElementById("promoImageFile");
  const file=input?.files?.[0];
  const status=document.getElementById("promoUploadStatus");
  const btn=document.getElementById("uploadPromoBtn");
  if(!file){status.textContent="Pilih gambar terlebih dahulu.";return;}
  if(!file.type.startsWith("image/")){status.textContent="File harus berupa gambar.";return;}
  if(file.size>8*1024*1024){status.textContent="Ukuran gambar maksimal 8 MB.";return;}
  if(!auth.currentUser){status.textContent="Silakan login sebagai admin.";return;}
  btn.disabled=true;status.textContent="Mengunggah gambar…";
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`promotions/${Date.now()}_${safeName}`;
  try{
    const storageRef=ref(storage,path);
    await uploadBytes(storageRef,file,{contentType:file.type});
    const imageUrl=await getDownloadURL(storageRef);
    await addDoc(collection(db,"promotions"),{
      imageUrl,storagePath:path,fileName:file.name,active:true,
      createdAt:serverTimestamp(),createdBy:auth.currentUser.uid
    });
    status.textContent="Promo berhasil di-upload dan langsung diaktifkan.";
    input.value="";
    document.getElementById("promoImagePreview").textContent="Preview gambar akan muncul di sini.";
    await loadPromoList();
  }catch(error){
    console.error("Promo upload failed:",error);
    status.textContent="Upload gagal. Periksa izin Firestore/Storage lalu coba lagi.";
  }finally{btn.disabled=false;}
}

async function loadPromoList(){
  const container=document.getElementById("promoAdminList");
  if(!container)return;
  try{
    const snap=await getDocs(query(collection(db,"promotions"),orderBy("createdAt","desc")));
    if(snap.empty){container.innerHTML='<p>Belum ada promo.</p>';return;}
    container.innerHTML="";
    snap.docs.forEach(s=>{
      const d=s.data();
      const row=document.createElement("div");row.className="promo-admin-row";
      const img=document.createElement("img");img.src=d.imageUrl||"";img.alt="Promo";
      const meta=document.createElement("div");meta.className="promo-admin-meta";
      const title=document.createElement("strong");title.textContent=d.fileName||"Promo GMTC";
      const state=document.createElement("span");state.textContent=d.active===false?"Nonaktif":"Aktif";
      const toggle=document.createElement("button");toggle.type="button";toggle.className="admin-btn";toggle.textContent=d.active===false?"Aktifkan":"Nonaktifkan";
      toggle.onclick=async()=>{toggle.disabled=true;try{await updateDoc(doc(db,"promotions",s.id),{active:d.active===false});await loadPromoList();}catch(e){console.error(e);alert("Status promo gagal diubah. Periksa izin Firestore.");}};
      const remove=document.createElement("button");remove.type="button";remove.className="admin-btn";remove.textContent="Hapus";
      remove.onclick=async()=>{if(!confirm("Hapus promo ini secara permanen?"))return;remove.disabled=true;try{await deleteDoc(doc(db,"promotions",s.id));if(d.storagePath){try{await deleteObject(ref(storage,d.storagePath));}catch(storageError){console.warn("Promo image cleanup failed",storageError);}}await loadPromoList();}catch(e){console.error(e);alert("Promo gagal dihapus.");}};
      meta.append(title,state,toggle,remove);row.append(img,meta);container.appendChild(row);
    });
  }catch(error){console.error("Promo list failed:",error);container.textContent="Daftar promo gagal dimuat. Periksa izin Firestore.";}
}
