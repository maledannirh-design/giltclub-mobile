import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc } from "./firestore.js";

window.userCache = {};
window.skillCache = {};

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

let skills = {};

if(skillSnap.exists()){
  skills = skillSnap.data();
}

/* -------------------------
   CALCULATE TOTAL STARS
------------------------- */

let totalStars = 0;

Object.values(skills).forEach(v=>{
  totalStars += Number(v || 0);
});

/* -------------------------
   BUILD HTML
------------------------- */

// 🔥 dashboard sendiri = tidak bisa edit
const editable = false;

let html = `

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
            ${renderStars(val, skillKey, false)}
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

export async function renderSkillByUserId(userId){

  const content = document.getElementById("skillContent");
  if(!content) return;

  content.innerHTML = "Loading...";

  try{

    let userData;
    let skills;

    // 🔥 USER CACHE
    if(userCache[userId]){
      userData = userCache[userId];
    }else{
      const userSnap = await getDoc(doc(db,"users",userId));
      userData = userSnap.exists() ? userSnap.data() : {};
      userCache[userId] = userData;
    }

    // 🔥 SKILL CACHE
    if(skillCache[userId]){
      skills = skillCache[userId];
    }else{
      const skillSnap = await getDoc(doc(db,"userSkills",userId));
      skills = skillSnap.exists() ? skillSnap.data() : {};
      skillCache[userId] = skills;
    }

    // 🔥 BUILD UI
    const html = buildSkillHTML(userData, skills, userId);

    content.innerHTML = html;

  }catch(err){
    console.error(err);
    content.innerHTML = "Error load";
  }
}

function canEditSkill(userData){
  return ["coach","admin","supercoach"].includes(userData?.role);
}

export function renderStars(value){

  let html = "";

  for(let i=1; i<=5; i++){
    html += `
      <span class="star ${i <= value ? 'active' : ''}">
        ★
      </span>
    `;
  }

  return html;
}

function buildSkillHTML(user, skills, userId){

  let html = `
    <div class="skill-wrapper">

      <div class="skill-header">
        Dashboard Skill
      </div>

      <div class="skill-topcard">
        <div class="skill-title">${user.username || "Member"}</div>
        <div class="skill-level">${user.playingLevel || "Newbie"}</div>
      </div>
  `;

  Object.entries(skillCategories).forEach(([category,list])=>{

    html += `<div class="skill-category">${category}</div>`;

    list.forEach(skillKey=>{

      const val = skills[skillKey] || 0;

      html += `
        <div class="skill-row">
          <div class="skill-name">${skillLabels[skillKey]}</div>
          <div class="skill-stars">
            ${renderStars(val)}
          </div>
        </div>
      `;
    });

  });

  html += `</div>`;

  return html;
}


window.onClickStar = async function(skillKey, value){

  if(!canEditSkill(userData)){
    showToast("Tidak punya akses");
    return;
  }

  const current = currentSkillData[skillKey] || 0;

  const finalValue = (current === value) ? 0 : value;

  try{

    // update local
    currentSkillData[skillKey] = finalValue;

    // update UI langsung
    const row = document.querySelector(`[data-skill="${skillKey}"]`);
    const stars = row.querySelectorAll(".star");

    stars.forEach((s, i)=>{
      s.classList.toggle("active", i < finalValue);
    });

    // 🔥 SAVE KE FIRESTORE
    await setDoc(
      doc(db,"userSkills", currentViewedUserId),
      currentSkillData,
      { merge:true }
    );

  }catch(err){
    console.error(err);
    showToast("Gagal simpan");
  }
}

window.onClickStar = function(){
  return; // 🔥 matikan total
}

