import {ACTIONS,SPELLS,describe,TALENT_GATES} from './catalog.js';
import {bindingLabel} from './bindings.js';

export const BAR_STORAGE_KEY='hunter-action-bar-v1';
export const DEFAULT_SLOTS=['AutoShot','HuntersMark','SerpentSting','MultiShot','ArcaneShot','RaptorStrike','MongooseBite','StriderKick','RapidFire','FeignDeath','AspectOfTheHawk','AspectOfTheBeast'];
const allowed=new Set(['AutoShot',...ACTIONS.map(a=>a.id)]);
export function normalizeSlots(value){
 if(!Array.isArray(value))return [...DEFAULT_SLOTS];
 return Array.from({length:12},(_,i)=>allowed.has(value[i])?value[i]:null);
}
export function loadSlots(storage){try{const raw=storage.getItem(BAR_STORAGE_KEY);return raw?normalizeSlots(JSON.parse(raw)):[...DEFAULT_SLOTS]}catch{return [...DEFAULT_SLOTS]}}
export function swapSlots(slots,from,to){const next=[...slots];if(Number.isInteger(from)&&Number.isInteger(to)&&from>=0&&from<12&&to>=0&&to<12)[next[from],next[to]]=[next[to],next[from]];return next}

export function createCustomBar({app,storage,createButton,setModal,getBindings,getTalents,toggleAuto}){
 let slots=loadSlots(storage),selected=0,dragged=null;
 const host=document.createElement('div');host.id='customActionBar';host.setAttribute('aria-label','Custom ability bar');document.getElementById('actionBar').before(host);
 const panel=document.createElement('div');panel.id='barEditor';panel.className='modal hidden';
 panel.innerHTML=`<div class="bar-editor-card"><div class="drawer-head"><div><div class="eyebrow">YOUR ABILITIES · YOUR ORDER</div><h2>Edit center bar</h2></div><button class="close" id="barEditorClose" aria-label="Close bar editor">×</button></div><p>Choose a slot, then choose an ability. Drag slots to swap them. Abilities keep their existing keybinds.</p><div id="barSlotGrid" aria-label="Ability slots"></div><div class="bar-editor-tools"><strong id="barSlotLabel"></strong><button id="barSlotLeft" class="inline" aria-label="Move selected slot left">←</button><button id="barSlotRight" class="inline" aria-label="Move selected slot right">→</button><button id="clearBarSlot" class="inline">Clear slot</button></div><div class="bar-search-row"><input id="barSearch" type="search" placeholder="Find an ability…" aria-label="Find an ability"><select id="barCategory" aria-label="Filter abilities by category"><option value="">All abilities</option></select></div><div id="barAbilityList"></div><div class="bar-editor-footer"><button id="resetBarSlots" class="inline">Restore default bar</button><span id="barSaveStatus" role="status">Saved in this browser</span><button id="barEditorDone" class="inline">Done</button></div></div>`;
 app.appendChild(panel);
 const $=id=>document.getElementById(id),byId=new Map();
 const choices=[{id:'AutoShot',category:'Attacks & control',tint:'#e2c38c'},...ACTIONS];
 for(const category of [...new Set(choices.map(a=>a.category))]){const o=document.createElement('option');o.value=o.textContent=category;$('barCategory').append(o)}
 function save(){try{storage.setItem(BAR_STORAGE_KEY,JSON.stringify(slots));$('barSaveStatus').textContent='Saved in this browser'}catch{$('barSaveStatus').textContent='Storage unavailable · changes last for this session'}}
 function renderBar(){
  host.replaceChildren();byId.clear();
  slots.forEach((id,index)=>{
   const action=choices.find(a=>a.id===id);
   const b=action?createButton(action):document.createElement('button');
   if(!action){b.className='action empty-slot';b.innerHTML='<span>＋</span>';b.title='Choose an ability for slot '+(index+1);b.setAttribute('aria-label',b.title);b.onclick=()=>open(index)}
   if(id==='AutoShot')b.onclick=toggleAuto;
   b.dataset.slot=index;b.oncontextmenu=e=>{e.preventDefault();open(index)};
   host.append(b);if(id){if(!byId.has(id))byId.set(id,[]);byId.get(id).push(b)}
  });
  refreshBindings();
 }
 function refreshBindings(){for(const [id,buttons] of byId)for(const b of buttons)b.querySelector('.action-key').textContent=getBindings()[id==='AutoShot'?'toggleAuto':'spell:'+id]?bindingLabel(getBindings()[id==='AutoShot'?'toggleAuto':'spell:'+id]):''}
 function renderEditor(){
  $('barSlotLabel').textContent='Slot '+(selected+1)+' · '+(SPELLS[slots[selected]]?.name||'Empty');
  $('barSlotLeft').disabled=selected===0;$('barSlotRight').disabled=selected===11;
  $('clearBarSlot').disabled=!slots[selected];$('barSlotGrid').replaceChildren();
  slots.forEach((id,index)=>{
   const b=document.createElement('button');b.className='bar-slot'+(index===selected?' selected':'');b.dataset.editSlot=index;b.draggable=true;
   b.setAttribute('aria-pressed',String(index===selected));b.innerHTML='<small>'+(index+1)+'</small><span>'+(SPELLS[id]?.name||'Empty slot')+'</span>';
   b.onclick=()=>{selected=index;renderEditor()};
   b.ondragstart=e=>{dragged=index;e.dataTransfer.setData('text/plain',String(index));e.dataTransfer.effectAllowed='move'};
   b.ondragend=()=>{dragged=null};b.ondragover=e=>{if(dragged!==null)e.preventDefault()};
   b.ondrop=e=>{e.preventDefault();if(dragged===null)return;slots=swapSlots(slots,dragged,index);selected=index;dragged=null;changed()};
   $('barSlotGrid').append(b);
  });
  renderChoices();
 }
 function renderChoices(){
  const search=$('barSearch').value.trim().toLowerCase(),category=$('barCategory').value;$('barAbilityList').replaceChildren();
  for(const a of choices){
   const name=SPELLS[a.id]?.name||a.id;if(!name.toLowerCase().includes(search)||(category&&a.category!==category))continue;
   const b=document.createElement('button');b.className='bar-choice';b.dataset.choice=a.id;b.title=describe(SPELLS[a.id]);
   const label=document.createElement('strong');label.textContent=name;
   const note=document.createElement('span'),locked=TALENT_GATES[a.id]&&!getTalents()[TALENT_GATES[a.id]];
   note.textContent=locked?'Requires talent · can still place':bindingLabel(getBindings()[a.id==='AutoShot'?'toggleAuto':'spell:'+a.id]);
   b.append(label,note);b.onclick=()=>{slots[selected]=a.id;changed()};$('barAbilityList').append(b);
  }
  if(!$('barAbilityList').childElementCount)$('barAbilityList').textContent='No matching abilities.';
 }
 function changed(){save();renderBar();renderEditor()}
 function open(index=0){selected=index;$('barSearch').value='';$('barCategory').value='';renderEditor();setModal('barEditor',true)}
 panel.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();setModal('barEditor',false)}});
 for(const [id,step] of [['barSlotLeft',-1],['barSlotRight',1]])$(id).onclick=()=>{const to=selected+step;if(to<0||to>11)return;slots=swapSlots(slots,selected,to);selected=to;changed()};
 $('barEditorClose').onclick=$('barEditorDone').onclick=()=>setModal('barEditor',false);
 $('barSearch').oninput=$('barCategory').onchange=renderChoices;
 $('clearBarSlot').onclick=()=>{slots[selected]=null;changed()};
 $('resetBarSlots').onclick=()=>{slots=[...DEFAULT_SLOTS];changed()};
 renderBar();
 return {open,host,snapshot:()=>[...slots],restore(value){slots=normalizeSlots(value);renderBar();try{storage.setItem(BAR_STORAGE_KEY,JSON.stringify(slots));return true}catch{return false}},buttonsFor:id=>byId.get(id)||[],refreshBindings,updateAuto(on){for(const b of byId.get('AutoShot')||[]){b.classList.toggle('queued',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',(on?'Stop':'Start')+' Auto Shot');b.title=(on?'Stop':'Start')+' Auto Shot';}}};
}
