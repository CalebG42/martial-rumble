// Martial RUMBLE server: serves the game files and runs one authoritative match per room.
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws'),{createSim}=require(fs.existsSync(path.join(__dirname,'public'))?'./public/sim.js':'./sim.js');
const crypto=require('crypto');
const PORT=process.env.PORT||3000,PW=process.env.ADMIN_PASSWORD||'',PUB=fs.existsSync(path.join(__dirname,'public'))?path.join(__dirname,'public'):__dirname;
// Developer mode: only exists when DEV_KEY is set in the environment (Render > Environment). Unset = fully disabled.
const DEV_KEY=process.env.DEV_KEY||'',DEVT=new Map(),TRY=new Map();
const sha=x=>crypto.createHash('sha256').update(String(x)).digest();
const devOk=t=>{if(!DEV_KEY||!t)return false;const e=DEVT.get(String(t));if(!e)return false;if(e<Date.now()){DEVT.delete(String(t));return false}return true};
// Ownership hook: unlocks are stored on each phone today, so the server cannot verify them yet.
// When accounts exist, check ownership here (dev sockets skip the check).
const canUse=(ws,ch)=>true;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/json','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4'};

const server=http.createServer((req,res)=>{
 let p=decodeURIComponent(req.url.split('?')[0]);
 if(p==='/health'){res.writeHead(200);return res.end('ok')}
 if(p==='/dev/verify'){
  const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
  if(req.method==='OPTIONS'){res.writeHead(204,H);return res.end()}
  if(!DEV_KEY||req.method!=='POST'){res.writeHead(404,H);return res.end()}
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'?'),now=Date.now();
  if(TRY.size>500)TRY.clear();
  let a=TRY.get(ip);if(!a||a.t<now){a={n:0,t:now+6e4};TRY.set(ip,a)}
  if(++a.n>5){res.writeHead(429,H);return res.end()}
  let b='';req.on('data',c=>{b+=c;if(b.length>200)req.destroy()});
  req.on('end',()=>{if(crypto.timingSafeEqual(sha(b.trim()),sha(DEV_KEY))){const t=crypto.randomBytes(24).toString('hex');DEVT.set(t,now+72e5);res.writeHead(200,H);res.end(JSON.stringify({t}))}else{res.writeHead(401,H);res.end()}});
  return}
 if(p==='/')p='/index.html';
 if(PUB===__dirname&&!/^\/(index\.html|sim\.js|config\.js|manifest\.json|icon-\d+\.png|music\.js|[\w-]+\.(mp3|ogg|m4a))$/.test(p)){res.writeHead(404);return res.end('Not found')}
 const f=path.join(PUB,path.normalize(p));
 if(!f.startsWith(PUB)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{
  if(e){res.writeHead(404);return res.end('Not found')}
  const ct=MIME[path.extname(f)]||'application/octet-stream',m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
  if(m){const a=m[1]?+m[1]:0,b=m[2]?Math.min(+m[2],d.length-1):d.length-1;res.writeHead(206,{'Content-Type':ct,'Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${d.length}`,'Content-Length':b-a+1});return res.end(d.subarray(a,b+1))}
  res.writeHead(200,{'Content-Type':ct,'Accept-Ranges':'bytes'});res.end(d)})});

const wss=new WebSocketServer({server,maxPayload:2048});
const rooms=new Map(),LET='ABCDEFGHJKLMNPQRSTUVWXYZ',DMG=[.5,1,1.5,2];
const newCode=()=>{let c;do c=Array.from({length:4},()=>LET[Math.random()*LET.length|0]).join('');while(rooms.has(c));return c};
const clean=s=>String(s||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};
const fail=(ws,m)=>{send(ws,{t:'err',m,x:1});ws.close()};

function seat(ws,r,name,want,ch){
 const sim=r.sim,free=[0,1,2,3].filter(i=>!sim.human[i]);let s=-1;
 if(want>=0&&want<4&&free.length)s=free.includes(want)?want:free[0];
 ws.slot=s;
 if(s>=0){sim.human[s]=1;sim.names[s]=name||'P'+(s+1);sim.setChar(s,canUse(ws,ch)||ws.dev?ch:null)}}
function join(ws,r,name,want,ch){
 ws.room=r;r.clients.add(ws);seat(ws,r,name,want,ch);
 send(ws,{t:'joined',code:r.code,slot:ws.slot,master:r.master===ws,dev:!!ws.dev})}
function leave(ws){
 const r=ws.room;if(!r)return;
 r.clients.delete(ws);ws.room=null;
 if(ws.slot>=0){r.sim.human[ws.slot]=0;r.sim.names[ws.slot]='';r.sim.setChar(ws.slot,null)}
 if(!r.clients.size){rooms.delete(r.code);return}
 if(r.master===ws){r.master=r.clients.values().next().value;send(r.master,{t:'master'})}}

function command(ws,r,m){
 if(r.master!==ws)return;
 const s=r.sim;
 switch(m.c){
  case 'start':if(!s.start())send(ws,{t:'err',m:'Need at least 2 fighters'});break;
  case 'pause':s.paused=!s.paused;break;
  case 'stop':s.paused=false;s.lobby();break;
  case 'ai':s.aiFill=!s.aiFill;break;
  case 'dmg':s.dmgM=DMG[(DMG.indexOf(s.dmgM)+1)%DMG.length];break;
  case 'dchar':if(ws.dev){const i=m.slot|0;if(i>=0&&i<4&&!s.human[i])s.setChar(i,String(m.ch||''))}break;
  case 'dheal':if(ws.dev)s.heal();break;
  case 'ddummy':if(ws.dev){const i=m.slot|0;if(i>=0&&i<4)s.dummy[i]=s.dummy[i]?0:1}break;
  case 'kick':for(const c of r.clients)if(c!==ws&&c.slot===m.slot)fail(c,'Removed by the host');break}}

wss.on('connection',ws=>{
 ws.slot=-1;ws.room=null;
 ws.on('error',()=>{});
 ws.on('close',()=>leave(ws));
 ws.on('message',raw=>{
  let m;try{m=JSON.parse(raw)}catch{return}
  if(!m||typeof m!=='object')return;
  const r=ws.room,want=Number.isInteger(m.slot)?m.slot:-1;
  if(!r){
   ws.dev=devOk(m.dt);
   if(m.t==='create'){
    if(PW&&m.pw!==PW)return fail(ws,'Wrong host password');
    if(rooms.size>=50)return fail(ws,'Server busy, try again soon');
    const room={code:newCode(),sim:createSim(),clients:new Set(),master:ws};
    if(ws.dev)room.sim.dev=true;
    rooms.set(room.code,room);join(ws,room,clean(m.name),want,String(m.ch||''))}
   else if(m.t==='join'){
    const room=rooms.get(String(m.code||'').toUpperCase().trim());
    if(!room)return fail(ws,'No room with that code');
    join(ws,room,clean(m.name),want,String(m.ch||''))}
   return}
  if(m.t==='in'&&ws.slot>=0)r.sim.input(ws.slot,+m.x||0,+m.y||0,!!m.g);
  else if(m.t==='b'&&ws.slot>=0&&['light','heavy','dash'].includes(m.k))r.sim.press(ws.slot,m.k);
  else if(m.t==='dself'&&ws.dev&&ws.slot>=0)r.sim.setChar(ws.slot,String(m.ch||''));
  else if(m.t==='cmd')command(ws,r,m)})});

// 30 updates per second for every room
setInterval(()=>{
 for(const r of rooms.values()){
  r.sim.step(1/30);
  const msg=JSON.stringify(Object.assign({t:'s',c:r.code},r.sim.snapshot()));
  for(const c of r.clients)if(c.readyState===1)c.send(msg)}},1000/30);

server.listen(PORT,()=>console.log('Martial RUMBLE server on port '+PORT+(PW?' (host password on)':' (no host password)')));
