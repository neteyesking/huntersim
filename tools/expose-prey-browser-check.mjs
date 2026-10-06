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
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'Math.random=()=>0.09'});
 await send('Page.bringToFront');await send('Page.navigate',{url:game});await until("!!document.getElementById('settingsBtn')");
 previous=await evaluate('Object.fromEntries('+JSON.stringify(keys)+'.map(k=>[k,localStorage.getItem(k)]))');await evaluate(JSON.stringify(keys)+'.forEach(k=>localStorage.removeItem(k))');await send('Page.reload');await wait(500);await until("!!document.getElementById('svPreset')");
 assert.equal(await evaluate('Math.random()'),.09);
 await click('svPreset');await key('keyDown','Digit6');await key('keyUp','Digit6');
 await until("!!document.querySelector('#customActionBar [data-spell=MongooseBite].proc-active')");
 for(const bar of ['customActionBar','actionBar']){
  const b=await evaluate(`(()=>{const b=document.querySelector('#${bar} [data-spell=MongooseBite]');return {proc:b.classList.contains('proc-active'),ready:b.classList.contains('proc-ready'),disabled:b.getAttribute('aria-disabled'),timer:b.dataset.procTime,animation:getComputedStyle(b,'::before').animationName,title:b.title}})()`);
  assert.equal(b.proc,true);assert.equal(b.ready,false);assert.equal(b.disabled,'true');assert.ok(parseFloat(b.timer)>0);assert.equal(b.animation,'proc-glow');assert.ok(b.title.includes('Expose Prey'));
 }
 assert.ok(await evaluate("document.querySelector('[data-buff=mongooseReady] .buff-name').textContent.includes('Expose Prey')"));
 assert.ok(await evaluate("document.getElementById('logRows').textContent.includes('Expose Prey')"));
 await key('keyDown','KeyT');await key('keyUp','KeyT');
 await key('keyDown','KeyW');await until("parseFloat(document.getElementById('positionText').textContent)<4.5");await key('keyUp','KeyW');
 await until("!!document.querySelector('#customActionBar [data-spell=MongooseBite].proc-ready')");
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[2]+'/expose-prey-glow.png',Buffer.from(shot.data,'base64'));
 await key('keyDown','Digit8');await key('keyUp','Digit8');
 await until("!!document.querySelector('[data-damage-source=MongooseBite]')");
 assert.ok(await evaluate("!!document.querySelector('#customActionBar [data-spell=MongooseBite] .action-cooldown').textContent"));
 // White swings can proc again on the bite frame; leave melee before checking expiry.
 await key('keyDown','KeyS');await until("parseFloat(document.getElementById('positionText').textContent)>11.3");await key('keyUp','KeyS');
 await until("!document.querySelector('#customActionBar [data-spell=MongooseBite].proc-active')");
 assert.equal(await evaluate("!!document.querySelector('[data-buff=mongooseReady]')"),false);
 assert.equal(await evaluate("document.querySelector('#customActionBar [data-spell=MongooseBite]').dataset.procTime"),'');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',markedAttackProc:true,outOfRangeGlow:true,usableGlow:true,bothBars:true,procSource:true,consumption:true,expiry:true,runtimeErrors:errors.length}));
}finally{
 await key('keyUp','KeyW');await key('keyUp','KeyS');
 if(previous)await evaluate('Object.entries('+JSON.stringify(previous)+').forEach(([k,v])=>v===null?localStorage.removeItem(k):localStorage.setItem(k,v))');
 ws.close();await fetch(debug+'/json/close/'+tab.id);
}
