// Gives the game the same room/user/db API on a normal website (WebSocket to server.js).
(()=>{if(window.claude)return;
const ws0=()=>new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);let ws,cbs={},rid=0,rooms={},pend={};
const send=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const ask=o=>new Promise(res=>{const id=++rid;cbs[id]=res;send({...o,id});setTimeout(()=>{if(cbs[id]){delete cbs[id];res(null)}},8000)});
function h(m){if(m.id&&cbs[m.id]){cbs[m.id](m);delete cbs[m.id];return}const r=rooms[m.room];if(!r)return;
if(m.t==='peers'){r.me=m.me;r.peers=m.list.map(p=>({peer:p.peer,presence:p.presence,isMe:p.peer===m.me,sameTab:p.peer===m.me}));r.pcb&&r.pcb({peers:r.peers})}
else if(m.t==='ev'&&r.h[m.topic])r.h[m.topic].forEach(f=>f({data:m.d,peer:m.peer,isMe:m.peer===r.me}))}
const ready=new Promise(res=>{ws=ws0();ws.onopen=res;ws.onmessage=e=>{try{h(JSON.parse(e.data))}catch{}};ws.onclose=()=>{const b=document.createElement('div');b.style.cssText='position:fixed;top:0;left:0;right:0;background:#a22;color:#fff;text-align:center;padding:6px;z-index:999;font:14px Arial';b.textContent='Disconnected from server. Refresh the page to reconnect.';document.body.appendChild(b)}});
setInterval(()=>{for(const n in pend){send({t:'pres',room:n,d:pend[n]});delete pend[n]}},33);
function login(){return new Promise(res=>{const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:99;background:#080b10;color:#e8edf2;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial;gap:8px';
o.innerHTML='<h1 style="color:#ffb627;letter-spacing:8px;margin:0;font-size:54px">LOOTZONE</h1><p style="color:#9fb0bf;max-width:420px;text-align:center">Log in or create an account to save your XP and appear on the leaderboard.</p><input id=lu placeholder=Username maxlength=12><input id=le placeholder="Email (register only)" type=email><input id=lp placeholder=Password type=password><div><button id=l1>LOG IN</button><button id=l2>REGISTER</button></div><div id=lm style="color:#ff7b7b"></div>';
document.body.appendChild(o);const q=s=>o.querySelector(s);const go=async m=>{const r=await ask({t:'auth',m,u:q('#lu').value.trim(),p:q('#lp').value,e:q('#le').value.trim()});if(r&&r.ok){localStorage.lz_tok=r.tok;o.remove();res({uid:r.uid,u:r.u})}else q('#lm').textContent=(r&&r.err)||'Connection problem'};q('#l1').onclick=()=>go('login');q('#l2').onclick=()=>go('register')})}
let acct=null;const getAcct=()=>acct||(acct=(async()=>{await ready;const t=localStorage.lz_tok;if(t){const r=await ask({t:'auth',m:'token',tok:t});if(r&&r.ok)return{uid:r.uid,u:r.u}}return login()})());
const roomApi={async join(name){await ready;await getAcct();const r={h:{},peers:[],me:null,pcb:null,emit:(topic,d)=>send({t:'ev',room:name,topic,d}),on:(t,f)=>{(r.h[t]=r.h[t]||[]).push(f)},onPeers:f=>{r.pcb=f},presence:d=>{pend[name]=d}};rooms[name]=r;send({t:'join',room:name});return r}};
const userApi={id:async()=>(await getAcct()).uid,name:async()=>(await getAcct()).u};
const dbApi={doc:()=>({get:async()=>{const r=await ask({t:'db',op:'get'});return{exists:!!(r&&r.data),data:()=>r&&r.data}},set:async d=>{await ask({t:'db',op:'set',data:d})}}),collection:()=>({orderBy:()=>({limit:()=>({get:async()=>{const r=await ask({t:'db',op:'top'});return{docs:((r&&r.list)||[]).map(v=>({data:()=>v}))}}})})})};
window.claude={use:async n=>{await ready;if(n==='user'){await getAcct();return userApi}if(n==='db'){await getAcct();return dbApi}if(n==='room')return roomApi;return null}}})();
