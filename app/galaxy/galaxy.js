const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const scoreEl = document.getElementById("scoreValue");
const livesEl = document.getElementById("livesValue");
const finalScoreEl = document.getElementById("finalScore");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const criticalNotice = document.getElementById("criticalNotice");

const state = {
  width: 0, height: 0, dpr: 1, running: false, gameOver: false,
  score: 0, hits: 0, lastHitAt: 0, lastFrame: 0, spawnAt: 0,
  ship: { x: 0, y: 0, radius: 19 },
  bullets: [], meteors: [], particles: [], stars: [],
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
  state.ship.x = Math.max(24,Math.min(state.width-24,state.ship.x));
  state.ship.y = Math.max(100,Math.min(state.height-55,state.ship.y));
  state.stars = Array.from({length:Math.max(45,Math.round(state.width*state.height/9000))},()=>({
    x:Math.random()*state.width,y:Math.random()*state.height,
    r:Math.random()*1.4+.3,a:Math.random()*.55+.2,s:Math.random()*17+8
  }));
}
window.addEventListener("resize",resize,{passive:true});
resize();

function resetGame(){
  state.running=true;state.gameOver=false;state.score=0;state.hits=0;
  state.lastHitAt=0;state.spawnAt=0;state.bullets=[];state.meteors=[];state.particles=[];
  state.ship.x=state.width/2;state.ship.y=state.height*.82;
  scoreEl.textContent="000000";livesEl.textContent="♥ ♥ ♥";
  livesEl.setAttribute("aria-label","3 lives");
  criticalNotice.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  startOverlay.classList.add("hidden");
  state.lastFrame=performance.now();
  requestAnimationFrame(loop);
}

function fire(){
  if(!state.running)return;
  state.bullets.push({x:state.ship.x,y:state.ship.y-22,vy:-Math.max(520,state.height*.95),r:3.2});
}

function spawnMeteor(){
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
  const {x,y,radius:r}=state.ship;
  const flashing=now-state.lastHitAt<800;
  if(flashing&&Math.floor(now/90)%2===0)return;
  ctx.save();ctx.translate(x,y);
  ctx.shadowBlur=18;ctx.shadowColor="#55dfff";
  ctx.fillStyle="#8beaff";ctx.beginPath();ctx.moveTo(0,-r-8);ctx.lineTo(r*.72,r);ctx.lineTo(0,r*.55);ctx.lineTo(-r*.72,r);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#e9fbff";ctx.beginPath();ctx.moveTo(0,-r+1);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
  ctx.fillStyle="#ffb45d";ctx.beginPath();ctx.moveTo(-5,r-1);ctx.lineTo(0,r+12+Math.random()*5);ctx.lineTo(5,r-1);ctx.closePath();ctx.fill();
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
  if(now>=state.spawnAt){spawnMeteor();state.spawnAt=now+Math.max(420,1250-state.score*.12);}
  for(const b of state.bullets)b.y+=b.vy*dt;
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
          state.score+=m.type==="small"?10:m.type==="medium"?25:50;
          scoreEl.textContent=String(state.score).padStart(6,"0");
          burst(m.x,m.y,m.type==="large"?"#ffb45d":"#b9dfff",m.type==="large"?30:14);
          state.meteors.splice(i,1);destroyed=true;break;
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
  state.pointer={active:true,id:event.pointerId,startX:x,startY:y,moved:false,lastX:x,lastY:y};
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener("pointermove",event=>{
  const p=state.pointer;if(!p.active||p.id!==event.pointerId)return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(Math.hypot(x-p.startX,y-p.startY)>8)p.moved=true;
  if(p.moved){state.ship.x=Math.max(22,Math.min(state.width-22,x));state.ship.y=Math.max(105,Math.min(state.height-45,y));}
  p.lastX=x;p.lastY=y;
});
function finishPointer(event){
  const p=state.pointer;if(!p.active||p.id!==event.pointerId)return;
  if(!p.moved)fire();
  state.pointer.active=false;state.pointer.id=null;
}
canvas.addEventListener("pointerup",finishPointer);
canvas.addEventListener("pointercancel",event=>{if(state.pointer.id===event.pointerId){state.pointer.active=false;state.pointer.id=null;}});
document.getElementById("startButton").addEventListener("click",()=>{
  document.documentElement.requestFullscreen?.().catch(()=>{});
  resetGame();
});
document.getElementById("restartButton").addEventListener("click",resetGame);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.running){state.running=false;endGame();}});
drawBackground(0);
drawShip(0);
