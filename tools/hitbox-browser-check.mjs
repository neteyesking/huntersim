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
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const snapshot=()=>evaluate("import('/src/main.js').then(m=>m.rangeSnapshot())");
const setRadius=async value=>{await evaluate(`(()=>{const input=document.getElementById('targetHitboxOption');input.value=${value};input.dispatchEvent(new Event('change'))})()`);await until("import('/src/main.js').then(m=>Math.abs(m.rangeSnapshot().hitboxRadius-"+value+")<1e-8)")};
try{
 await send('Runtime.enable');await send('Page.bringToFront');await send('Page.navigate',{url:game});
 await until("!!document.getElementById('targetHitboxOption')");
 await evaluate("if(document.getElementById('autoTimerToggle').getAttribute('aria-pressed')==='true')document.getElementById('autoTimerToggle').click()");
 const results=[];
 for(const radius of [2.8,5,1,20]){
  await setRadius(radius);const s=await snapshot();
  for(const actual of [s.hitboxRadius,s.hitboxOverlayRadius,s.clickRadius])close(actual,radius);
  close(s.meleeMax,5+radius-2.8);close(s.rangedMin,8+radius);
  close(s.markers.melee,s.meleeMax);close(s.markers.rangedMin,s.rangedMin);close(s.markers.rangedMax,s.rangedMax);
  close(s.markers.deadZone.inner,s.meleeMax);close(s.markers.deadZone.outer,s.rangedMin);
  results.push(s);
 }
 await setRadius(5);await wait(500);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[2]+'/hunter-hitbox-zones.png',Buffer.from(shot.data,'base64'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});
 await until("import('/src/main.js').then(m=>m.movementSnapshot().player.z<6.8)");
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});await wait(100);
 const z=await evaluate("import('/src/main.js').then(m=>m.movementSnapshot().player.z)");assert.ok(z>5&&z<7.2);
 assert.notEqual(await evaluate("document.querySelector('[data-spell=RaptorStrike]').dataset.unavailableReason"),'range');
 assert.equal(await evaluate("document.querySelector('[data-spell=ArcaneShot]').dataset.unavailableReason"),'range');
 await setRadius(2.8);
 assert.equal(await evaluate("document.querySelector('[data-spell=RaptorStrike]').dataset.unavailableReason"),'range');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',sizes:results,meleePosition:z,runtimeErrors:errors.length}));
}finally{
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 ws.close();await fetch(debug+'/json/close/'+tab.id);
}
