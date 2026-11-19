// LOOTZONE server: zero dependencies. Static files + WebSocket rooms + accounts + leaderboard.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public'),DATA=process.env.DATA_DIR||__dirname,DBF=path.join(DATA,'accounts.json');
let DB={users:{},profiles:{}};try{DB=JSON.parse(fs.readFileSync(DBF))}catch{}
let dirty=0;setInterval(()=>{if(dirty){dirty=0;try{fs.writeFileSync(DBF,JSON.stringify(DB))}catch(e){console.log('save failed',e.message)}}},5000);
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';const p=path.join(PUB,path.normalize(f));if(!p.startsWith(PUB)){s.writeHead(403);return s.end()}
fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);return s.end('Not found')}s.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});s.end(d)})});
function parse(b){if(b.length<2)return null;const op=b[0]&15,m=b[1]&128;let l=b[1]&127,o=2;if(l===126){if(b.length<4)return null;l=b.readUInt16BE(2);o=4}else if(l===127){if(b.length<10)return null;l=Number(b.readBigUInt64BE(2));o=10}
let mk;if(m){if(b.length<o+4)return null;mk=b.subarray(o,o+4);o+=4}if(b.length<o+l)return null;const d=Buffer.from(b.subarray(o,o+l));if(m)for(let i=0;i<l;i++)d[i]^=mk[i&3];return{op,data:d,len:o+l}}
function frame(d,op){d=Buffer.isBuffer(d)?d:Buffer.from(d);const l=d.length,o=128|(op||1);let h;if(l<126)h=Buffer.from([o,l]);else if(l<65536){h=Buffer.alloc(4);h[0]=o;h[1]=126;h.writeUInt16BE(l,2)}else{h=Buffer.alloc(10);h[0]=o;h[1]=127;h.writeBigUInt64BE(BigInt(l),2)}return Buffer.concat([h,d])}
const send=(c,o)=>{if(!c.sock.destroyed)c.sock.write(frame(JSON.stringify(o)))};
const rooms={},dirtyRooms=new Set();
function drop(c){if(c.room&&rooms[c.room]){rooms[c.room].delete(c);dirtyRooms.add(c.room)}c.room=null}
srv.on('upgrade',(req,sock)=>{const key=req.headers['sec-websocket-key'];if(!key)return sock.destroy();
sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
const c={sock,id:crypto.randomBytes(4).toString('hex'),room:null,pres:null,uid:null};let buf=Buffer.alloc(0);
sock.on('data',d=>{buf=Buffer.concat([buf,d]);for(;;){const f=parse(buf);if(!f)break;buf=buf.subarray(f.len);if(f.op===8){sock.end();return}if(f.op===9){sock.write(frame(f.data,10));continue}if(f.op===1){try{onMsg(c,JSON.parse(f.data.toString()))}catch(e){}}}if(buf.length>1e6)sock.destroy()});
sock.on('close',()=>drop(c));sock.on('error',()=>{drop(c);sock.destroy()})});
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
function auth(c,m){const done=o=>send(c,{id:m.id,...o});
if(m.m==='token'){const u=Object.values(DB.users).find(x=>x.tok&&x.tok===m.tok);if(!u)return done({ok:0});c.uid=u.id;return done({ok:1,uid:u.id,u:u.name,tok:u.tok})}
const name=String(m.u||'').trim(),pw=String(m.p||''),key=name.toLowerCase();
if(!/^[A-Za-z0-9_]{3,12}$/.test(name))return done({ok:0,err:'Username: 3-12 letters, numbers or _'});if(pw.length<6)return done({ok:0,err:'Password must be 6+ characters'});
if(m.m==='register'){if(DB.users[key])return done({ok:0,err:'Username taken'});if(!/^\S+@\S+\.\S+$/.test(String(m.e||'')))return done({ok:0,err:'Enter a valid email'});
const salt=crypto.randomBytes(8).toString('hex'),id=crypto.randomBytes(6).toString('hex'),tok=crypto.randomBytes(16).toString('hex');
DB.users[key]={id,name,email:String(m.e).slice(0,80),salt,h:hash(pw,salt),tok};DB.profiles[id]={n:name,xp:0,wins:0,kills:0,own:[],armor:0,kits:0,sec:'pistol'};dirty=1;c.uid=id;return done({ok:1,uid:id,u:name,tok})}
const u=DB.users[key];if(!u||u.h!==hash(pw,u.salt))return done({ok:0,err:'Wrong username or password'});c.uid=u.id;done({ok:1,uid:u.id,u:u.name,tok:u.tok})}
function dbop(c,m){const r=o=>send(c,{id:m.id,...o});
if(m.op==='get')return r({data:DB.profiles[c.uid]||null});
if(m.op==='set'&&m.data){const d=m.data,old=DB.profiles[c.uid]||{};DB.profiles[c.uid]={n:String(d.n||old.n||'Rookie').slice(0,12),xp:Math.max(0,d.xp|0),wins:Math.max(0,d.wins|0),kills:Math.max(0,d.kills|0),own:Array.isArray(d.own)?d.own.slice(0,60).map(x=>String(x).slice(0,12)):[],armor:Math.min(3,d.armor|0),kits:Math.min(5,d.kits|0),sec:String(d.sec||'pistol').slice(0,8)};dirty=1;return r({ok:1})}
if(m.op==='top')return r({list:Object.values(DB.profiles).sort((a,b)=>b.xp-a.xp).slice(0,10)})}
function onMsg(c,m){if(m.t==='auth')return auth(c,m);if(!c.uid)return;
if(m.t==='join'){const n=String(m.room||'');if(!/^lz[a-z0-9]{1,16}$/.test(n)||(rooms[n]&&rooms[n].size>=16))return;drop(c);c.room=n;(rooms[n]=rooms[n]||new Set()).add(c);dirtyRooms.add(n)}
else if(m.t==='pres'&&c.room){c.pres=m.d;dirtyRooms.add(c.room)}
else if(m.t==='ev'&&c.room){const fr=frame(JSON.stringify({t:'ev',room:c.room,topic:String(m.topic).slice(0,12),d:m.d,peer:c.id}));for(const o of rooms[c.room])if(o!==c&&!o.sock.destroyed)o.sock.write(fr)}
else if(m.t==='db')dbop(c,m)}
setInterval(()=>{for(const n of dirtyRooms){const set=rooms[n];if(!set)continue;const list=[...set].map(c=>({peer:c.id,presence:c.pres||{}}));for(const c of set)send(c,{t:'peers',room:n,me:c.id,list})}dirtyRooms.clear()},40);
srv.listen(PORT,()=>console.log('LOOTZONE listening on '+PORT));
