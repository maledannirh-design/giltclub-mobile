/* ======================================================
   RENDER SKILL PAGE
====================================================== */

export function renderSkill(){

  const content = document.getElementById("content");
  if(!content) return;

  content.innerHTML = `
    <div style="padding:20px;">
      
      <h2 style="margin-bottom:20px;">
        ⭐ Skill
      </h2>

      <div style="
        background:#fff;
        padding:20px;
        border-radius:16px;
        box-shadow:0 6px 18px rgba(0,0,0,.1);
      ">

        <p style="margin-bottom:10px;">
          Skill system akan tampil di sini.
        </p>

        <p style="font-size:13px;opacity:.7;">
          Coming soon...
        </p>

      </div>

    </div>
  `;
}

import { auth, db } from "./firebase.js";
import { doc, getDoc } from "./firestore.js";

/* ======================================================
   SKILL ORDER & CATEGORY
====================================================== */

const skillCategories = {

  "Newbie":[
    "hitTiming",
    "stance",
    "griphand",
    "basicServe",
    "basicReturnServe",
    "returnVolley",
    "overhead",
    "forehandBasic",
    "backhandBasic"
  ],

  "Beginner":[
    "backhandVolley",
    "forehandVolley",
    "baselineVolley",
    "forehandSpin",
    "backhandSpin"
  ],

  "Upper Beginner":[
    "footwork",
    "forehandSlice",
    "backhandSlice",
    "dribblingShot",
    "baselineRally"
  ],

  "Intermediate":[
    "lowGroundVolley",
    "highForehand",
    "highBackhand",
    "highSlice",
    "flatServe",
    "secondSliceServe",
    "dribblingBaseline",
    "dropShot"
  ]

};


/* ======================================================
   SKILL LABELS
====================================================== */

const skillLabels = {

  hitTiming:"Hit Timing",
  stance:"Stance",
  griphand:"Griphand",
  basicServe:"Basic Serve",
  basicReturnServe:"Basic Return Serve",
  returnVolley:"Return Volley",
  overhead:"Overhead",
  forehandBasic:"Forehand Basic",
  backhandBasic:"Backhand Basic",

  backhandVolley:"Backhand Volley",
  forehandVolley:"Forehand Volley",
  baselineVolley:"Baseline Volley",
  forehandSpin:"Forehand Spin",
  backhandSpin:"Backhand Spin",

  footwork:"Footwork",
  forehandSlice:"Forehand Slice",
  backhandSlice:"Backhand Slice",
  dribblingShot:"Dribbling Shot",
  baselineRally:"Baseline Rally",

  lowGroundVolley:"Low Ground Volley",
  highForehand:"High Forehand",
  highBackhand:"High Backhand",
  highSlice:"High Slice",
  flatServe:"Flat Serve",
  secondSliceServe:"Second Slice Serve",
  dribblingBaseline:"Dribbling Baseline",
  dropShot:"Drop Shot"

};


/* ======================================================
   STAR RENDER
====================================================== */

function renderStars(value=0){

  let stars="";

  for(let i=1;i<=5;i++){

    if(i<=value){
      stars+="⭐";
    }else{
      stars+="☆";
    }

  }

  return stars;

}


/* ======================================================
   RENDER SKILL PAGE
====================================================== */

export async function renderSkill(){

  const content = document.getElementById("content");
  if(!content) return;

  const user = auth.currentUser;
  if(!user) return;

  const uid = user.uid;

  /* -------------------------
     GET USER PROFILE
  ------------------------- */

  const userRef = doc(db,"users",uid);
  const userSnap = await getDoc(userRef);

  let username="Member";
  let playingLevel="Newbie";

  if(userSnap.exists()){

    const u=userSnap.data();

    username = u.username || u.name || "Member";
    playingLevel = u.playingLevel || "Newbie";

  }

  /* -------------------------
     GET USER SKILLS
  ------------------------- */

  const skillRef = doc(db,"userSkills",uid);
  const skillSnap = await getDoc(skillRef);

  let skills={};

  if(skillSnap.exists()){
    skills = skillSnap.data();
  }

  /* -------------------------
     CALCULATE TOTAL STARS
  ------------------------- */

  let totalStars=0;

  Object.values(skills).forEach(v=>{
    totalStars += Number(v || 0);
  });

  /* -------------------------
     BUILD HTML
  ------------------------- */

  let html=`

  <div class="skill-wrapper">

    <div class="skill-header">
      Dashboard Skill
    </div>

    <div class="skill-topcard">

      <div class="skill-title">
        ${username}
      </div>

      <div class="skill-level">
        ${playingLevel}
      </div>

      <div class="skill-total">
        ⭐ ${totalStars}
      </div>

    </div>

  `;


  /* -------------------------
     RENDER SKILL LIST
  ------------------------- */

  Object.entries(skillCategories).forEach(([category,list])=>{

    html+=`
      <div class="skill-category">
        ${category}
      </div>
    `;

    list.forEach(skillKey=>{

      const val = skills[skillKey] || 0;

      html+=`

        <div class="skill-row">

          <div class="skill-name">
            ${skillLabels[skillKey]}
          </div>

          <div class="skill-stars">
            ${renderStars(val)}
          </div>

        </div>

      `;

    });

  });

  html+=`</div>`;

  content.innerHTML=html;

}
