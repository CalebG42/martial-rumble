/* Martial RUMBLE - shared simulation. Runs on the server (online) and in the browser (practice). */
(function(){
'use strict';
const R=280,TAU=Math.PI*2;
const S={
kyo:{n:'Kyokushin',c:'#ef4444',hair:'#1b1b1b',band:'#fff',hp:125,sp:135,g:.6,id:50,
 L:{n:'Low Kick',dmg:8,rng:52,arc:1.3,w:.14,a:.06,r:.2,kb:140,stun:.18,slow:1.4},
 H:{n:'Mawashi',dmg:24,rng:66,arc:1.8,w:.38,a:.08,r:.5,kb:420,stun:.5,gb:.5,lg:160}},
box:{n:'Boxing',c:'#3b82f6',hair:'#3a2a1c',band:'#dc2626',hp:100,sp:172,g:.7,id:42,
 L:{n:'Jab',dmg:6,rng:46,arc:1,w:.06,a:.05,r:.1,kb:90,stun:.12},
 H:{n:'Hook',dmg:15,rng:50,arc:1.5,w:.2,a:.06,r:.34,kb:260,stun:.4,lg:140}},
tai:{n:'Tai Chi',c:'#10b981',hair:'#d9d9d9',band:'#065f46',hp:115,sp:125,g:.8,id:55,
 L:{n:'Palm',dmg:8,rng:54,arc:1.4,w:.14,a:.08,r:.2,kb:230,stun:.2},
 H:{n:'Push Hands',dmg:7,rng:84,arc:6.3,w:.3,a:.08,r:.5,kb:520,stun:.45,lg:1,ring:1}},
mt:{n:'Muay Thai',c:'#f59e0b',hair:'#2a1b12',band:'#fde68a',hp:110,sp:150,g:.6,id:50,
 L:{n:'Kick',dmg:9,rng:58,arc:1.3,w:.12,a:.06,r:.22,kb:190,stun:.2},
 H:{n:'Clinch',dmg:0,rng:52,arc:1.5,w:.18,a:.06,r:.25,clinch:1,lg:60}}};
const ORDER=['kyo','box','tai','mt'],DEF=['ken','bob','susie','tom'];
for(const k of ORDER)S[k].b=k;
const mod=(b,o)=>Object.assign({},S[b],{b},o);
S.ken=mod('kyo',{n:'Ken',t:'Balanced karate'});
S.bob=mod('box',{n:'Bob',t:'Fast boxer'});
S.susie=mod('tai',{n:'Susie',t:'Parry and push'});
S.tom=mod('mt',{n:'Tom',t:'Knees and elbows'});
S.guyou=mod('kyo',{n:'Guyou',t:'Iron body: tough, slow',c:'#a855f7',hair:'#2b1b3a',band:'#e9d5ff',hp:150,sp:120,dm:.95});
S.tanya=mod('box',{n:'Tanya',t:'Speedster: fast, fragile',c:'#ec4899',hair:'#5b1d3b',band:'#fff',hp:88,sp:195,dm:1.05});
const AB={ken:{id:'lunge',n:'Rising Fist',cd:7,r:[50,170],dmg:24,kb:520,stun:.55,t:.25,d:'Lunge forward and land a heavy punch'},
bob:{id:'od',n:'Overdrive',cd:10,r:[0,170],dur:3,d:'3s: faster movement and attacks, 20% more damage'},
susie:{id:'push',n:'Cloud Push',cd:9,r:[0,110],d:'Shove nearby foes back and slow them, heal a little'},
tom:{id:'knee',n:'Flying Knee',cd:8,r:[60,170],dmg:20,kb:480,stun:.7,t:.22,d:'Leap at the nearest foe with a knee'},
guyou:{id:'iron',n:'Iron Stance',cd:12,r:[0,140],dur:2.5,d:'2.5s: take 60% less damage and no knockback'},
tanya:{id:'step',n:'Flash Step',cd:9,r:[60,250],dmg:12,kb:300,stun:.45,d:'Teleport behind the nearest foe and strike'},
rugof:{id:'slam',n:'Ground Slam',cd:11,r:[0,90],dmg:20,kb:560,stun:.8,rad:95,d:'Slam the ground: area damage and stun'}};
S.rugof=mod('mt',{n:'Rugof',t:'Heavy clincher',c:'#14b8a6',hair:'#0f2b2a',band:'#5eead4',hp:128,sp:140,dm:1.15});
// ---- arenas: solid obstacles (circles). Every layout repeats every 90 degrees, so no player gets a better position.
const sym4=l=>{const o=[];for(const[x,y,r,t]of l)for(let k=0;k<4;k++){const c=Math.cos(k*Math.PI/2),s=Math.sin(k*Math.PI/2);o.push({x:Math.round((x*c-y*s)*10)/10,y:Math.round((x*s+y*c)*10)/10,r,t})}return o};
const ARENAS={
 dojo:{n:'Training Dojo',obs:sym4([[105,0,24,'crate']])},
 cyber:{n:'Cyber Alley',obs:[{x:0,y:0,r:30,t:'pillar'}].concat(sym4([[185,0,16,'pillar']]))},
 sky:{n:'Sky Temple',obs:sym4([[135,0,14,'pillar'],[75,75,14,'pillar']])},
 rooftop:{n:'Urban Rooftop',obs:sym4([[70,70,22,'crate'],[0,165,15,'barrel']])},
 club:{n:'Fight Club',obs:sym4([[60,0,18,'barrel'],[155,0,17,'barrel']])}};
Object.assign(AB,{kyo:AB.ken,box:AB.bob,tai:AB.susie,mt:AB.tom});for(const k in AB)S[k].ab=AB[k];
const ad=(a,b)=>{let d=a-b;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return d};
const r1=v=>Math.round(v*10)/10;

function createSim(){
 const sim={F:[],ev:[],ph:'lobby',pt:0,msg:'',rd:0,aiFill:true,dmgM:1,paused:false,hs:0,wins:[0,0,0,0],names:['','','',''],human:[0,0,0,0],chars:DEF.slice(),dummy:[0,0,0,0],away:[0,0,0,0],arena:'dojo',obs:ARENAS.dojo.obs,nextAr:null,dev:false,target:3,maxRd:7,rt:60,ft:0};
 const E=o=>sim.ev.push(o);
 const nm=i=>sim.human[i]||sim.away[i]?sim.names[i]:'CPU';
 function near(f){let b=null,bd=1e9;for(const e of sim.F)if(e!==f&&!e.ko){const d=Math.hypot(e.x-f.x,e.y-f.y);if(d<bd){bd=d;b=e}}return b}
 function mk(i,k){const s=S[k],a=i*TAU/4+TAU/8;
  return{i,k,s,x:Math.cos(a)*170,y:Math.sin(a)*170,vx:0,vy:0,dx:0,dy:0,face:a+Math.PI,hp:s.hp,max:s.hp,stun:0,slow:0,inv:0,dashT:0,dashCd:0,lock:0,atk:null,gT:-1,combo:0,comboT:0,clinch:null,ko:false,off:false,buf:null,bufT:0,limb:1,spCd:3,buff:0,bf:0,sa:null,in:{mx:0,my:0,guard:false},
  ai:{t:.8+Math.random(),sw:0,sd:1,gu:0,sk:.3+Math.random()*.4,ag:.7+Math.random()*.5}}}
 function build(all){sim.F=ORDER.map((_,i)=>{const f=mk(i,sim.chars[i]);if(!all&&!sim.human[i]&&!sim.away[i]&&!sim.aiFill)f.off=f.ko=true;return f})}
 const active=()=>ORDER.filter((k,i)=>sim.human[i]||sim.away[i]||sim.aiFill).length;
 function round(){if(active()<2){sim.lobby();return}sim.rd++;sim.ft=0;build(false);sim.ph='count';sim.pt=3;sim.msg=''}
 function check(){if(sim.ph!=='fight')return;const al=sim.F.filter(f=>!f.off&&!f.ko);
  if(al.length<=1)endRound(al[0],false);
  else if(sim.ft>=sim.rt){const b=al.slice().sort((x,y)=>y.hp/y.max-x.hp/x.max);endRound(b[0].hp/b[0].max>b[1].hp/b[1].max+.001?b[0]:null,true)}}
 // Ends the round; ends the whole match when someone reaches the target or the round cap is hit.
 function endRound(w,timeUp){sim.ph='end';sim.pt=4;
  if(w){sim.wins[w.i]++;sim.msg=nm(w.i)+(timeUp?' wins on time!':' wins the round!')}else sim.msg=timeUp?'Time up: draw':'Draw';
  const top=Math.max(...sim.wins);
  if(top>=sim.target||sim.rd>=sim.maxRd){const ch=top>0&&sim.wins.filter(x=>x===top).length===1?sim.wins.indexOf(top):-1;
   sim.ph='over';sim.pt=0;sim.msg=ch>=0?nm(ch)+' wins the match!':'Match drawn'}}
 function hurt(a,v,dmg,kb,stun,slow,blk){
  {const hv=a.atk&&a.atk.d===a.s.H;E({e:'sx',k:blk?'block':(a.s.b==='kyo'||(a.s.b==='mt'&&!hv)?'kick':'punch'),h:(hv||dmg>16)?1:0})}
  dmg*=sim.dmgM;if(v.buff>0&&v.bf==='iron'){dmg*=.4;kb*=.2;stun=0;slow=0}v.hp-=dmg;v.stun=Math.max(v.stun,stun);if(slow)v.slow=Math.max(v.slow,slow);
  const an=Math.atan2(v.y-a.y,v.x-a.x);v.vx+=Math.cos(an)*kb;v.vy+=Math.sin(an)*kb;
  if(stun>=.3){v.atk=null;v.clinch=null;v.sa=null}
  E({e:'p',x:v.x,y:v.y,c:blk?'#8ecbff':'#ffd27a',n:blk?6:8+(dmg/2|0)});
  E({e:'t',x:v.x,y:v.y-18,s:blk?'Block':Math.round(dmg),c:blk?'#8ecbff':'#fff'});
  E({e:'sh',v:dmg/3});sim.hs=Math.max(sim.hs,dmg>14?.09:.04);
  if(v.hp<=0){v.hp=0;v.ko=true;v.atk=null;v.clinch=null;v.sa=null;v.vx+=Math.cos(an)*300;v.vy+=Math.sin(an)*300;
   E({e:'t',x:v.x,y:v.y-34,s:'KO!',c:'#ff5a4d'});E({e:'sh',v:16});sim.hs=.15;check()}}
 function hit(a,v,d,dist){
  let dmg=d.dmg*(a.s.dm||1)*(a.buff>0&&a.bf==='od'?1.2:1),lab=d.n,kb=d.kb,stun=d.stun;
  if(a.s.b==='mt'&&d===a.s.L&&dist<34){dmg*=1.5;lab='Elbow'}
  if(a.s.b==='box'&&d===a.s.L){a.combo=a.comboT>0?a.combo+1:1;a.comboT=.8;if(a.combo%3===0){dmg*=2;kb*=2;stun=.3;lab='Cross'}}
  const fa=Math.atan2(a.y-v.y,a.x-v.x);
  if(v.gT>=0&&Math.abs(ad(fa,v.face))<1.3){
   if(v.s.b==='tai'&&v.gT<.3){a.stun=.9;a.atk=null;a.clinch=null;a.vx+=Math.cos(fa)*380;a.vy+=Math.sin(fa)*380;v.hp=Math.min(v.max,v.hp+5);
    E({e:'sx',k:'block',h:1});E({e:'t',x:v.x,y:v.y-26,s:'Parry!',c:'#6ee7b7'});E({e:'p',x:v.x,y:v.y,c:'#6ee7b7',n:14});E({e:'sh',v:8});sim.hs=.07;return}
   hurt(a,v,dmg*(1-v.s.g*(d.gb||1)),kb*.3,0,0,true);return}
  hurt(a,v,dmg,kb,stun,d.slow||0);
  if(lab!==d.n||d===a.s.H)E({e:'t',x:v.x,y:v.y-34,s:lab,c:'#ffd27a'})}
 function resolve(f,d){
  E({e:'w',x:f.x,y:f.y,a:f.face,r:d.rng,arc:d.arc,c:f.s.c,k:f.s.b,h:d===f.s.H?1:0});
  if(d.clinch){let b=null,bd=1e9;for(const e of sim.F){if(e===f||e.ko||e.inv>0)continue;const dx=e.x-f.x,dy=e.y-f.y,dd=Math.hypot(dx,dy);
   if(dd<d.rng+13&&Math.abs(ad(Math.atan2(dy,dx),f.face))<d.arc/2&&dd<bd){bd=dd;b=e}}
   if(b){f.clinch={v:b,t:0,n:0};b.atk=null;b.stun=.4;f.atk=null;E({e:'t',x:b.x,y:b.y-26,s:'Clinch',c:'#f59e0b'})}return}
  for(const e of sim.F){if(e===f||e.ko||e.inv>0)continue;const dx=e.x-f.x,dy=e.y-f.y,dd=Math.hypot(dx,dy);
   if(dd<d.rng+13&&Math.abs(ad(Math.atan2(dy,dx),f.face))<d.arc/2)hit(f,e,d,dd)}}
 function clampA(f){const d=Math.hypot(f.x,f.y),m=R-16;if(d>m){f.x*=m/d;f.y*=m/d}}
 // ---- special abilities: all rules (cooldown, range, damage) run here, on the server ----
 function strike(a,v,dmg,kb,stun,slow){const fa=Math.atan2(a.y-v.y,a.x-v.x);
  if(v.gT>=0&&Math.abs(ad(fa,v.face))<1.3)hurt(a,v,dmg*(1-v.s.g*.6),kb*.3,0,0,true);else hurt(a,v,dmg,kb,stun,slow||0)}
 function doSpecial(f){const ab=f.s.ab;if(!ab||f.spCd>0||f.ko)return;const t=near(f),d=t?Math.hypot(t.x-f.x,t.y-f.y):1e9,id=ab.id;
  if(id==='lunge'){f.sa={id,t:0,hit:false};f.dx=Math.cos(f.face);f.dy=Math.sin(f.face)}
  else if(id==='knee'){if(d>ab.r[1])return;f.sa={id,t:0,hit:false}}
  else if(id==='od'||id==='iron'){f.bf=id;f.buff=ab.dur;E({e:'p',x:f.x,y:f.y,c:id==='od'?'#fb923c':'#fcd34d',n:14})}
  else if(id==='push'){for(const e of sim.F)if(e!==f&&!e.ko&&e.inv<=0&&Math.hypot(e.x-f.x,e.y-f.y)<125)strike(f,e,8,640,.5,1.8);f.hp=Math.min(f.max,f.hp+6);E({e:'p',x:f.x,y:f.y,c:'#6ee7b7',n:18})}
  else if(id==='step'){if(!t||d>ab.r[1])return;f.x=t.x-Math.cos(t.face)*38;f.y=t.y-Math.sin(t.face)*38;solve(f);solve(f);f.face=Math.atan2(t.y-f.y,t.x-f.x);f.inv=.25;E({e:'p',x:f.x,y:f.y,c:f.s.c,n:12});strike(f,t,ab.dmg*(f.s.dm||1),ab.kb,ab.stun,0)}
  else if(id==='slam')f.sa={id,t:0};
  E({e:'sx',k:'sp_'+id});f.spCd=ab.cd;f.gT=-1;f.buf=null;E({e:'t',x:f.x,y:f.y-34,s:ab.n,c:f.s.c})}
 function spec(f,dt){const A=f.sa,ab=f.s.ab;A.t+=dt;let m=[0,0];
  if(A.id==='lunge'||A.id==='knee'){let dx=f.dx,dy=f.dy;const t=near(f);
   if(A.id==='knee'&&t){const a=Math.atan2(t.y-f.y,t.x-f.x);dx=Math.cos(a);dy=Math.sin(a);f.face=a}
   const v=A.id==='knee'?720:560;m=[dx*v,dy*v];
   if(!A.hit)for(const e of sim.F){if(e===f||e.ko||e.inv>0)continue;if(Math.hypot(e.x-f.x,e.y-f.y)<36){A.hit=true;strike(f,e,ab.dmg*(f.s.dm||1),ab.kb,ab.stun,0);E({e:'p',x:e.x,y:e.y,c:f.s.c,n:12});break}}
   if(A.hit||A.t>=ab.t){f.sa=null;f.lock=.2}}
  else if(A.id==='slam'&&A.t>=.45){for(const e of sim.F){if(e===f||e.ko||e.inv>0)continue;if(Math.hypot(e.x-f.x,e.y-f.y)<ab.rad)strike(f,e,ab.dmg*(f.s.dm||1),ab.kb,ab.stun,0)}
   E({e:'sx',k:'sp_slam2'});E({e:'p',x:f.x,y:f.y,c:'#fbbf24',n:26,sp:420});sim.hs=Math.max(sim.hs,.1);E({e:'sh',v:10});f.sa=null;f.lock=.35}
  return m}
 function aiSpec(f,dt){const ab=f.s.ab,t=near(f);if(!ab||!t||f.buf||f.spCd>0||f.stun>0||f.atk||f.sa)return;const d=Math.hypot(t.x-f.x,t.y-f.y);if(d>=ab.r[0]&&d<=ab.r[1]&&Math.random()<dt*.7){f.buf='special';f.bufT=.25}}
 // ---- obstacles: fighters slide around them and can never end up inside one ----
 function applyAr(){if(sim.nextAr){sim.arena=sim.nextAr;sim.obs=ARENAS[sim.arena].obs;sim.nextAr=null}}
 function solve(f){for(const o of sim.obs){const dx=f.x-o.x,dy=f.y-o.y,m=o.r+15,d=Math.hypot(dx,dy);
   if(d<m){const nx=d>1e-3?dx/d:1,ny=d>1e-3?dy/d:0;f.x=o.x+nx*m;f.y=o.y+ny*m;const vn=f.vx*nx+f.vy*ny;if(vn<0){f.vx-=vn*nx;f.vy-=vn*ny}}}
  clampA(f)}
 // CPU fighters steer around obstacles so they don't get stuck behind them
 function aiAvoid(f){const i=f.in;let mx=i.mx,my=i.my;if(!mx&&!my)return;
  let near=false;
  for(const o of sim.obs){const dx=f.x-o.x,dy=f.y-o.y,d=Math.hypot(dx,dy),m=o.r+15+34;
   if(d<m&&d>1e-3){const w=(m-d)/34,nx=dx/d,ny=dy/d,dot=mx*nx+my*ny;
    if(dot<0){near=true;const tx=-ny,ty=nx;if(!f.avs)f.avs=(mx*tx+my*ty)>=0?1:-1;   // pick a side once and keep going round it
     mx+=nx*w*.6*(-dot)+tx*f.avs*w*1.6;my+=ny*w*.6*(-dot)+ty*f.avs*w*1.6}}}
  if(!near)f.avs=0;
  const l=Math.hypot(mx,my)||1;i.mx=mx/l;i.my=my/l}
 function upd(f,dt){
  if(f.ko){f.x+=f.vx*dt;f.y+=f.vy*dt;const q=Math.pow(.02,dt);f.vx*=q;f.vy*=q;return}
  for(const k of['stun','slow','inv','dashCd','lock','comboT','spCd','buff'])f[k]=Math.max(0,f[k]-dt);
  f.bufT-=dt;if(f.bufT<=0)f.buf=null;
  const I=f.in,t=near(f);let mvx=0,mvy=0;
  if(f.clinch){const c=f.clinch,v=c.v;
   if(v.ko||f.stun>0)f.clinch=null;
   else{c.t+=dt;v.stun=Math.max(v.stun,.2);v.atk=null;v.x=f.x+Math.cos(f.face)*30;v.y=f.y+Math.sin(f.face)*30;v.vx=v.vy=0;
    if(c.t>=(c.n+1)*.26){if(c.n<3){c.n++;hurt(f,v,7,0,.2,0);E({e:'t',x:v.x,y:v.y-34,s:'Knee',c:'#f59e0b'})}else{hurt(f,v,9,460,.5,0);f.clinch=null;f.lock=.3}}}}
  let want=f.face;if(t)want=Math.atan2(t.y-f.y,t.x-f.x);else if(Math.hypot(I.mx,I.my)>.2)want=Math.atan2(I.my,I.mx);
  if(!f.atk||f.atk.t<f.atk.d.w){const m=14*dt;f.face+=Math.max(-m,Math.min(m,ad(want,f.face)))}
  const free=f.stun<=0&&!f.atk&&!f.clinch&&f.dashT<=0&&f.lock<=0&&!f.sa;
  if(free){
   if(I.guard)f.gT=f.gT<0?0:f.gT+dt;else f.gT=-1;
   const g=f.gT>=0,sp=f.s.sp*(f.slow>0?.55:1)*(g?.5:1)*(f.buff>0&&f.bf==='od'?1.35:1);mvx=I.mx*sp;mvy=I.my*sp;
   if(f.buf&&(!g||f.buf==='dash'||f.buf==='special')){const b=f.buf;f.buf=null;
    if(b==='dash'){if(f.dashCd<=0){E({e:'sx',k:'dash'});f.dashT=.18;f.inv=.22;f.dashCd=.9;f.gT=-1;let dx=I.mx,dy=I.my;if(Math.hypot(dx,dy)<.2){dx=-Math.cos(f.face);dy=-Math.sin(f.face)}
     const l=Math.hypot(dx,dy);f.dx=dx/l;f.dy=dy/l;E({e:'p',x:f.x,y:f.y,c:'#ffffff77',n:5,sp:80})}}
    else if(b==='special')doSpecial(f);
    else{f.atk={d:b==='light'?f.s.L:f.s.H,t:0,hit:false};f.limb*=-1;f.gT=-1}}
  }else if(!f.atk||f.stun>0)f.gT=-1;
  if(f.dashT>0){f.dashT=Math.max(0,f.dashT-dt);mvx=f.dx*480;mvy=f.dy*480}
  if(f.sa){const m=spec(f,dt);mvx=m[0];mvy=m[1]}
  if(f.atk&&f.stun<=0){const A=f.atk,d=A.d;A.t+=dt*(f.buff>0&&f.bf==='od'?1.3:1);
   if(!A.hit&&A.t>=d.w){A.hit=true;const lg=d.lg||90;f.vx+=Math.cos(f.face)*lg;f.vy+=Math.sin(f.face)*lg;resolve(f,d)}
   if(f.atk&&A.t>=d.w+d.a+d.r)f.atk=null}
  f.x+=(mvx+f.vx)*dt;f.y+=(mvy+f.vy)*dt;const q=Math.pow(.004,dt);f.vx*=q;f.vy*=q}
 function ai(f,dt){const a=f.ai,i=f.in;i.mx=i.my=0;i.guard=false;const t=near(f);if(!t)return;
  const dx=t.x-f.x,dy=t.y-f.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;a.t-=dt;a.sw-=dt;a.gu-=dt;
  if(a.sw<=0){a.sd=Math.random()<.5?1:-1;a.sw=.8+Math.random()*1.5}
  const id=f.s.id;
  if(d>id+10){i.mx=ux;i.my=uy}else if(d<id-16){i.mx=-ux*.7;i.my=-uy*.7}else{i.mx=-uy*a.sd*.6;i.my=ux*a.sd*.6}
  for(const e of sim.F){if(e===f||e.ko||!e.atk||e.atk.hit)continue;if(Math.hypot(e.x-f.x,e.y-f.y)>e.atk.d.rng+34)continue;
   const key='r'+f.i;if(e.atk[key]===undefined)e.atk[key]=Math.random()<a.sk;
   if(e.atk[key]&&(f.s.b!=='tai'||e.atk.d.w-e.atk.t<.2))a.gu=.38}
  if(a.gu>0)i.guard=true;
  if(!i.guard&&a.t<=0&&d<f.s.L.rng+4){a.t=(.35+Math.random()*.7)/a.ag;let hv=Math.random()<.3;
   if(f.s.b==='tai')hv=sim.F.filter(e=>e!==f&&!e.ko&&Math.hypot(e.x-f.x,e.y-f.y)<85).length>=2||Math.random()<.12;
   f.buf=hv?'heavy':'light';f.bufT=.3}
  if(f.hp<f.max*.35&&d<70&&Math.random()<dt*.7){i.mx=-ux;i.my=-uy;f.buf='dash';f.bufT=.2}}

 sim.setChar=(i,k)=>{sim.chars[i]=(S[k]&&S[k].b)?k:DEF[i];if(sim.ph==='lobby')build(true)};
 sim.heal=()=>{for(const f of sim.F)if(!f.off&&!f.ko)f.hp=f.max};
 sim.lobby=()=>{sim.ph='lobby';sim.msg='';applyAr();build(true)};
 sim.setArena=id=>{if(!ARENAS[id])return;if(sim.ph==='lobby'){sim.arena=id;sim.obs=ARENAS[id].obs}else sim.nextAr=id};
 sim.start=()=>{if(active()<2)return false;applyAr();sim.wins=[0,0,0,0];sim.rd=0;round();return true};
 sim.input=(i,mx,my,g)=>{const f=sim.F[i];if(!f||!sim.human[i]||f.ko)return;const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l}f.in.mx=mx;f.in.my=my;f.in.guard=!!g};
 sim.press=(i,k)=>{const f=sim.F[i];if(!f||!sim.human[i]||sim.ph!=='fight'||f.ko)return;if(k==='special'&&!f.s.ab)return;f.buf=k;f.bufT=.25};
 sim.step=dt=>{
  if(sim.paused)return;
  if(sim.hs>0){sim.hs-=dt;return}
  const fight=sim.ph==='fight';
  for(const f of sim.F){if(f.ko)continue;
   if(!fight){f.in.mx=f.in.my=0;f.in.guard=false;f.buf=null}
   else if(!sim.human[f.i]){if(sim.dummy[f.i]){f.in.mx=f.in.my=0;f.in.guard=false}else{ai(f,dt);aiAvoid(f);aiSpec(f,dt)}}}
  for(const f of sim.F)upd(f,dt);
  const F=sim.F;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=F[i],b=F[j];if(a.ko||b.ko||(a.clinch&&a.clinch.v===b)||(b.clinch&&b.clinch.v===a))continue;
   let dx=b.x-a.x,dy=b.y-a.y;const d=Math.hypot(dx,dy)||1;if(d<30){const p=(30-d)/2;dx/=d;dy/=d;a.x-=dx*p;a.y-=dy*p;b.x+=dx*p;b.y+=dy*p}}
  for(const f of F){solve(f);solve(f)}
  if(sim.ph==='count'){sim.pt-=dt;if(sim.pt<=0){sim.ph='fight';sim.ft=0}}
  else if(sim.ph==='fight'){sim.ft+=dt;check()}
  else if(sim.ph==='end'){sim.pt-=dt;if(sim.pt<=0)round()}};
 sim.snapshot=()=>{const s={p:sim.ph,pt:r1(Math.max(0,sim.pt)),m:sim.msg,rd:sim.rd,pa:sim.paused?1:0,ai:sim.aiFill?1:0,dm:sim.dmgM,dv:sim.dev?1:0,tl:r1(Math.max(0,sim.rt-sim.ft)),tg:sim.target,ar:sim.arena,dz:sim.dummy,w:sim.wins,
  f:sim.F.map(f=>({k:f.k,n:nm(f.i),h:sim.human[f.i]?1:0,x:r1(f.x),y:r1(f.y),a:Math.round(f.face*100)/100,hp:Math.round(f.hp),mx:f.max,
   ko:f.ko?1:0,off:f.off?1:0,st:f.stun>0?1:0,sl:f.slow>0?1:0,iv:f.inv>0?1:0,sc:r1(f.spCd),aw:sim.away[f.i]?1:0,bf:f.buff>0?f.bf:0,sa:f.sa?f.sa.id:0,g:f.gT>=0?Math.round(f.gT*100)/100:-1,
   at:f.atk?{d:f.atk.d===f.s.H?'H':'L',t:Math.round(f.atk.t*1000)/1000,l:f.limb}:0})),e:sim.ev};
  sim.ev=[];return s};
 sim.lobby();
 return sim}

const API={S,ORDER,R,createSim,ARENAS};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else window.Rumble=API;
})();
