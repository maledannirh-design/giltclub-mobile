import { db, auth } from "../firebase.js";
import { collection, doc, getDoc, getDocs, query, orderBy, limit, setDoc, serverTimestamp } from "../firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const scoreEl = document.getElementById("scoreValue");
const livesEl = document.getElementById("livesValue");
const finalScoreEl = document.getElementById("finalScore");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const criticalNotice = document.getElementById("criticalNotice");
const weaponLabel = document.getElementById("weaponLabel");
const stageLabel=document.getElementById("stageLabel"),bossHud=document.getElementById("bossHud"),bossHealthFill=document.getElementById("bossHealthFill"),bossHealthText=document.getElementById("bossHealthText"),stageBanner=document.getElementById("stageBanner"),stageBannerTitle=document.getElementById("stageBannerTitle"),stageBannerCopy=document.getElementById("stageBannerCopy");

const WEAPONS = [
{name:"SINGLE SHOT"},{name:"DOUBLE SHOT"},{name:"TRIPLE SHOT"},{name:"RAPID TRIPLE"},{name:"TRIPLE PLASMA"},{name:"CENTRE RAPID PLASMA"},{name:"TRIPLE RAPID PLASMA"},{name:"DUAL FLAME"},{name:"TWIN ELECTRIC LASER"},{name:"HOMING ROCKET"},{name:"WIDE SPREAD"}
];
let galaxyUser=null, ownGalaxyRecord={bestScore:0,bestStage:1}, achievementSaved=false, galaxyTester=false;
const state = {
  width: 0, height: 0, dpr: 1, running: false, gameOver: false,
  score: 0, hits: 0, lastHitAt: 0, lastFrame: 0, spawnAt: 0, nextFireAt: 0,
  stage: 1, stageKills: 0, stageQuota: 12, boss: null, bossTriggered: false, bossBullets: [], stageMessageUntil: 0, weaponLevel: 1, testWeaponLevel: null, weaponNextFireAt: {}, flameCycleAt: 0, flameHitboxAt: 0, electricNextAt: 0, loopActive:false, paused:false,
  ship: { x: 0, y: 0, radius: 27 },
  bullets: [], meteors: [], particles: [], stars: [], audio: null, soundReady: false,
  pointer: { active: false, id: null, startX: 0, startY: 0, moved: false, lastX: 0, lastY: 0 }
};

function resize(){
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = rect.width; state.height = rect.height;
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  if(!state.ship.x){ state.ship.x = state.width/2; state.ship.y = state.height*.82; }
  state.ship.x = Math.max(40,Math.min(state.width-40,state.ship.x));
  state.ship.y = Math.max(100,Math.min(state.height-88,state.ship.y));
  state.stars = Array.from({length:Math.max(45,Math.round(state.width*state.height/9000))},()=>({
    x:Math.random()*state.width,y:Math.random()*state.height,
    r:Math.random()*1.4+.3,a:Math.random()*.55+.2,s:Math.random()*17+8
  }));
}
window.addEventListener("resize",resize,{passive:true});
resize();

function initSound(){
  if(state.audio){if(state.audio.state==="suspended")state.audio.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  state.audio=new AC();state.soundReady=true;
}
function playTone(kind){
  if(!state.audio||!state.soundReady)return;
  const ac=state.audio,t=ac.currentTime;
  if(kind==="danger"){
    // Three urgent rising warning pulses followed by a low alert.
    [0,.22,.44].forEach((offset,index)=>{
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.type="sawtooth";osc.frequency.setValueAtTime(index===2?880:620,t+offset);
      osc.frequency.exponentialRampToValueAtTime(index===2?430:330,t+offset+.18);
      gain.gain.setValueAtTime(.0001,t+offset);gain.gain.linearRampToValueAtTime(.075,t+offset+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,t+offset+.2);
      osc.connect(gain);gain.connect(ac.destination);osc.start(t+offset);osc.stop(t+offset+.21);
    });
    const low=ac.createOscillator(),lg=ac.createGain();low.type="triangle";
    low.frequency.setValueAtTime(190,t+.72);low.frequency.exponentialRampToValueAtTime(95,t+1.08);
    lg.gain.setValueAtTime(.0001,t+.72);lg.gain.linearRampToValueAtTime(.09,t+.78);lg.gain.exponentialRampToValueAtTime(.0001,t+1.12);
    low.connect(lg);lg.connect(ac.destination);low.start(t+.72);low.stop(t+1.13);
    return;
  }
  if(kind==="flame"){
    const osc=ac.createOscillator(),gain=ac.createGain(),filter=ac.createBiquadFilter();
    osc.type="sawtooth";osc.frequency.setValueAtTime(72,t);osc.frequency.linearRampToValueAtTime(96,t+2.8);
    filter.type="lowpass";filter.frequency.value=420;
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.055,t+.12);gain.gain.setValueAtTime(.045,t+2.7);gain.gain.exponentialRampToValueAtTime(.0001,t+3);
    osc.connect(filter);filter.connect(gain);gain.connect(ac.destination);osc.start(t);osc.stop(t+3);
    return;
  }
  if(kind==="electric"){
    const osc=ac.createOscillator(),gain=ac.createGain(),mod=ac.createOscillator(),modGain=ac.createGain();
    osc.type="sawtooth";osc.frequency.setValueAtTime(780,t);osc.frequency.exponentialRampToValueAtTime(240,t+.24);
    mod.type="square";mod.frequency.value=38;modGain.gain.value=170;mod.connect(modGain);modGain.connect(osc.frequency);
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.045,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+.32);
    osc.connect(gain);gain.connect(ac.destination);osc.start(t);mod.start(t);osc.stop(t+.34);mod.stop(t+.34);
    return;
  }
  if(kind==="shot"){
    // Bright, crisp laser snap with a short high-frequency transient.
    const osc=ac.createOscillator(),gain=ac.createGain(),filter=ac.createBiquadFilter();
    osc.type="square";osc.frequency.setValueAtTime(1180,t);osc.frequency.exponentialRampToValueAtTime(360,t+.095);
    filter.type="lowpass";filter.frequency.setValueAtTime(3200,t);filter.frequency.exponentialRampToValueAtTime(900,t+.1);
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.052,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.115);
    osc.connect(filter);filter.connect(gain);gain.connect(ac.destination);osc.start(t);osc.stop(t+.12);
    return;
  }
  // Brittle rock fracture: filtered noise crack plus a low, short impact.
  const length=Math.floor(ac.sampleRate*.32),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const decay=1-i/length;data[i]=(Math.random()*2-1)*decay*decay;}
  const noise=ac.createBufferSource(),band=ac.createBiquadFilter(),ng=ac.createGain();
  noise.buffer=buffer;band.type="bandpass";band.frequency.setValueAtTime(1250,t);band.Q.value=.7;
  ng.gain.setValueAtTime(.0001,t);ng.gain.linearRampToValueAtTime(.13,t+.012);ng.gain.exponentialRampToValueAtTime(.0001,t+.29);
  noise.connect(band);band.connect(ng);ng.connect(ac.destination);noise.start(t);noise.stop(t+.3);
  const thump=ac.createOscillator(),tg=ac.createGain();thump.type="triangle";
  thump.frequency.setValueAtTime(125,t);thump.frequency.exponentialRampToValueAtTime(38,t+.18);
  tg.gain.setValueAtTime(.0001,t);tg.gain.linearRampToValueAtTime(.09,t+.008);tg.gain.exponentialRampToValueAtTime(.0001,t+.2);
  thump.connect(tg);tg.connect(ac.destination);thump.start(t);thump.stop(t+.21);
}
function showStageMessage(title,copy,duration=2500){stageBannerTitle.textContent=title;stageBannerCopy.textContent=copy;stageBanner.classList.remove("hidden");state.stageMessageUntil=performance.now()+duration;}
function updateWeaponHud(){const w=WEAPONS[state.weaponLevel-1];weaponLabel.textContent="WEAPON LV."+state.weaponLevel+" · "+w.name;}
function unlockWeaponForStage(completedStage){const level=Math.min(11,completedStage+1);if(level<=state.weaponLevel)return false;state.weaponLevel=level;updateWeaponHud();return true;}
function resetGame(){
  state.running=true;state.paused=false;state.gameOver=false;state.score=0;state.hits=0;
  state.stage=1;state.stageKills=0;state.stageQuota=12;state.boss=null;state.bossTriggered=false;state.bossBullets=[];state.stageMessageUntil=0;state.weaponLevel=state.testWeaponLevel||1;
  state.lastHitAt=0;state.spawnAt=0;state.nextFireAt=0;state.weaponNextFireAt={};state.flameCycleAt=0;state.flameHitboxAt=0;state.electricNextAt=performance.now();state.bullets=[];state.meteors=[];state.particles=[];
  state.pointer.active=false;state.pointer.id=null;document.getElementById("pauseOverlay")?.classList.add("hidden");
  state.ship.x=state.width/2;state.ship.y=state.height*.82;
  scoreEl.textContent="000000";livesEl.textContent="♥ ♥ ♥";stageLabel.textContent="STAGE 1 · METEOR FIELD";bossHud.classList.add("hidden");stageBanner.classList.add("hidden");updateWeaponHud();
  livesEl.setAttribute("aria-label","3 lives");
  criticalNotice.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  startOverlay.classList.add("hidden");
  state.lastFrame=performance.now();
  if(!state.loopActive){state.loopActive=true;requestAnimationFrame(loop);}
}

function emitProjectile({x,y,damage=1,color="#c8f8ff",radius=4,kind=1,homing=false,laser=false,plasma=false,angle=0}){
  const speed=Math.max(520,state.height*.95);
  state.bullets.push({x,y,vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed,r:radius,damage,color,homing,laser,plasma,kind});
}
function emitFlame(x,y){
  state.bullets.push({x,y,originX:x,phase:Math.random()*Math.PI*2,age:0,life:.12,r:12,damage:1.4,color:"#ff8a35",flame:true,kind:8});
}
function fireWeapon(level,part="all"){
  const y=state.ship.y-39,wing=state.ship.radius*.92,left=state.ship.x-wing,right=state.ship.x+wing;
  const triple=(opts)=>[-15,0,15].forEach(offset=>emitProjectile({x:state.ship.x+offset,y,...opts}));
  if(level===1&&state.weaponLevel===1)emitProjectile({x:state.ship.x,y,kind:1});
  if(level===2&&state.weaponLevel===2)[left,right].forEach(x=>emitProjectile({x,y,kind:2,color:"#b9f8ff"}));
  if(level===3&&state.weaponLevel===3)triple({kind:3,color:"#9ff5ff"});
  if(level===4&&state.weaponLevel===4)triple({kind:3,color:"#9ff5ff"});
  if(level===5&&state.weaponLevel===5)triple({kind:5,color:"#ffb86b",radius:8,damage:3,plasma:true});
  if(level===6&&state.weaponLevel===6){
    if(part==="centre")emitProjectile({x:state.ship.x,y,kind:6,color:"#fff0a8",radius:9,damage:3,plasma:true});
    if(part==="wings")[left,right].forEach(x=>emitProjectile({x,y,kind:5,color:"#ffb86b",radius:8,damage:3,plasma:true}));
  }
  if(level===7&&state.weaponLevel>=7)triple({kind:7,color:"#ffcf83",radius:8,damage:3,plasma:true});
  if(level===9&&state.weaponLevel>=9)[state.ship.x-state.ship.radius*1.28,state.ship.x+state.ship.radius*1.28].forEach(x=>emitProjectile({x,y:y+10,kind:9,color:"#39bfff",radius:5,damage:3,laser:true}));
  if(level===10&&state.weaponLevel>=10)[left,right].forEach(x=>emitProjectile({x,y,kind:10,color:"#ff668e",radius:7,damage:5,homing:true}));
  if(level===11&&state.weaponLevel>=11)[-.32,.32].forEach(angle=>emitProjectile({x:state.ship.x,y,kind:11,color:"#e8f5ff",radius:4,damage:1,angle}));
}
function fire(now=performance.now(),immediate=false){
  if(!state.running)return;
  const active=[];
  const add=(level,cadence,key=String(level),part="all")=>active.push({level,cadence,key,part});
  if(state.weaponLevel===1)add(1,170);
  if(state.weaponLevel===2)add(2,170);
  if(state.weaponLevel===3)add(3,170);
  if(state.weaponLevel===4)add(4,170);
  if(state.weaponLevel===5)add(5,210);
  if(state.weaponLevel===6){add(6,85,"6-centre","centre");add(6,220,"6-wings","wings");}
  if(state.weaponLevel>=7)add(7,170);


  if(state.weaponLevel>=10)add(10,520);
  if(state.weaponLevel>=11)add(11,210);
  let fired=false;
  for(const w of active)if(immediate||now>=(state.weaponNextFireAt[w.key]||0)){
    fireWeapon(w.level,w.part);state.weaponNextFireAt[w.key]=now+w.cadence;fired=true;
  }
  if(state.bullets.length>150)state.bullets.splice(0,state.bullets.length-150);
  if(fired)playTone("shot");
}

function spawnMeteor(){if(state.boss||state.stageMessageUntil>performance.now())return;
  const roll=Math.random();
  const type=roll<.55?"small":roll<.84?"medium":"large";
  const size=type==="small"?10:type==="medium"?17:25;
  const hp=type==="small"?1:type==="medium"?3:6;
  const speed=(type==="small"?105:type==="medium"?76:54)+Math.random()*35;
  state.meteors.push({x:size+Math.random()*(state.width-size*2),y:-size,r:size,hp,maxHp:hp,vy:speed,vx:(Math.random()-.5)*45,angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*2.4,type});
}

function burst(x,y,color,count=12){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,spd=35+Math.random()*150;
    state.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:.35+Math.random()*.5,max:.85,r:1.5+Math.random()*2,color});
  }
}


function beginBoss(){
  if(state.boss||state.bossTriggered||state.gameOver)return;
  state.bossTriggered=true;
  state.meteors.length=0;state.bullets.length=0;
  const hp=260+state.stage*95;
  state.boss={x:state.width/2,y:-125,r:Math.min(100,state.width*.27),hp,maxHp:hp,age:0,nextShot:performance.now()+1050,phase:0};
  bossHud.classList.remove("hidden");updateBossHud();
  playTone("danger");
  showStageMessage("⚠ BOSS INCOMING","METEOR TITAN — DESTROY THE ENERGY CORE",2300);
}
function updateBossHud(){if(!state.boss)return;bossHealthFill.style.width=Math.max(0,state.boss.hp/state.boss.maxHp*100)+"%";bossHealthText.textContent=Math.max(0,state.boss.hp)+" / "+state.boss.maxHp;}
function defeatBoss(){
  const b=state.boss;if(!b)return;burst(b.x,b.y,"#7cecff",70);playTone("explosion");
  state.score+=250+state.stage*50;scoreEl.textContent=String(state.score).padStart(6,"0");
  state.boss=null;state.bossTriggered=false;state.bossBullets=[];bossHud.classList.add("hidden");
  const defeatedStage=state.stage;
  const weaponUnlocked=unlockWeaponForStage(defeatedStage);
  state.stage++;state.stageKills=0;state.stageQuota=12+Math.min(8,(state.stage-1)*2);state.meteors=[];state.bullets=[];
  stageLabel.textContent="STAGE "+state.stage+" · DEEP SPACE";
  showStageMessage("STAGE "+state.stage+" UNLOCKED","SELAMAT! ANDA MEMASUKI STAGE "+state.stage,2500);
  if(weaponUnlocked){window.setTimeout(()=>{if(!state.gameOver)showStageMessage("WEAPON UPGRADED!","LEVEL "+state.weaponLevel+" · "+WEAPONS[state.weaponLevel-1].name,2600);},2600);}
  state.spawnAt=performance.now()+(weaponUnlocked?5500:2800);
}
function drawBoss(b,now){
  ctx.save();ctx.translate(b.x,b.y);ctx.scale(1+Math.sin(now/260)*.018,1);
  const r=b.r;ctx.shadowBlur=30;ctx.shadowColor="#ff426f";
  const hull=ctx.createLinearGradient(0,-r,0,r);hull.addColorStop(0,"#ffd0dd");hull.addColorStop(.25,"#a84a72");hull.addColorStop(.7,"#542b65");hull.addColorStop(1,"#171a3e");
  ctx.fillStyle=hull;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.22,-r*.28);ctx.lineTo(r*1.48,r*.42);ctx.lineTo(r*1.25,r*.68);ctx.lineTo(r*.42,r*.48);ctx.lineTo(r*.22,r*.92);ctx.lineTo(0,r*1.08);ctx.lineTo(-r*.22,r*.92);ctx.lineTo(-r*.42,r*.48);ctx.lineTo(-r*1.25,r*.68);ctx.lineTo(-r*1.48,r*.42);ctx.lineTo(-r*.22,-r*.28);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#251c48";ctx.beginPath();ctx.moveTo(0,-r*.72);ctx.lineTo(r*.25,r*.7);ctx.lineTo(0,r*.9);ctx.lineTo(-r*.25,r*.7);ctx.closePath();ctx.fill();
  for(const side of [-1,1]){ctx.fillStyle="#ff668c";ctx.shadowBlur=18;ctx.shadowColor="#ff315f";ctx.beginPath();ctx.ellipse(side*r*.72,r*.43,r*.13,r*.09,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffca78";ctx.beginPath();ctx.arc(side*r*.24,-r*.12,r*.09,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle="#fff0b2";ctx.shadowBlur=20;ctx.shadowColor="#ffb347";ctx.beginPath();ctx.ellipse(0,-r*.32,r*.11,r*.2,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function damageShip(now){
  if(now-state.lastHitAt<1250)return;
  state.lastHitAt=now;state.hits++;
  burst(state.ship.x,state.ship.y,"#ff6584",24);
  const remaining=Math.max(0,3-Math.min(state.hits,3));
  livesEl.textContent=remaining?Array(remaining).fill("♥").join(" "):"♡  LAST CHANCE";
  livesEl.setAttribute("aria-label",remaining+" lives remaining");
  if(state.hits===3)criticalNotice.classList.remove("hidden");
  if(state.hits>=4)endGame();
}

function paintGalaxyLeaderboard(rows=[]){
  document.getElementById("galaxyBestScore").textContent=Number(ownGalaxyRecord.bestScore||0).toLocaleString("id-ID");
  document.getElementById("galaxyBestStage").textContent="STAGE "+Number(ownGalaxyRecord.bestStage||1);
  const list=document.getElementById("galaxyLeaderboardRows");
  list.replaceChildren();
  if(!galaxyUser){
    const p=document.createElement("p");p.className="leaderboard-empty";p.textContent="Silakan masuk ke akun GMTC untuk melihat leaderboard.";list.appendChild(p);return;
  }
  if(!rows.length){
    const p=document.createElement("p");p.className="leaderboard-empty";p.textContent="Belum ada achievement tersimpan. Jadilah pemain pertama!";list.appendChild(p);return;
  }
  rows.forEach((r,i)=>{
    const item=document.createElement("div");item.className="galaxy-rank-row";
    const rank=document.createElement("strong");rank.textContent=String(i+1).padStart(2,"0");
    const stage=document.createElement("span");stage.textContent=(r.username||"Member")+" · STAGE "+Number(r.bestStage||1);
    const score=document.createElement("b");score.textContent=Number(r.bestScore||0).toLocaleString("id-ID");
    item.append(rank,stage,score);list.appendChild(item);
  });
}
async function loadGalaxyLeaderboard(){
  const list=document.getElementById("galaxyLeaderboardRows");
  if(!galaxyUser){paintGalaxyLeaderboard([]);return;}
  list.textContent="Memuat leaderboard...";
  try{
    const q=query(collection(db,"galaxyLeaderboard"),orderBy("bestScore","desc"),limit(20));
    const snap=await getDocs(q);
    const rows=snap.docs.map(d=>({uid:d.id,...d.data()}));
    rows.sort((a,b)=>(Number(b.bestScore)||0)-(Number(a.bestScore)||0)||(Number(b.bestStage)||0)-(Number(a.bestStage)||0));
    const own=rows.find(r=>r.uid===galaxyUser.uid);
    if(own)ownGalaxyRecord={bestScore:Number(own.bestScore)||0,bestStage:Number(own.bestStage)||1};
    paintGalaxyLeaderboard(rows);
  }catch(error){
    console.error("Galaxy leaderboard read failed:",error);
    list.textContent="Leaderboard belum dapat diakses. Periksa izin Firestore.";
  }
}
async function saveGalaxyRun(buttonId="saveAchievementButton"){
  if(!galaxyUser){alert("Silakan masuk ke akun GMTC sebelum menyimpan achievement.");return false;}
  const saveButton=document.getElementById(buttonId);
  if(saveButton){saveButton.disabled=true;saveButton.textContent="SAVING...";}
  try{
    const ref=doc(db,"galaxyLeaderboard",galaxyUser.uid);
    const [oldSnap,userSnap]=await Promise.all([
      getDoc(ref),getDoc(doc(db,"users",galaxyUser.uid))
    ]);
    const old=oldSnap.exists()?oldSnap.data():{};
    const profile=userSnap.exists()?userSnap.data():{};
    const username=profile.username||profile.fullName||galaxyUser.displayName||galaxyUser.email?.split("@")[0]||"Member";
    ownGalaxyRecord={
      bestScore:Math.max(Number(old.bestScore)||0,state.score),
      bestStage:Math.max(Number(old.bestStage)||1,state.stage)
    };
    await setDoc(ref,{
      uid:galaxyUser.uid,username,
      bestScore:ownGalaxyRecord.bestScore,bestStage:ownGalaxyRecord.bestStage,
      updatedAt:serverTimestamp()
    },{merge:true});
    achievementSaved=true;
    if(saveButton){saveButton.textContent=buttonId==="saveProgressButton"?"PROGRESS SAVED ✓":"ACHIEVEMENT SAVED ✓";saveButton.classList.add("is-saved");}
    return true;
  }catch(error){
    console.error("Galaxy achievement save failed:",error);
    if(saveButton){saveButton.disabled=false;saveButton.textContent=buttonId==="saveProgressButton"?"SAVE PROGRESS":"SAVE ACHIEVEMENT";}
    alert("Achievement belum berhasil disimpan. Silakan coba lagi.");
    return false;
  }
}
function renderGalaxyLeaderboard(){
  const modal=document.getElementById("galaxyLeaderboard");
  if(!modal)return;
  modal.classList.remove("hidden");
  loadGalaxyLeaderboard();
}
function pauseGame(){
  if(!state.running||state.gameOver)return;
  state.running=false;state.paused=true;state.pointer.active=false;state.pointer.id=null;
  const stage=document.getElementById("pauseStageValue"),score=document.getElementById("pauseScoreValue");
  if(stage)stage.textContent=String(state.stage);
  if(score)score.textContent=state.score.toLocaleString("id-ID");
  const save=document.getElementById("saveProgressButton");
  if(save){save.disabled=false;save.textContent="SAVE PROGRESS";save.classList.remove("is-saved");}
  const note=document.getElementById("pauseSaveNote");
  if(note)note.textContent="Simpan score dan stage terbaik ke achievement GMTC.";
  document.getElementById("pauseOverlay")?.classList.remove("hidden");
}
function endGame(){
  state.running=false;state.gameOver=true;
  achievementSaved=false;
  const saveButton=document.getElementById("saveAchievementButton");
  if(saveButton){saveButton.disabled=false;saveButton.textContent="SAVE ACHIEVEMENT";saveButton.classList.remove("is-saved");}
  finalScoreEl.textContent=state.score.toLocaleString("id-ID");
  gameOverOverlay.classList.remove("hidden");
}

function drawBackground(dt){
  ctx.fillStyle="#050816";ctx.fillRect(0,0,state.width,state.height);
  for(const star of state.stars){
    star.y+=star.s*dt;if(star.y>state.height){star.y=0;star.x=Math.random()*state.width;}
    ctx.globalAlpha=star.a;ctx.fillStyle="#d9eaff";ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  const glow=ctx.createRadialGradient(state.width*.5,state.height*.55,10,state.width*.5,state.height*.55,state.width*.75);
  glow.addColorStop(0,"rgba(30,75,145,.13)");glow.addColorStop(1,"rgba(3,7,20,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,state.width,state.height);
}

function drawShip(now){
  const {x,y,radius:r}=state.ship,flashing=now-state.lastHitAt<800;
  if(flashing&&Math.floor(now/90)%2===0)return;
  ctx.save();ctx.translate(x,y);ctx.shadowBlur=28;ctx.shadowColor="#48dfff";
  const hull=ctx.createLinearGradient(0,-r-20,0,r+24);hull.addColorStop(0,"#fff");hull.addColorStop(.32,"#8cf0ff");hull.addColorStop(.72,"#367eae");hull.addColorStop(1,"#152e59");
  ctx.fillStyle=hull;ctx.beginPath();ctx.moveTo(0,-r-20);ctx.lineTo(r*.28,-r*.35);ctx.lineTo(r*1.38,r*.48);ctx.lineTo(r*1.2,r*.82);ctx.lineTo(r*.42,r*.62);ctx.lineTo(r*.22,r*1.05);ctx.lineTo(0,r*1.28);ctx.lineTo(-r*.22,r*1.05);ctx.lineTo(-r*.42,r*.62);ctx.lineTo(-r*1.2,r*.82);ctx.lineTo(-r*1.38,r*.48);ctx.lineTo(-r*.28,-r*.35);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#173b68";ctx.beginPath();ctx.moveTo(0,-r-12);ctx.lineTo(r*.3,r*.8);ctx.lineTo(0,r*1.12);ctx.lineTo(-r*.3,r*.8);ctx.closePath();ctx.fill();
  ctx.fillStyle="#4eabc9";ctx.beginPath();ctx.moveTo(-r*.32,-r*.18);ctx.lineTo(-r*1.08,r*.48);ctx.lineTo(-r*.52,r*.4);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.32,-r*.18);ctx.lineTo(r*1.08,r*.48);ctx.lineTo(r*.52,r*.4);ctx.closePath();ctx.fill();
  const cockpit=ctx.createLinearGradient(-8,-r*.55,8,r*.35);cockpit.addColorStop(0,"#fff");cockpit.addColorStop(.4,"#a8faff");cockpit.addColorStop(1,"#247ac1");
  ctx.fillStyle=cockpit;ctx.beginPath();ctx.ellipse(0,-r*.28,r*.2,r*.42,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(0,r*.35);ctx.fillStyle="#fff2b5";ctx.font="900 10px system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowBlur=8;ctx.shadowColor="#f5d36b";ctx.fillText("GMTC",0,0);ctx.restore();
  ctx.strokeStyle="#d8fbff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.38,r*.08);ctx.lineTo(-r*1.05,r*.62);ctx.moveTo(r*.38,r*.08);ctx.lineTo(r*1.05,r*.62);ctx.stroke();
  for(const side of [-1,1]){const ex=side*r*.56;ctx.fillStyle="#ffb45d";ctx.shadowBlur=18;ctx.shadowColor="#ff8a45";ctx.beginPath();ctx.moveTo(ex-4,r*.78);ctx.lineTo(ex,r+24+Math.random()*8);ctx.lineTo(ex+4,r*.78);ctx.closePath();ctx.fill();ctx.fillStyle="#d8fbff";ctx.fillRect(ex-5,r*.67,10,7);}
  ctx.restore();
}

function drawMeteor(m){
  ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle);
  ctx.fillStyle=m.type==="large"?"#806b65":m.type==="medium"?"#887f79":"#9b9189";
  ctx.strokeStyle="#c5b2a3";ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const rr=m.r*(.78+((i*7)%4)*.075);const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle="rgba(30,24,25,.25)";
  ctx.beginPath();ctx.arc(-m.r*.25,-m.r*.1,m.r*.2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function update(dt,now){
  // Hold-to-fire: tembakan otomatis selama jari masih menahan pesawat.
  if(state.pointer.active)fire(now,false);
  const flameUnlocked=state.weaponLevel>=5;
  if(!state.pointer.active)state.flameCycleAt=0;
  if(flameUnlocked&&state.pointer.active){
    if(!state.flameCycleAt){state.flameCycleAt=now;state.flameHitboxAt=0;playTone("flame");}
    let flamePhase=(now-state.flameCycleAt)%5000;
    if(flamePhase<dt*1000&&now-state.flameCycleAt>dt*1000)playTone("flame");
    if(flamePhase<3000&&now>=state.flameHitboxAt){
      const flameXs=state.weaponLevel>=8?[state.ship.x-state.ship.radius*.92,state.ship.x+state.ship.radius*.92]:[state.ship.x];
      for(const x of flameXs)emitFlame(x,state.ship.y-39);
      state.flameHitboxAt=now+100;
    }
  }
  if(state.weaponLevel>=9&&state.pointer.active&&now>=state.electricNextAt){
    fireWeapon(9);state.electricNextAt=now+1500;playTone("electric");
  }
  if(state.stageMessageUntil&&now>=state.stageMessageUntil){stageBanner.classList.add("hidden");state.stageMessageUntil=0;}
  if(state.boss){
    const b=state.boss;b.age+=dt;b.phase+=dt;b.x=state.width/2+Math.sin(b.phase*.62)*Math.max(0,state.width*.25-b.r*.3);b.y=Math.min(state.height*.19,b.y+62*dt);
    if(now>=b.nextShot){const dx=state.ship.x-b.x,dy=state.ship.y-b.y,len=Math.hypot(dx,dy)||1,base=Math.atan2(dy,dx);for(const spread of (state.stage>=5?[-.28,0,.28]:[-.16,.16])){const angle=base+spread;state.bossBullets.push({x:b.x,y:b.y+b.r*.58,vx:Math.cos(angle)*245,vy:Math.sin(angle)*245,r:9});}b.nextShot=now+Math.max(470,900-state.stage*28);}
    for(let i=state.bossBullets.length-1;i>=0;i--){const q=state.bossBullets[i];q.x+=q.vx*dt;q.y+=q.vy*dt;const dx=q.x-state.ship.x,dy=q.y-state.ship.y;if(dx*dx+dy*dy<(q.r+state.ship.radius*.5)**2){state.bossBullets.splice(i,1);damageShip(now);}else if(q.y>state.height+20||q.x<-20||q.x>state.width+20)state.bossBullets.splice(i,1);}
  }else if(now>=state.spawnAt){spawnMeteor();state.spawnAt=now+Math.max(420,1250-state.score*.12);}
  for(const b of state.bullets){
    if(b.flame){b.age+=dt;b.y-=Math.max(125,state.height*.24)*dt;b.x=b.originX+Math.sin(b.age*25+b.phase)*9;continue;}
    if(b.homing){
      let target=state.boss;
      if(!target&&state.meteors.length)target=state.meteors.reduce((best,m)=>!best||Math.hypot(m.x-b.x,m.y-b.y)<Math.hypot(best.x-b.x,best.y-b.y)?m:best,null);
      if(target){const dx=target.x-b.x,dy=target.y-b.y,len=Math.hypot(dx,dy)||1,speed=Math.max(520,state.height*.95);b.vx+=(dx/len*speed-b.vx)*Math.min(1,dt*3.5);b.vy+=(dy/len*speed-b.vy)*Math.min(1,dt*3.5);}
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  if(state.boss){const boss=state.boss;for(let j=state.bullets.length-1;j>=0;j--){const q=state.bullets[j],dx=q.x-boss.x,dy=q.y-boss.y;if(dx*dx+dy*dy<(boss.r+q.r)**2){state.bullets.splice(j,1);boss.hp-=q.damage||1;if(boss.hp<=0){defeatBoss();break;}}}updateBossHud();}
  state.bullets=state.bullets.filter(b=>b.flame?b.age<b.life:b.y>-70);
  for(const m of state.meteors){m.x+=m.vx*dt;m.y+=m.vy*dt;m.angle+=m.spin*dt;if(m.x<m.r||m.x>state.width-m.r)m.vx*=-1;}
  for(let i=state.meteors.length-1;i>=0;i--){
    const m=state.meteors[i];
    let destroyed=false;
    for(let j=state.bullets.length-1;j>=0;j--){
      const b=state.bullets[j],dx=b.x-m.x,dy=b.y-m.y;
      if(dx*dx+dy*dy<(m.r+b.r)*(m.r+b.r)){
        state.bullets.splice(j,1);m.hp-=b.damage||1;
        if(m.hp<=0){
          state.score+=m.type==="small"?10:m.type==="medium"?25:50;state.stageKills++;playTone("explosion");
          scoreEl.textContent=String(state.score).padStart(6,"0");
          burst(m.x,m.y,m.type==="large"?"#ffb45d":"#b9dfff",m.type==="large"?30:14);
          state.meteors.splice(i,1);destroyed=true;if(state.stageKills>=state.stageQuota&&!state.boss)beginBoss();break;
        }
      }
    }
    if(destroyed)continue;
    const dx=m.x-state.ship.x,dy=m.y-state.ship.y;
    if(dx*dx+dy*dy<(m.r+state.ship.radius*.65)**2){burst(m.x,m.y,"#ff9a68",18);state.meteors.splice(i,1);damageShip(now);continue;}
    if(m.y>state.height+m.r)state.meteors.splice(i,1);
  }
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;p.life-=dt;}
  state.particles=state.particles.filter(p=>p.life>0);
}

function render(now,dt){
  drawBackground(dt);
  for(const b of state.bullets){
    ctx.save();ctx.shadowBlur=b.kind>=5?18:12;ctx.shadowColor=b.color;ctx.fillStyle=b.color;
    if(b.flame){
      // Flame hitboxes are invisible; the continuous jet is drawn from the ship below.
    }else if(b.laser){
      const beamLength=state.ship.radius*2;
      ctx.shadowBlur=20;ctx.shadowColor="#38bfff";ctx.strokeStyle="#45caff";ctx.lineWidth=3;ctx.beginPath();
      ctx.moveTo(b.x,b.y+beamLength*.5);
      for(let step=1;step<=7;step++){const yy=b.y+beamLength*.5-step*(beamLength/7);ctx.lineTo(b.x+Math.sin(now/23+step*2.4+b.x)*5,yy);}
      ctx.stroke();ctx.strokeStyle="#e8fbff";ctx.lineWidth=1.1;ctx.stroke();
    }else if(b.homing){
      ctx.beginPath();ctx.moveTo(b.x,b.y-12);ctx.lineTo(b.x+b.r,b.y+5);ctx.lineTo(b.x,b.y+2);ctx.lineTo(b.x-b.r,b.y+5);ctx.closePath();ctx.fill();
      ctx.fillStyle="#ffcf9b";ctx.fillRect(b.x-2,b.y+4,4,8);
    }else if(b.plasma){
      const g=ctx.createRadialGradient(b.x-b.r*.2,b.y-b.r*.5,1,b.x,b.y,b.r*1.8);
      g.addColorStop(0,"#fffbd0");g.addColorStop(.35,b.color);g.addColorStop(1,"rgba(255,130,70,0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*1.75,0,0,Math.PI*2);ctx.fill();
    }else ctx.fillRect(b.x-b.r/2,b.y-10,b.r,15);
    ctx.restore();
  }
  const flamePhase=state.weaponLevel>=5&&state.flameCycleAt?((now-state.flameCycleAt)%5000):5000;
  if(state.pointer.active&&flamePhase<3000){
    const flameXs=state.weaponLevel>=8?[state.ship.x-state.ship.radius*.92,state.ship.x+state.ship.radius*.92]:[state.ship.x];
    for(const flameX of flameXs){
      ctx.save();ctx.globalAlpha=.92;ctx.shadowBlur=24;ctx.shadowColor="#ff7028";
      for(let puff=0;puff<18;puff++){
        const progress=puff/17,py=state.ship.y-state.ship.radius-8-progress*state.ship.radius*4;
        const sway=Math.sin(now/42+puff*1.7+flameX)*state.ship.radius*.22;
        const width=state.ship.radius*(.12+progress*.26)*(0.75+Math.sin(now/55+puff)*.2);
        const grad=ctx.createRadialGradient(flameX+sway,py,1,flameX+sway,py,width*1.8);
        grad.addColorStop(0,"rgba(255,255,220,.98)");grad.addColorStop(.28,"rgba(255,220,90,.96)");grad.addColorStop(.68,"rgba(255,94,22,.84)");grad.addColorStop(1,"rgba(95,20,5,0)");
        ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(flameX+sway,py,width,width*1.65,0,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  }
  for(const m of state.meteors)drawMeteor(m);
  if(state.boss)drawBoss(state.boss,now);
  for(const q of state.bossBullets){ctx.save();ctx.shadowBlur=14;ctx.shadowColor="#ff5c91";ctx.fillStyle="#ff9bb8";ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.restore();}
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;drawShip(now);
}

function loop(now){
  if(!state.running){state.loopActive=false;return;}
  const dt=Math.min(.033,(now-state.lastFrame)/1000||0);state.lastFrame=now;
  update(dt,now);render(now,dt);
  if(state.running)requestAnimationFrame(loop);else state.loopActive=false;
}

canvas.addEventListener("pointerdown",event=>{
  if(!state.running||state.pointer.active)return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const dx=x-state.ship.x,dy=y-state.ship.y;
  if(dx*dx+dy*dy>(state.ship.radius+28)**2)return;
  event.preventDefault();
  state.pointer={active:true,id:event.pointerId,startX:x,startY:y,moved:false,lastX:x,lastY:y};
  canvas.setPointerCapture?.(event.pointerId);
  if(!state.audio)initSound();
  if(state.audio?.state==="suspended")state.audio.resume().catch(()=>{});
  fire(performance.now(),true); // Semua senjata aktif langsung menembak saat sentuhan pertama.
  state.nextFireAt=performance.now()+170;
});
canvas.addEventListener("pointermove",event=>{
  const p=state.pointer;if(!p.active||p.id!==event.pointerId)return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(Math.hypot(x-p.startX,y-p.startY)>8)p.moved=true;
  if(p.moved){state.ship.x=Math.max(40,Math.min(state.width-40,x));state.ship.y=Math.max(100,Math.min(state.height-88,y));}
  p.lastX=x;p.lastY=y;
});
function finishPointer(event){
  const p=state.pointer;if(!p.active||p.id!==event.pointerId)return;
  state.pointer.active=false;state.pointer.id=null;
}
canvas.addEventListener("pointerup",finishPointer);
canvas.addEventListener("pointercancel",event=>{if(state.pointer.id===event.pointerId){state.pointer.active=false;state.pointer.id=null;}});
document.getElementById("startButton").addEventListener("click",()=>{
  initSound();
  if(state.audio?.state==="suspended")state.audio.resume().catch(()=>{});
  try { const fullscreenRequest=document.documentElement.requestFullscreen?.(); fullscreenRequest?.catch(()=>{}); } catch {}
  resetGame();
});
document.getElementById("restartButton").addEventListener("click",()=>{initSound();resetGame();});
document.getElementById("saveAchievementButton")?.addEventListener("click",saveGalaxyRun);
document.getElementById("openLeaderboardButton")?.addEventListener("click",renderGalaxyLeaderboard);
document.getElementById("openLeaderboardFromGameOver")?.addEventListener("click",renderGalaxyLeaderboard);
document.getElementById("closeGalaxyLeaderboard")?.addEventListener("click",()=>document.getElementById("galaxyLeaderboard")?.classList.add("hidden"));
document.getElementById("galaxyLeaderboard")?.addEventListener("click",event=>{if(event.target.id==="galaxyLeaderboard")event.currentTarget.classList.add("hidden");});
document.getElementById("pauseGameButton")?.addEventListener("click",pauseGame);
document.getElementById("saveProgressButton")?.addEventListener("click",async()=>{
  const button=document.getElementById("saveProgressButton"),note=document.getElementById("pauseSaveNote");
  if(button){button.disabled=true;button.textContent="SAVING...";}
  const saved=await saveGalaxyRun("saveProgressButton");
  if(note)note.textContent=saved?"Progress terbaik berhasil disimpan.":"Progress belum tersimpan. Silakan coba lagi.";
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.running)pauseGame();});
document.getElementById("resumeButton")?.addEventListener("click",()=>{if(state.gameOver)return;state.paused=false;state.running=true;document.getElementById("pauseOverlay")?.classList.add("hidden");state.lastFrame=performance.now();if(!state.loopActive){state.loopActive=true;requestAnimationFrame(loop);}});
onAuthStateChanged(auth,async user=>{
  galaxyUser=user||null;galaxyTester=false;
  const testPanel=document.getElementById("adminWeaponTest");
  if(!user){testPanel?.classList.add("hidden");return;}
  try{
    // One profile read on authentication only; no realtime listener.
    const profileSnap=await getDoc(doc(db,"users",user.uid));
    const role=String(profileSnap.exists()?profileSnap.data().role||"": "").trim().toUpperCase();
    galaxyTester=role==="ADMIN"||role==="SUPERCOACH";
    testPanel?.classList.toggle("hidden",!galaxyTester);
  }catch(error){
    console.warn("Galaxy tester role check unavailable:",error);
    testPanel?.classList.add("hidden");
  }
});
document.getElementById("applyTestWeaponButton")?.addEventListener("click",()=>{
  if(!galaxyTester||state.running)return;
  const picker=document.getElementById("testWeaponSelect");
  const selected=Math.max(1,Math.min(11,Number(picker?.value)||1));
  state.testWeaponLevel=selected;state.weaponLevel=selected;state.weaponNextFireAt={};
  updateWeaponHud();
  const note=document.getElementById("testWeaponNote");
  if(note)note.textContent="TEST LOADOUT READY · LEVEL "+selected;
});
updateWeaponHud();
drawBackground(0);
drawShip(0);
