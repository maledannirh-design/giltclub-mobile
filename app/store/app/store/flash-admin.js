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

          <input id="flashNormalCost" type="number" placeholder="Normal Point Cost">
          <input id="flashFlashCost" type="number" placeholder="Flash Point Cost">

          <input id="flashQuota" type="number" placeholder="Quota">

          <label>Start Time (WITA)</label>
          <input id="flashStart" type="datetime-local">

          <label>End Time (WITA)</label>
          <input id="flashEnd" type="datetime-local">

          <button class="btn-primary" id="createFlashBtn">
            Create Flash
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
   CREATE FLASH
================================= */
async function createFlash(){

  const name = document.getElementById("flashName").value.trim();
  const sessionId = document.getElementById("flashSessionId").value.trim();
  const normalCost = Number(document.getElementById("flashNormalCost").value);
  const flashCost = Number(document.getElementById("flashFlashCost").value);
  const quota = Number(document.getElementById("flashQuota").value);
  const startInput = document.getElementById("flashStart").value;
  const endInput = document.getElementById("flashEnd").value;

  if(!name || !startInput || !endInput){
    alert("Isi semua field.");
    return;
  }

  // Convert WITA (+08:00)
  const startDate = new Date(startInput + ":00+08:00");
  const endDate   = new Date(endInput + ":00+08:00");

  await addDoc(collection(db,"flashDrops"),{
    name,
    sessionId,
    normalPointCost: normalCost,
    flashPointCost: flashCost,
    quota,
    redeemedCount: 0,
    winners: [],
    eligibleRoles: ["member","coach"],
    perUserLimit: 1,
    active: true,
    isFlash: true,
    startTime: Timestamp.fromDate(startDate),
    endTime: Timestamp.fromDate(endDate),
    createdAt: Timestamp.now()
  });

  alert("Flash berhasil dibuat.");

  renderFlashAdmin();
}


/* ===============================
   LOAD FLASH LIST
================================= */
async function loadFlashList(){

  const container = document.getElementById("flashList");
  container.innerHTML = "";

  const snap = await getDocs(collection(db,"flashDrops"));

  snap.forEach(docSnap=>{

    const data = docSnap.data();

    container.innerHTML += `
      <div class="store-card">
        <div class="card-body">

          <strong>${data.name}</strong><br>
          Quota: ${data.quota} |
          Redeemed: ${data.redeemedCount} <br>
          Active: ${data.active}

          <div style="margin-top:10px;">
            <button onclick="toggleFlash('${docSnap.id}', ${data.active})">
              ${data.active ? "Deactivate" : "Activate"}
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
