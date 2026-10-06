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
const keys=['hunter-settings-v1','hunter-setups-v1','hunter-talents-v2','hunter-training-keybinds-v1','hunter-action-bar-v1'];
let previous;
const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
const change=(id,value)=>evaluate(`(()=>{const n=document.getElementById(${JSON.stringify(id)});n[n.type==='checkbox'?'checked':'value']=${JSON.stringify(value)};n.dispatchEvent(new Event('change'))})()`);
const equipment=()=>evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.equipmentSnapshot())");
const field=(key,value)=>evaluate(`(()=>{const n=document.querySelector('[data-field="${key}"]');n[n.type==='checkbox'?'checked':'value']=${JSON.stringify(value)};n.dispatchEvent(new Event('change'))})()`);
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'Math.random=()=>0.9'});await send('Page.bringToFront');await send('Page.navigate',{url:game});await until("!!document.getElementById('equipmentBtn')");
 previous=await evaluate('Object.fromEntries('+JSON.stringify(keys)+'.map(k=>[k,localStorage.getItem(k)]))');await evaluate(JSON.stringify(keys)+'.forEach(k=>localStorage.removeItem(k))');await send('Page.reload');await wait(500);await until("!!document.getElementById('equipmentBtn')");
 await click('equipmentBtn');await field('mode','dualWield');await field('ranged.speed',3);await field('mainHand.speed',3.4);await field('offHand.speed',1.2);await field('mainHand.min',125);await field('mainHand.max',170);await field('stats.meleeAP',900);await field('stats.hit',30);await field('stats.health',5100);
 await click('equipmentApply');assert.equal((await equipment()).loadout.offHand.speed,1.2);assert.equal((await equipment()).loadout.stats.meleeAP,900);assert.equal(await evaluate("document.getElementById('offhandRow').hidden"),false);
 const paused=await equipment();await wait(200);assert.deepEqual(await equipment(),paused);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[2]+'/stats-weapons-modal.png',Buffer.from(shot.data,'base64'));
 await click('equipmentClose');await send('Page.reload');await wait(500);await until("!!document.getElementById('equipmentBtn')");assert.equal((await equipment()).loadout.mainHand.speed,3.4);assert.equal((await equipment()).loadout.ranged.speed,3);
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await until("parseFloat(document.getElementById('positionText').textContent)<4.8");await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 assert.equal((await equipment()).meleeAttack,false);await evaluate("document.querySelector('#actionBar [data-spell=RaptorStrike]').click()");await until("!!document.querySelector('[data-damage-source=RaptorStrike]')&&!!document.querySelector('[data-damage-source=Offhand]')");
 const timers=await equipment();assert.ok(timers.mainHand.next-timers.mainHand.previous>3);assert.ok(timers.offHand.next-timers.offHand.previous<1.5);
 const avatar=await evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.avatarSnapshot())");assert.equal(avatar.dualWield,true);await until("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.avatarSnapshot().offhandSwing)");const tipA=await evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.avatarSnapshot().offhandTip)");await wait(180);const tipB=await evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.avatarSnapshot().offhandTip)");assert.ok(Math.hypot(...tipA.map((v,i)=>v-tipB[i]))>.1);
 await click('equipmentBtn');await field('mode','twoHand');await field('twoHand.speed',3.8);await click('equipmentApply');assert.equal(await evaluate("document.getElementById('offhandRow').hidden"),true);assert.equal((await equipment()).loadout.twoHand.speed,3.8);assert.equal((await equipment()).loadout.mainHand.speed,3.4);
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',modal:true,persistence:true,separateTimers:true,raptorMainHand:true,dualWieldVisual:true,modeSwitch:true,runtimeErrors:errors.length}));
}finally{
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 if(previous)await evaluate('Object.entries('+JSON.stringify(previous)+').forEach(([k,v])=>v===null?localStorage.removeItem(k):localStorage.setItem(k,v))');
 ws.close();await fetch(debug+'/json/close/'+tab.id);
}
