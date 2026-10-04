// Self-contained so the build can embed the loader directly in HTML.
export async function startRelease(fallback){
 const base=new URL('./',location.href);
 const valid=value=>value&&typeof value.id==='string'&&value.id.length<200&&typeof value.entry==='string'&&/^assets\/[\w.-]+\.js$/.test(value.entry)&&Array.isArray(value.css)&&value.css.every(path=>typeof path==='string'&&/^assets\/[\w.-]+\.css$/.test(path));
 const latest=async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
  try{
   const url=new URL('release.json',base);url.searchParams.set('_',Date.now()+'-'+Math.random().toString(36).slice(2));
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Release check failed');
   const release=await response.json();if(!valid(release))throw Error('Invalid release manifest');return release;
  }finally{clearTimeout(timeout)}
 };
 const assetURL=(path,id)=>{const url=new URL(path,base);url.searchParams.set('v',id);return url.href};
 const reload=id=>{const url=new URL(location.href);url.searchParams.set('release',id);location.replace(url.href)};
 let current;
 try{current=await latest()}catch{current=fallback}
 if(!valid(current))throw Error('Missing release manifest');
 const styles=current.css.map(path=>new Promise((resolve,reject)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href=assetURL(path,current.id);link.onload=resolve;link.onerror=()=>reject(Error('Stylesheet unavailable'));document.head.appendChild(link);
 }));
 try{
  await Promise.all(styles);
  await import(/* @vite-ignore */ assetURL(current.entry,current.id));
 }catch{
  let refreshed=false;
  try{
   const release=await latest(),key='hunter-release-recovery:'+release.id;
   if(sessionStorage.getItem(key)!=='1'){sessionStorage.setItem(key,'1');refreshed=true;reload(release.id)}
  }catch{}
  if(!refreshed){
   const host=document.getElementById('app');host.replaceChildren();
   const message=document.createElement('p');message.textContent='The game could not load. Check your connection and reload to try the latest release.';
   const button=document.createElement('button');button.textContent='Reload game';button.onclick=()=>reload(Date.now().toString());host.append(message,button);
  }
  return;
 }
 let checking=false;
 const check=async()=>{
  if(checking||document.hidden)return;checking=true;
  try{
   const release=await latest();if(release.id===current.id)return;
   let banner=document.getElementById('releaseUpdate');
   if(!banner){
    banner=document.createElement('div');banner.id='releaseUpdate';banner.setAttribute('role','status');
    const text=document.createElement('span');text.textContent='A new game version is available. Reloading resets the encounter.';
    const button=document.createElement('button');button.id='releaseReload';button.textContent='Update & reload';banner.append(text,button);document.body.appendChild(banner);
   }
   banner.querySelector('button').onclick=()=>reload(release.id);
  }catch{}finally{checking=false}
 };
 setInterval(check,60000);
 window.addEventListener('focus',check);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
}
