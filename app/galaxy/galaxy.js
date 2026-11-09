const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const scoreEl = document.getElementById("scoreValue");
const livesEl = document.getElementById("livesValue");
const finalScoreEl = document.getElementById("finalScore");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const criticalNotice = document.getElementById("criticalNotice");
const stageLabel=document.getElementById("stageLabel"),bossHud=document.getElementById("bossHud"),bossHealthFill=document.getElementById("bossHealthFill"),bossHealthText=document.getElementById("bossHealthText"),stageBanner=document.getElementById("stageBanner"),stageBannerTitle=document.getElementById("stageBannerTitle"),stageBannerCopy=document.getElementById("stageBannerCopy");

const state = {
  width: 0, height: 0, dpr: 1, running: false, gameOver: false,
  score: 0, hits: 0, lastHitAt: 0, lastFrame: 0, spawnAt: 0, nextFireAt: 0,
  stage: 1, stageKills: 0, stageQuota: 12, boss: null, bossBullets: [], stageMessageUntil: 0,
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
function resetGame(){
  state.running=true;state.gameOver=false;state.score=0;state.hits=0;
  state.stage=1;state.stageKills=0;state.stageQuota=12;state.boss=null;state.bossBullets=[];state.stageMessageUntil=0;
  state.lastHitAt=0;state.spawnAt=0;state.nextFireAt=0;state.bullets=[];state.meteors=[];state.particles=[];
  state.pointer.active=false;state.pointer.id=null;
  state.ship.x=state.width/2;state.ship.y=state.height*.82;
  scoreEl.textContent="000000";livesEl.textContent="♥ ♥ ♥";stageLabel.textContent="STAGE 1 · METEOR FIELD";bossHud.classList.add("hidden");stageBanner.classList.add("hidden");
  livesEl.setAttribute("aria-label","3 lives");
  criticalNotice.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  startOverlay.classList.add("hidden");
  state.lastFrame=performance.now();
  requestAnimationFrame(loop);
}

function fire(){
  if(!state.running)return;
  state.bullets.push({x:state.ship.x,y:state.ship.y-76,vy:-Math.max(520,state.height*.95),r:4});playTone("shot");
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
  state.meteors.length=0;state.bullets.length=0;
  const hp=42+state.stage*18;
  state.boss={x:state.width/2,y:-90,r:Math.min(76,state.width*.19),hp,maxHp:hp,age:0,nextShot:performance.now()+1300,phase:0};
  bossHud.classList.remove("hidden");updateBossHud();
  playTone("danger");
  showStageMessage("⚠ BOSS INCOMING","METEOR TITAN — DESTROY THE ENERGY CORE",2300);
}
function updateBossHud(){if(!state.boss)return;bossHealthFill.style.width=Math.max(0,state.boss.hp/state.boss.maxHp*100)+"%";bossHealthText.textContent=Math.max(0,state.boss.hp)+" / "+state.boss.maxHp;}
function defeatBoss(){
  const b=state.boss;if(!b)return;burst(b.x,b.y,"#7cecff",70);playTone("explosion");
  state.score+=250+state.stage*50;scoreEl.textContent=String(state.score).padStart(6,"0");
  state.boss=null;state.bossBullets=[];bossHud.classList.add("hidden");
  state.stage++;state.stageKills=0;state.stageQuota=12+Math.min(8,(state.stage-1)*2);state.meteors=[];state.bullets=[];
  stageLabel.textContent="STAGE "+state.stage+" · DEEP SPACE";
  showStageMessage("STAGE "+state.stage+" UNLOCKED","SELAMAT! ANDA MEMASUKI STAGE "+state.stage,3200);
  state.spawnAt=performance.now()+3400;
}
function drawBoss(b,now){
  ctx.save();ctx.translate(b.x,b.y);ctx.scale(1+Math.sin(now/180)*.035,1+Math.sin(now/180)*.035);
  ctx.shadowBlur=35;ctx.shadowColor="#ff4d8d";
  const core=ctx.createRadialGradient(-b.r*.22,-b.r*.28,4,0,0,b.r);
  core.addColorStop(0,"#fff2c5");core.addColorStop(.22,"#ffbd65");core.addColorStop(.62,"#a94742");core.addColorStop(1,"#341b35");
  ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle="#ff9e78";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,b.r*1.28,b.r*.48,Math.sin(now/650)*.22,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2+now/1700;ctx.fillStyle="#693944";ctx.beginPath();ctx.moveTo(Math.cos(a)*b.r*.72,Math.sin(a)*b.r*.72);ctx.lineTo(Math.cos(a-.16)*b.r*1.45,Math.sin(a-.16)*b.r*1.45);ctx.lineTo(Math.cos(a+.16)*b.r*1.45,Math.sin(a+.16)*b.r*1.45);ctx.closePath();ctx.fill();}
  ctx.fillStyle="#fff0b2";ctx.shadowBlur=22;ctx.shadowColor="#ffb347";ctx.beginPath();ctx.arc(0,0,b.r*.3,0,Math.PI*2);ctx.fill();ctx.restore();
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

function endGame(){
  state.running=false;state.gameOver=true;
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
  if(state.pointer.active && now>=state.nextFireAt){
    fire();
    state.nextFireAt=now+170;
  }
  if(state.stageMessageUntil&&now>=state.stageMessageUntil){stageBanner.classList.add("hidden");state.stageMessageUntil=0;}
  if(state.boss){
    const b=state.boss;b.age+=dt;b.phase+=dt;b.x=state.width/2+Math.sin(b.phase*.8)*Math.max(0,state.width*.29-b.r*.25);b.y=Math.min(state.height*.22,b.y+90*dt);
    if(now>=b.nextShot){const dx=state.ship.x-b.x,dy=state.ship.y-b.y,len=Math.hypot(dx,dy)||1;state.bossBullets.push({x:b.x,y:b.y+b.r*.65,vx:dx/len*180,vy:dy/len*180,r:8});b.nextShot=now+Math.max(650,1150-state.stage*35);}
    for(let i=state.bossBullets.length-1;i>=0;i--){const q=state.bossBullets[i];q.x+=q.vx*dt;q.y+=q.vy*dt;const dx=q.x-state.ship.x,dy=q.y-state.ship.y;if(dx*dx+dy*dy<(q.r+state.ship.radius*.5)**2){state.bossBullets.splice(i,1);damageShip(now);}else if(q.y>state.height+20||q.x<-20||q.x>state.width+20)state.bossBullets.splice(i,1);}
  }else if(now>=state.spawnAt){spawnMeteor();state.spawnAt=now+Math.max(420,1250-state.score*.12);}
  for(const b of state.bullets)b.y+=b.vy*dt;
  if(state.boss){const boss=state.boss;for(let j=state.bullets.length-1;j>=0;j--){const q=state.bullets[j],dx=q.x-boss.x,dy=q.y-boss.y;if(dx*dx+dy*dy<(boss.r+q.r)**2){state.bullets.splice(j,1);boss.hp--;if(boss.hp<=0){defeatBoss();break;}}}updateBossHud();}
  state.bullets=state.bullets.filter(b=>b.y>-20);
  for(const m of state.meteors){m.x+=m.vx*dt;m.y+=m.vy*dt;m.angle+=m.spin*dt;if(m.x<m.r||m.x>state.width-m.r)m.vx*=-1;}
  for(let i=state.meteors.length-1;i>=0;i--){
    const m=state.meteors[i];
    let destroyed=false;
    for(let j=state.bullets.length-1;j>=0;j--){
      const b=state.bullets[j],dx=b.x-m.x,dy=b.y-m.y;
      if(dx*dx+dy*dy<(m.r+b.r)*(m.r+b.r)){
        state.bullets.splice(j,1);m.hp--;
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
  for(const b of state.bullets){ctx.save();ctx.shadowBlur=12;ctx.shadowColor="#66e5ff";ctx.fillStyle="#c8f8ff";ctx.fillRect(b.x-2,b.y-10,4,15);ctx.restore();}
  for(const m of state.meteors)drawMeteor(m);
  if(state.boss)drawBoss(state.boss,now);
  for(const q of state.bossBullets){ctx.save();ctx.shadowBlur=14;ctx.shadowColor="#ff5c91";ctx.fillStyle="#ff9bb8";ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.restore();}
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  drawShip(now);
}

function loop(now){
  if(!state.running)return;
  const dt=Math.min(.033,(now-state.lastFrame)/1000||0);state.lastFrame=now;
  update(dt,now);render(now,dt);
  if(state.running)requestAnimationFrame(loop);
}

canvas.addEventListener("pointerdown",event=>{
  if(!state.running||state.pointer.active)return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const dx=x-state.ship.x,dy=y-state.ship.y;
  if(dx*dx+dy*dy>(state.ship.radius+28)**2)return;
  event.preventDefault();
  state.pointer={active:true,id:event.pointerId,startX:x,startY:y,moved:false,lastX:x,lastY:y};
  canvas.setPointerCapture?.(event.pointerId);
  fire(); // Peluru pertama langsung keluar pada sentuhan pertama.
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
  try { const fullscreenRequest=document.documentElement.requestFullscreen?.(); fullscreenRequest?.catch(()=>{}); } catch {}
  resetGame();
});
document.getElementById("restartButton").addEventListener("click",()=>{initSound();resetGame();});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.running){state.running=false;endGame();}});
drawBackground(0);
drawShip(0);
