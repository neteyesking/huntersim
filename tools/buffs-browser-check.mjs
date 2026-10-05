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
let previous;
try{
 await send('Runtime.enable');await send('Page.bringToFront');await send('Page.navigate',{url:game});
 await until("!!document.querySelector('[data-buff=AspectOfTheHawk]')");
 previous=await evaluate("localStorage.getItem('hunter-action-bar-v1')");
 await evaluate("document.getElementById('editBarBtn').click();document.getElementById('resetBarSlots').click();document.getElementById('barEditorDone').click();document.getElementById('resetBtn').click()");
 await wait(100);
 for(const id of ['AspectOfTheHawk','AspectOfTheBeast']){
  assert.ok(await evaluate(`(()=>{const n=document.querySelector('#customActionBar [data-spell=${id}] .action-name'),b=n.closest('button').getBoundingClientRect();const r=document.createRange();r.selectNodeContents(n);const text=r.getBoundingClientRect();return getComputedStyle(n).whiteSpace==='normal'&&n.scrollHeight<=n.clientHeight&&text.left>=b.left&&text.right<=b.right&&text.bottom<=b.bottom})()`),'Full aspect name fits '+id);
 }
 await evaluate("document.querySelector('#customActionBar [data-spell=AspectOfTheBeast]').click()");
 await until("!!document.querySelector('[data-buff=AspectOfTheBeast]')");
 assert.equal(await evaluate("!!document.querySelector('[data-buff=AspectOfTheHawk]')"),false);
 assert.equal(await evaluate("document.querySelector('#customActionBar [data-spell=AspectOfTheBeast]').getAttribute('aria-pressed')"),'true');
 await wait(1600);await evaluate("document.querySelector('#customActionBar [data-spell=RapidFire]').click()");
 await until("!!document.querySelector('[data-buff=rapidFire]')");
 const first=await evaluate("document.querySelector('[data-buff=rapidFire] .buff-time').textContent");await wait(1200);
 assert.notEqual(await evaluate("document.querySelector('[data-buff=rapidFire] .buff-time').textContent"),first);
 await evaluate("document.getElementById('editBarBtn').click()");
 const paused=await evaluate("document.querySelector('[data-buff=rapidFire] .buff-time').textContent");await wait(1200);
 assert.equal(await evaluate("document.querySelector('[data-buff=rapidFire] .buff-time').textContent"),paused);
 await evaluate("document.getElementById('barEditorDone').click()");
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[2]+'/aspect-buffs-game.png',Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:720,height:900,deviceScaleFactor:1,mobile:false});await wait(100);
 assert.ok(await evaluate("document.querySelector('#customActionBar [data-spell=AspectOfTheBeast] .action-name').scrollHeight<=document.querySelector('#customActionBar [data-spell=AspectOfTheBeast] .action-name').clientHeight"),'Aspect name fits narrow layout');
 await evaluate("document.getElementById('resetBtn').click()");await until("!document.querySelector('[data-buff=rapidFire]')");
 assert.ok(await evaluate("!!document.querySelector('[data-buff=AspectOfTheHawk]')"));
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({status:'passed',fullAspectNames:true,activeAspect:true,buffTimers:true,pause:true,reset:true,runtimeErrors:errors.length}));
}finally{
 if(previous!==undefined)await evaluate(previous===null?"localStorage.removeItem('hunter-action-bar-v1')":"localStorage.setItem('hunter-action-bar-v1',"+JSON.stringify(previous)+")");
 ws.close();await fetch(debug+'/json/close/'+tab.id);
}
