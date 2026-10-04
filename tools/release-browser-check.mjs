import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const debug=process.env.BROWSER_DEBUG_URL;
if(!debug||!process.argv[2]||!process.argv[3])throw Error('Set BROWSER_DEBUG_URL and supply two build directories');
const host=process.env.RELEASE_TEST_HOST||new URL(debug).hostname;
const builds=process.argv.slice(2,4).map(path=>resolve(path));
const manifests=await Promise.all(builds.map(path=>readFile(resolve(path,'release.json'),'utf8').then(JSON.parse)));
assert.notEqual(manifests[0].id,manifests[1].id);assert.notEqual(manifests[0].entry,manifests[1].entry);
const oldHTML=await readFile(resolve(builds[0],'index.html'));
let current=0;const requests=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture');requests.push({url:req.url,current});
 try{
  const path=url.pathname.replace(/^\/huntersim\//,'');
  if(path===''){res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','max-age=3600');res.end(oldHTML);return}
  if(path!=='release.json'&&!/^assets\/[\w.-]+\.(js|css)$/.test(path)){res.writeHead(404);res.end();return}
  const content=await readFile(resolve(builds[current],path));
  res.setHeader('Content-Type',path.endsWith('.json')?'application/json':path.endsWith('.css')?'text/css':'text/javascript');
  res.setHeader('Cache-Control','max-age=3600');res.end(content);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,host,r));
const url='http://'+(host.includes(':')?'['+host+']':host)+':'+server.address().port+'/huntersim/?practice=1#weave';
const tab=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expression=>{for(let i=0;i<100;i++){const value=await evaluate(expression);if(value)return value;await wait(100)}throw Error('Timed out: '+expression)};
try{
 await send('Runtime.enable');await send('Page.bringToFront');await send('Page.navigate',{url});
 await until("document.documentElement.dataset.build==="+JSON.stringify(manifests[0].id)+"&&document.querySelectorAll('#actionBar .action').length===59");
 await evaluate("localStorage.setItem('cache-test-preserved','yes')");
 current=1;
 await evaluate("window.dispatchEvent(new Event('focus'))");
 await until("!!document.getElementById('releaseReload')");
 assert.equal(await evaluate("document.documentElement.dataset.build"),manifests[0].id);
 await evaluate("document.getElementById('releaseReload').click()");
 await until("document.documentElement.dataset.build==="+JSON.stringify(manifests[1].id)+"&&document.querySelectorAll('#actionBar .action').length===59");
 assert.equal(await evaluate("localStorage.getItem('cache-test-preserved')"),'yes');
 assert.equal(await evaluate("new URL(location.href).searchParams.get('practice')"),'1');
 assert.equal(await evaluate("location.hash"),'#weave');
 assert.equal(await evaluate("new URL(location.href).searchParams.get('release')"),manifests[1].id);
 assert.equal(requests.filter(r=>r.current===1&&r.url.includes(manifests[0].entry)).length,0);
 const checks=requests.filter(r=>r.url.includes('release.json'));
 assert.ok(checks.length>=3);assert.equal(new Set(checks.map(r=>r.url)).size,checks.length);
 assert.ok(requests.some(r=>r.current===1&&r.url.includes(manifests[1].entry+'?v='+manifests[1].id)));
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({status:'passed',cachedHTML:manifests[0].id,loadedAssets:manifests[1].id,updateBanner:true,uniqueManifestRequests:checks.length,runtimeErrors:errors.length}));
}finally{ws.close();await fetch(debug+'/json/close/'+tab.id);server.closeAllConnections();await new Promise(r=>server.close(r))}
