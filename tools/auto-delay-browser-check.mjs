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
const until=async expression=>{for(let i=0;i<100;i++){const value=await evaluate(expression);if(value)return value;await wait(100)}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate("({log:document.getElementById('logRows')?.textContent,auto:document.getElementById('autoText')?.textContent,mark:document.getElementById('targetAuras')?.textContent})")))};
const keys=['hunter-settings-v1','hunter-training-keybinds-v1','hunter-talents-v2','hunter-action-bar-v1'];let previous;
const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
const key=(type,code,modifiers=0)=>send('Input.dispatchKeyEvent',{type,code,key:code==='ShiftLeft'?'Shift':code.replace('Key','').toLowerCase(),modifiers});
const movement=()=>evaluate("import(document.querySelector('script[src*=\"/src/main.js\"]').src).then(m=>m.movementSnapshot())");
const range=()=>evaluate("parseFloat(document.getElementById('positionText').textContent)");
const moduleExpr="import(document.querySelector('script[src*=\"/src/main.js\"]').src)";
const timers=()=>evaluate(moduleExpr+'.then(m=>m.weavingSnapshot())');
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'Math.random=()=>0.9'});
 await send('Page.bringToFront');await send('Page.navigate',{url:game});await until("!!document.getElementById('settingsBtn')");
 previous=await evaluate('Object.fromEntries('+JSON.stringify(keys)+'.map(k=>[k,localStorage.getItem(k)]))');await evaluate(JSON.stringify(keys)+'.forEach(k=>localStorage.removeItem(k))');await send('Page.reload');await wait(500);await until("!!document.getElementById('svPreset')");
 await click('svPreset');await until("!!document.querySelector('[data-damage-source=AutoShot]')");
 await key('keyDown','KeyW');await until("parseFloat(document.getElementById('positionText').textContent)<4.8");await key('keyUp','KeyW');await until("!!document.querySelector('[data-damage-source=\"Melee Swing\"]')");
 await key('keyDown','KeyS');await until("parseFloat(document.getElementById('positionText').textContent)>8");await key('keyUp','KeyS');
 for(let i=0;i<3;i++){await key('keyDown','KeyT');await key('keyUp','KeyT');await wait(100)}
 await key('keyDown','KeyD');await until(moduleExpr+'.then(m=>Math.cos(m.movementSnapshot().player.yaw)>.98)');await key('keyUp','KeyD');
 await key('keyDown','KeyW');await until("parseFloat(document.getElementById('positionText').textContent)>11.5");await key('keyUp','KeyW');await wait(200);
 const away=await movement(),cycle=await timers();assert.ok(Math.cos(Math.atan2(-away.player.x,-away.player.z)-away.player.yaw)<0);
 assert.equal(cycle.timer.phase,'swing');assert.ok(cycle.timer.progress>0);assert.ok(Number.isFinite(cycle.timer.remaining));const shots=cycle.stats.shots;
 await key('keyDown','KeyD');await until(moduleExpr+'.then(m=>{const p=m.movementSnapshot().player;return Math.cos(Math.atan2(-p.x,-p.z)-p.yaw)>.98})');await key('keyUp','KeyD');
 await until(moduleExpr+'.then(m=>m.weavingSnapshot().stats.shots>'+shots+')');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',pendingResetSurvivesToggle:true,timerRunsFacingAway:true,shotResumes:true,runtimeErrors:errors.length}));
}finally{
 for(const code of ['KeyW','KeyS','KeyD'])await key('keyUp',code);
 if(previous)await evaluate('Object.entries('+JSON.stringify(previous)+').forEach(([k,v])=>v===null?localStorage.removeItem(k):localStorage.setItem(k,v))');
 ws.close();await fetch(debug+'/json/close/'+tab.id);
}
