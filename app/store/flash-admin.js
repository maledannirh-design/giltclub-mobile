import { auth, db } from "../firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let editModeId = null;

/* =====================================================
   RENDER ADMIN
===================================================== */
export async function renderFlashAdmin(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div class="store-page">

      <h2>Flash Drop Admin</h2>

      <div class="store-card">
        <div class="card-body">

          <input id="flashName" placeholder="Nama Flash">
          <input id="flashSessionId" placeholder="Session ID">
          <input id="flashImage" placeholder="Image filename (contoh: voucher001.webp)">
          <input id="flashNormalCost" type="number" placeholder="Normal Point Cost">
          <input id="flashFlashCost" type="number" placeholder="Flash Point Cost">
          <input id="flashQuota" type="number" placeholder="Quota">

          <label>Display From (WITA)</label>
          <input id="flashDisplay" type="datetime-local">

          <label>Start Redeem (WITA)</label>
          <input id="flashStart" type="datetime-local">

          <label>End Time (WITA)</label>
          <input id="flashEnd" type="datetime-local">

          <button class="btn-primary" id="saveFlashBtn">
            Save Flash
          </button>

        </div>
      </div>

      <h3 style="margin-top:20px;">Existing Flash Drops</h3>
      <div id="flashList"></div>

    </div>
  `;

  loadFlashList();
  document.getElementById("saveFlashBtn").onclick = saveFlash;
}


/* =====================================================
   AUTO ID GENERATOR
===================================================== */
function generateFlashId(name){
  return (
    "flash_" +
    name.toLowerCase()
        .replace(/[^a-z0-9]/g,"_")
        .slice(0,25) +
    "_" +
    Date.now()
  );
}


/* =====================================================
   CREATE OR UPDATE
===================================================== */
async function saveFlash(){

  const name = document.getElementById("flashName").value.trim();
  const sessionId = document.getElementById("flashSessionId").value.trim();
  const image = document.getElementById("flashImage").value.trim();
  const normalCost = Number(document.getElementById("flashNormalCost").value);
  const flashCost = Number(document.getElementById("flashFlashCost").value);
  const quota = Number(document.getElementById("flashQuota").value);
  const displayInput = document.getElementById("flashDisplay").value;
  const startInput = document.getElementById("flashStart").value;
  const endInput = document.getElementById("flashEnd").value;

  if(!name || !displayInput || !startInput || !endInput){
    alert("Lengkapi semua field waktu.");
    return;
  }

  const displayDate = new Date(displayInput + ":00+08:00");
  const startDate   = new Date(startInput + ":00+08:00");
  const endDate     = new Date(endInput + ":00+08:00");

  const payload = {
    name,
    sessionId,
    image,
    normalPointCost: normalCost,
    flashPointCost: flashCost,
    quota,
    eligibleRoles: ["member","coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,
    displayFrom: Timestamp.fromDate(displayDate),
    startTime: Timestamp.fromDate(startDate),
    endTime: Timestamp.fromDate(endDate),
    updatedAt: Timestamp.now()
  };

  if(editModeId){
    await updateDoc(doc(db,"flashDrops",editModeId), payload);
    alert("Flash berhasil diupdate.");
  }else{
    payload.redeemedCount = 0;
    payload.winners = [];
    payload.createdAt = Timestamp.now();
    payload.id = generateFlashId(name);

    await addDoc(collection(db,"flashDrops"), payload);
    alert("Flash berhasil dibuat.");
  }

  editModeId = null;
  renderFlashAdmin();
}


/* =====================================================
   LOAD LIST
===================================================== */
async function loadFlashList(){

  const container = document.getElementById("flashList");
  container.innerHTML = "";

  const snap = await getDocs(collection(db,"flashDrops"));

  if(snap.empty){
    container.innerHTML = "<div style='opacity:.6'>Belum ada flash.</div>";
    return;
  }

  snap.forEach(docSnap=>{

    const d = docSnap.data();

    container.innerHTML += `
      <div class="store-card">
        <div class="card-body">

          <strong>${d.name}</strong><br>
          Quota: ${d.quota} |
          Redeemed: ${d.redeemedCount}<br>
          Active: ${d.active}

          <div style="margin-top:10px;">
            <button onclick="toggleFlash('${docSnap.id}', ${d.active})">
              ${d.active ? "Deactivate" : "Activate"}
            </button>

            <button onclick="editFlash('${docSnap.id}')">
              Edit
            </button>

            <button onclick="deleteFlash('${docSnap.id}')">
              Delete
            </button>
          </div>

        </div>
      </div>
    `;
  });
}


/* =====================================================
   EDIT
===================================================== */
window.editFlash = async function(id){

  const snap = await getDoc(doc(db,"flashDrops",id));
  if(!snap.exists()) return;

  const d = snap.data();
  editModeId = id;

  document.getElementById("flashName").value = d.name || "";
  document.getElementById("flashSessionId").value = d.sessionId || "";
  document.getElementById("flashImage").value = d.image || "";
  document.getElementById("flashNormalCost").value = d.normalPointCost || 0;
  document.getElementById("flashFlashCost").value = d.flashPointCost || 0;
  document.getElementById("flashQuota").value = d.quota || 1;

  alert("Mode edit aktif. Klik Save Flash untuk update.");
};


/* =====================================================
   TOGGLE ACTIVE
===================================================== */
window.toggleFlash = async function(id,currentStatus){

  await updateDoc(doc(db,"flashDrops",id),{
    active: !currentStatus
  });

  renderFlashAdmin();
};


/* =====================================================
   DELETE
===================================================== */
window.deleteFlash = async function(id){

  if(!confirm("Hapus flash ini?")) return;

  await deleteDoc(doc(db,"flashDrops",id));
  renderFlashAdmin();
};
