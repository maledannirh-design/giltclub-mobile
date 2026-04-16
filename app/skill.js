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
      stars += `<span class="star">⭐</span>`;
    }else{
      stars += `<span class="star off">⭐</span>`;
    }

  }

  return stars;

}


/* ======================================================
   STAR EXPLOSION EFFECT
====================================================== */

function starExplosion(){

  const wrapper = document.querySelector(".skill-wrapper");
  if(!wrapper) return;

  for(let i=0;i<35;i++){

    const star=document.createElement("div");

    star.className="explosion-star";
    star.innerText="⭐";

    const x=(Math.random()*220)-110;
    const y=(Math.random()*220)-110;

    star.style.setProperty("--x",x+"px");
    star.style.setProperty("--y",y+"px");

    star.style.left="50%";
    star.style.top="120px";

    wrapper.appendChild(star);

    setTimeout(()=>{
      star.remove();
    },1800);

  }

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

  const userSnap = await getDoc(doc(db,"users",uid));

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

  const skillSnap = await getDoc(doc(db,"userSkills",uid));

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

  /* trigger star explosion */

  setTimeout(()=>{
    starExplosion();
  },250);

}

export function renderSkillDashboard(data, userId){

  const skills = data.skills || {};

  // 🔥 tentukan apakah bisa edit
  const editable = canEditSkill(userData);

  // 🔥 penting: set global target (biar onClickStar tau user mana)
  window.currentViewedUserId = userId;

  // 🔥 cache data sekarang (biar bisa compare saat klik)
  window.currentSkillData = data;

  return `
    <div data-skill="hitTiming">
      <div class="skill-label">Hit Timing</div>
      ${renderStars(skills.hitTiming || 0, "hitTiming", editable)}
    </div>

    <div data-skill="stance">
      <div class="skill-label">Stance</div>
      ${renderStars(skills.stance || 0, "stance", editable)}
    </div>

    <div data-skill="grip">
      <div class="skill-label">Grip</div>
      ${renderStars(skills.grip || 0, "grip", editable)}
    </div>
  `;
}

function canEditSkill(userData){
  return (
    userData.role === "admin" ||
    userData.role === "supercoach" ||
    userData.coachVerified === true
  );
}

export function renderStars(value, skillKey, editable){

  let html = "";

  for(let i=1; i<=5; i++){
    html += `
      <span 
        class="star ${i <= value ? 'active' : ''}"
        ${editable ? `onclick="onClickStar('${skillKey}', ${i})"` : ""}
      >★</span>
    `;
  }

  return html;
}
