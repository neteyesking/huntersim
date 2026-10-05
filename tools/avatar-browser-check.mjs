import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const debug=process.env.BROWSER_DEBUG_URL,game=process.env.GAME_URL;
if(!debug||!game)throw Error('Set BROWSER_DEBUG_URL and GAME_URL before running browser checks');
const tab=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expression=>{for(let i=0;i<100;i++){const value=await evaluate(expression);if(value)return value;await wait(100)}throw Error('Timed out: '+expression)};
const pose=()=>evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.avatarSnapshot())");
const key=(type,code)=>send('Input.dispatchKeyEvent',{type,code,key:code.replace('Key','').toLowerCase()});
const untilPose=async name=>{for(let i=0;i<250;i++){const s=await pose();if(s.pose===name)return s;await wait(20)}throw Error('Missing pose: '+name+' '+JSON.stringify(await pose())+' '+await evaluate("document.getElementById('autoText').textContent"))};
try{
 await send('Runtime.enable');await send('Page.bringToFront');await send('Page.navigate',{url:game});await until("!!document.getElementById('autoTrackToggle')");await wait(400);
 await evaluate("document.getElementById('resetBtn').click()");await wait(100);
 await evaluate("document.getElementById('autoTrackToggle').click()");await untilPose('idle');
 await evaluate("document.getElementById('autoTrackToggle').click()");const draw=await untilPose('bow-draw');
 assert.ok(draw.stringPull>=.1299&&draw.stringPull<=.51);assert.equal(draw.height,2.0277777);
 const release=await untilPose('bow-release');assert.ok(release.projectiles>0);
 await key('keyDown','KeyW');await until("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.movementSnapshot().player.z<4.8)");await key('keyUp','KeyW');
 await evaluate("document.querySelector('[data-spell=RaptorStrike]').click()");
 const swings=await evaluate(`import(document.querySelector('script[src*="/src/main.js"]').src).then(m=>new Promise((resolve,reject)=>{
  const swings={},started=performance.now();
  function sample(){
   const s=m.avatarSnapshot();
   if(s.pose==='sword-swing'&&['RaptorStrike','Melee'].includes(s.ability)){
    if(swings[s.ability]||s.swingPhase==='raise'){const frames=swings[s.ability]??=[];frames.push(s);}
   }
   if(['RaptorStrike','Melee'].every(id=>swings[id]?.some(s=>s.swingPhase==='recover')))return resolve(swings);
   if(performance.now()-started>12000)return reject(Error('Missing full melee swings'));
   requestAnimationFrame(sample);
  }sample();
 }))`);
 for(const [ability,frames] of Object.entries(swings)){
  const x=frames.map(s=>s.swordTip[0]);
  assert.ok(Math.max(...x)-Math.min(...x)>1.7,ability+' blade must sweep across both sides of the body');
  assert.ok(frames.some(s=>s.swingPhase==='cut'),ability+' has a visible cut');
 }
 const strike=swings.RaptorStrike.find(s=>s.swingPhase==='cut');
 await untilPose('melee-ready');
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[2]+'/hunter-avatar-game.png',Buffer.from(shot.data,'base64'));
 await key('keyDown','KeyS');await until("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.movementSnapshot().player.z>11.2)");await key('keyUp','KeyS');
 await untilPose('bow-draw');await untilPose('bow-release');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',draw,release,strike,runtimeErrors:errors.length}));
}finally{await key('keyUp','KeyW');await key('keyUp','KeyS');ws.close();await fetch(debug+'/json/close/'+tab.id)}
