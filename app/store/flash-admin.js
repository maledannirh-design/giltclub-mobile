import { auth, db } from "../firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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

          <input id="flashImage" placeholder="Image URL (raw github link)">

          <input id="flashNormalCost" type="number" placeholder="Normal Point Cost">

          <input id="flashFlashCost" type="number" placeholder="Flash Point Cost">

          <input id="flashQuota" type="number" placeholder="Quota">

          <label>Display From (WITA)</label>
          <input id="flashDisplay" type="datetime-local">

          <label>Start Redeem (WITA)</label>
          <input id="flashStart" type="datetime-local">

          <label>End Time (WITA)</label>
          <input id="flashEnd" type="datetime-local">

          <button class="btn-primary" id="createFlashBtn">
            Save Flash
          </button>

        </div>
      </div>

      <h3 style="margin-top:20px;">Existing Flash Drops</h3>
      <div id="flashList"></div>

    </div>
  `;

  loadFlashList();

  document.getElementById("createFlashBtn").onclick = createFlash;
}


/* ===============================
   AUTO ID GENERATOR
================================= */
function generateFlashId(name){
  return (
    "flash_" +
    name.toLowerCase()
        .replace(/[^a-z0-9]/g,"_")
        .slice(0,30) +
    "_" +
    Date.now()
  );
}


/* ===============================
   CREATE OR UPDATE FLASH
================================= */
async function createFlash(){

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

  const id = generateFlashId(name);

  const displayDate = new Date(displayInput + ":00+08:00");
  const startDate   = new Date(startInput + ":00+08:00");
  const endDate     = new Date(endInput + ":00+08:00");

  await addDoc(collection(db,"flashDrops"),{
    id,
    name,
    sessionId,
    image,
    normalPointCost: normalCost,
    flashPointCost: flashCost,
    quota,
    redeemedCount: 0,
    winners: [],
    eligibleRoles: ["member","coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,
    displayFrom: Timestamp.fromDate(displayDate),
    startTime: Timestamp.fromDate(startDate),
    endTime: Timestamp.fromDate(endDate),
    createdAt: Timestamp.now()
  });

  alert("Flash berhasil disimpan.");
  renderFlashAdmin();
}


/* ===============================
   LOAD LIST
================================= */
async function loadFlashList(){

  const container = document.getElementById("flashList");
  container.innerHTML = "";

  const snap = await getDocs(collection(db,"flashDrops"));

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


/* ===============================
   EDIT FLASH
================================= */
window.editFlash = async function(id){

  const snap = await getDocs(collection(db,"flashDrops"));
  const docSnap = snap.docs.find(d=>d.id===id);
  if(!docSnap) return;

  const d = docSnap.data();

  document.getElementById("flashName").value = d.name;
  document.getElementById("flashSessionId").value = d.sessionId;
  document.getElementById("flashImage").value = d.image || "";
  document.getElementById("flashNormalCost").value = d.normalPointCost;
  document.getElementById("flashFlashCost").value = d.flashPointCost;
  document.getElementById("flashQuota").value = d.quota;

  alert("Data dimuat. Edit lalu klik Save Flash.");
}


/* ===============================
   TOGGLE ACTIVE
================================= */
window.toggleFlash = async function(id,currentStatus){

  await updateDoc(doc(db,"flashDrops",id),{
    active: !currentStatus
  });

  renderFlashAdmin();
}


/* ===============================
   DELETE FLASH
================================= */
window.deleteFlash = async function(id){

  if(!confirm("Hapus flash ini?")) return;

  await deleteDoc(doc(db,"flashDrops",id));
  renderFlashAdmin();
}
