import { db } from "../firebase.js";

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
   RENDER ADMIN
================================= */

export async function renderRewardAdmin(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `

  <div class="store-page">

    <h2>Reward GP Admin</h2>

    <div class="store-card">
      <div class="card-body">

        <input id="rewardName"
               placeholder="Nama Reward">

        <input id="rewardImage"
               placeholder="Image filename (voucher001.webp)">

        <input id="rewardPointCost"
               type="number"
               placeholder="Point Cost">

        <input id="rewardQuota"
               type="number"
               placeholder="Quota">

        <input id="rewardExpireDays"
               type="number"
               placeholder="Expire Days (30)">

        <button class="btn-primary"
                id="saveRewardBtn">
          Save Reward
        </button>

      </div>
    </div>

    <h3 style="margin-top:20px;">
      Existing Rewards
    </h3>

    <div id="rewardList"></div>

  </div>

  `;

  loadRewardList();

  document
    .getElementById("saveRewardBtn")
    .onclick = saveReward;

}


/* ===============================
   AUTO ID
================================= */

function generateRewardId(name){

  return (
    "reward_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"_")
      .slice(0,25) +
    "_" +
    Date.now()
  );

}


/* ===============================
   SAVE
================================= */

async function saveReward(){

  const name =
    document.getElementById("rewardName").value.trim();

  const image =
    document.getElementById("rewardImage").value.trim();

  const pointCost =
    Number(document.getElementById("rewardPointCost").value);

  const quota =
    Number(document.getElementById("rewardQuota").value);

  const expireDays =
    Number(document.getElementById("rewardExpireDays").value);

  if(!name){
    alert("Nama reward wajib diisi");
    return;
  }

  const payload = {

    name,
    image,

    type:"voucher",

    pointCost,
    quota,

    expireDays,

    active:true,

    updatedAt:Timestamp.now()

  };

  if(editModeId){

    await updateDoc(
      doc(db,"rewards",editModeId),
      payload
    );

    alert("Reward berhasil diupdate");

  }else{

    const newId = generateRewardId(name);

    await setDoc(
      doc(db,"rewards",newId),
      {
        ...payload,
        id:newId,
        redeemedCount:0,
        createdAt:Timestamp.now()
      }
    );

    alert("Reward berhasil dibuat");

  }

  editModeId = null;

  renderRewardAdmin();

}


/* ===============================
   LOAD LIST
================================= */

async function loadRewardList(){

  const container =
    document.getElementById("rewardList");

  container.innerHTML = "";

  const snap =
    await getDocs(collection(db,"rewards"));

  if(snap.empty){

    container.innerHTML =
      "<div style='opacity:.6'>Belum ada reward.</div>";

    return;

  }

  snap.forEach(docSnap=>{

    const d = docSnap.data();

    container.innerHTML += `

      <div class="store-card">

        <div class="card-body">

          <strong>${d.name}</strong><br>

          GP: ${d.pointCost}<br>

          Quota: ${d.quota}<br>

          Redeemed: ${d.redeemedCount || 0}<br>

          Active: ${d.active}

          <div style="margin-top:10px;">

            <button onclick="toggleReward('${docSnap.id}',${d.active})">
              ${d.active ? "Deactivate" : "Activate"}
            </button>

            <button onclick="editReward('${docSnap.id}')">
              Edit
            </button>

            <button onclick="deleteReward('${docSnap.id}')">
              Delete
            </button>

          </div>

        </div>

      </div>

    `;

  });

}


/* ===============================
   EDIT
================================= */

window.editReward = async function(id){

  const snap = await getDoc(doc(db,"rewards",id));
  if(!snap.exists()) return;

  const d = snap.data();

  editModeId = id;

  document.getElementById("rewardName").value =
    d.name || "";

  document.getElementById("rewardImage").value =
    d.image || "";

  document.getElementById("rewardPointCost").value =
    d.pointCost || 0;

  document.getElementById("rewardQuota").value =
    d.quota || 1;

  document.getElementById("rewardExpireDays").value =
    d.expireDays || 30;

};


/* ===============================
   TOGGLE
================================= */

window.toggleReward = async function(id,current){

  await updateDoc(
    doc(db,"rewards",id),
    {
      active:!current
    }
  );

  renderRewardAdmin();

};


/* ===============================
   DELETE
================================= */

window.deleteReward = async function(id){

  if(!confirm("Hapus reward ini?")) return;

  await deleteDoc(doc(db,"rewards",id));

  renderRewardAdmin();

};
