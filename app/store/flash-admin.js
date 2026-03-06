import { auth, db } from "../firebase.js";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let editModeId = null;


/* ===============================
   HELPER TIME FORMAT
================================= */

function toDateTimeLocal(ts){

  if(!ts?.toDate) return "";

  const d = ts.toDate();

  const pad = n => String(n).padStart(2,"0");

  return `${d.getFullYear()}-${
    pad(d.getMonth()+1)
  }-${
    pad(d.getDate())
  }T${
    pad(d.getHours())
  }:${
    pad(d.getMinutes())
  }`;

}


/* ===============================
   RENDER ADMIN
================================= */

export async function renderFlashAdmin() {

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `

    <div class="flash-admin-page">

      <h2>Flash Drop Admin</h2>

      <div class="flash-form">

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

        <button class="flash-save-btn" id="saveFlashBtn">
          Save Flash
        </button>

      </div>

      <h3 style="margin-top:30px;">Existing Flash Drops</h3>

      <div id="flashList" class="flash-list"></div>

    </div>
  `;

  loadFlashList();

  document.getElementById("saveFlashBtn").onclick = saveFlash;

}


/* ===============================
   AUTO ID GENERATOR
================================= */

function generateFlashId(name){

  return (
    "flash_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"_")
      .slice(0,25) +
    "_" +
    Date.now()
  );

}


/* ===============================
   CREATE OR UPDATE
================================= */

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

  if (!name || !displayInput || !startInput || !endInput){
    alert("Lengkapi semua field waktu.");
    return;
  }

  const displayDate = new Date(displayInput + ":00+08:00");
  const startDate = new Date(startInput + ":00+08:00");
  const endDate = new Date(endInput + ":00+08:00");

  const payload = {

    name,
    sessionId,
    image,

    type: "voucher",
    source: "flash",

    normalPointCost: normalCost,
    flashPointCost: flashCost,

    quota,

    eligibleRoles:["member","coach"],

    perUserLimit:1,

    active:true,
    isFlash:true,

    displayFrom:Timestamp.fromDate(displayDate),
    startTime:Timestamp.fromDate(startDate),
    endTime:Timestamp.fromDate(endDate),

    updatedAt:Timestamp.now()

  };

  if(editModeId){

    await updateDoc(
      doc(db,"flashDrops",editModeId),
      payload
    );

    alert("Flash berhasil diupdate.");

  }else{

    const newId = generateFlashId(name);

    await setDoc(
      doc(db,"flashDrops",newId),
      {
        ...payload,
        id:newId,
        redeemedCount:0,
        winners:[],
        createdAt:Timestamp.now()
      }
    );

    alert("Flash berhasil dibuat.");
  }

  editModeId = null;

  renderFlashAdmin();

}


/* ===============================
   LOAD LIST
================================= */

async function loadFlashList(){

  const container = document.getElementById("flashList");

  container.innerHTML = "";

  const snap = await getDocs(collection(db,"flashDrops"));

  if(snap.empty){

    container.innerHTML =
      "<div style='opacity:.6'>Belum ada flash.</div>";

    return;
  }

  snap.forEach(docSnap=>{

    const d = docSnap.data();

    container.innerHTML += `

      <div class="flash-card">

        <div class="flash-title">
          ${d.name}
        </div>

        <div class="flash-info">

          Quota: ${d.quota}

          <br>

          Redeemed: ${d.redeemedCount || 0}

          <br>

          Active: ${d.active}

        </div>

        <div class="flash-actions">

          <button onclick="toggleFlash('${docSnap.id}',${d.active})">
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

    `;

  });

}


/* ===============================
   EDIT
================================= */

window.editFlash = async function(id){

  const snap = await getDoc(doc(db,"flashDrops",id));

  if(!snap.exists()) return;

  const d = snap.data();

  editModeId = id;

  document.getElementById("flashName").value = d.name || "";
  document.getElementById("flashSessionId").value = d.sessionId || "";
  document.getElementById("flashImage").value = d.image || "";

  document.getElementById("flashNormalCost").value =
    d.normalPointCost || 0;

  document.getElementById("flashFlashCost").value =
    d.flashPointCost || 0;

  document.getElementById("flashQuota").value =
    d.quota || 1;

  document.getElementById("flashDisplay").value =
    toDateTimeLocal(d.displayFrom);

  document.getElementById("flashStart").value =
    toDateTimeLocal(d.startTime);

  document.getElementById("flashEnd").value =
    toDateTimeLocal(d.endTime);

  window.scrollTo({top:0,behavior:"smooth"});

};


/* ===============================
   TOGGLE ACTIVE
================================= */

window.toggleFlash = async function(id,currentStatus){

  await updateDoc(
    doc(db,"flashDrops",id),
    {
      active:!currentStatus
    }
  );

  renderFlashAdmin();

};


/* ===============================
   DELETE
================================= */

window.deleteFlash = async function(id){

  if(!confirm("Hapus flash ini?")) return;

  await deleteDoc(doc(db,"flashDrops",id));

  renderFlashAdmin();

};
