import {PET_FAMILIES,SPELLS,validTalents} from './catalog.js';
import {SV_WEAVE} from './presets.js';
import {loadBindings} from './bindings.js';
import {normalizeSlots} from './custom-bar.js';
export const SETTINGS_KEY='hunter-settings-v1',SETUPS_KEY='hunter-setups-v1';
const trainingDefaults={sparring:false,targetArmor:0,targetRegen:false,targetType:'Humanoid',enraged:false,hidden:false,dualWield:false,targetCombatReach:1.5};
const types=['Humanoid','Beast','Demon','Dragonkin','Elemental','Giant','Undead'];
const bool=(v,fallback)=>typeof v==='boolean'?v:fallback;
const number=(v,min,max,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function normalizeSettings(raw={}){
 if(!raw||typeof raw!=='object')raw={};
 const t=raw.training||{},training={...trainingDefaults};
 for(const key of ['sparring','targetRegen','enraged','hidden','dualWield'])training[key]=bool(t[key],training[key]);
 training.targetArmor=number(t.targetArmor,0,20000,0);training.targetCombatReach=number(t.targetCombatReach,0,20,1.5);
 training.targetType=types.includes(t.targetType)?t.targetType:'Humanoid';
 return {training,petFamily:Object.hasOwn(PET_FAMILIES,raw.petFamily)?raw.petFamily:'Cat',petAutocast:bool(raw.petAutocast,true),aspect:raw.aspect?.startsWith?.('Aspect')&&Object.hasOwn(SPELLS,raw.aspect)?raw.aspect:'AspectOfTheHawk',tracking:raw.tracking?.startsWith?.('Track')&&Object.hasOwn(SPELLS,raw.tracking)?raw.tracking:'TrackHumanoids',showBuffs:bool(raw.showBuffs,true),showStats:bool(raw.showStats,true),hitboxes:bool(raw.hitboxes,false)};
}
export function loadSettings(storage){try{return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY)))}catch{return normalizeSettings()}}
export function saveSettings(storage,value){try{storage.setItem(SETTINGS_KEY,JSON.stringify(normalizeSettings(value)));return true}catch{return false}}
export function normalizeSetup(raw){
 if(!raw||typeof raw!=='object')return null;
 const talents=raw.talents&&typeof raw.talents==='object'&&!Array.isArray(raw.talents)&&validTalents(raw.talents)?{...raw.talents}:{...SV_WEAVE};
 return {settings:normalizeSettings(raw.settings),talents,bindings:loadBindings({getItem:()=>JSON.stringify(raw.bindings)}),slots:normalizeSlots(raw.slots)};
}
export function loadSetups(storage){
 try{const raw=JSON.parse(storage.getItem(SETUPS_KEY));if(raw?.version!==1||!Array.isArray(raw.setups))return [];
  const seen=new Set();return raw.setups.slice(0,30).flatMap(row=>{
   if(!row||typeof row.name!=='string'||!row.name.trim()||!row.setup||typeof row.setup!=='object')return [];
   const name=row.name.trim().slice(0,48);if(seen.has(name))return [];seen.add(name);return [{name,setup:normalizeSetup(row.setup)}];
  });
 }catch{return []}
}
export function saveSetups(storage,setups){try{storage.setItem(SETUPS_KEY,JSON.stringify({version:1,setups}));return true}catch{return false}}

export function createSettingsPanel({app,storage,setModal,getSettings,changeSettings,getSetup,applySetup}){
 let setups=loadSetups(storage);
 const panel=document.createElement('div');panel.id='settingsPanel';panel.className='modal hidden';
 panel.innerHTML=`<div class="settings-card"><div class="drawer-head"><div><div class="eyebrow">MAKE IT YOURS</div><h2>Settings &amp; saved setups</h2></div><button id="settingsClose" class="close" aria-label="Close settings">×</button></div><p>Your training options, aspect, pet preferences, talents, keybinds and custom bar are saved automatically in this browser.</p><div class="settings-links"><button class="inline" data-open="trainingBtn">Training options</button><button class="inline" data-open="keybindBtn">Keybinds</button><button class="inline" data-open="editBarBtn">Edit ability bar</button></div><fieldset><legend>Display</legend><label><input type="checkbox" id="settingBuffs"> Show active buffs</label><label><input type="checkbox" id="settingStats"> Show encounter and weaving stats</label><label><input type="checkbox" id="settingHitboxes"> Show hitboxes</label></fieldset><fieldset><legend>Saved setups</legend><p>Save your current configuration as a named setup. Loading one resets the encounter.</p><label class="settings-field">Setup name<input id="setupName" maxlength="48" placeholder="e.g. SV weaving"></label><button id="saveSetup" class="inline">Save / update setup</button><label class="settings-field">Saved setups<select id="setupList"></select></label><div class="settings-links"><button id="loadSetup" class="inline">Load &amp; reset encounter</button><button id="deleteSetup" class="inline">Delete selected</button></div><div id="setupSummary"></div></fieldset><p id="settingsStatus" role="status"></p><small>Saved on this browser and site address. Clearing site data removes these saves.</small></div>`;
 app.append(panel);const $=id=>document.getElementById(id);
 function status(text){$('settingsStatus').textContent=text}
 function refresh(selected=''){
  $('setupList').replaceChildren();
  for(const row of setups){const o=document.createElement('option');o.textContent=o.value=row.name;$('setupList').append(o)}
  if(selected)$('setupList').value=selected;
  $('loadSetup').disabled=$('deleteSetup').disabled=!setups.length;
  summary();
 }
 function summary(){const row=setups.find(s=>s.name===$('setupList').value);$('setupSummary').textContent=row?Object.values(row.setup.talents).reduce((a,b)=>a+b,0)+' talent points · '+row.setup.slots.filter(Boolean).length+' slots · '+row.setup.settings.training.targetCombatReach+' yd target reach · '+row.setup.settings.petFamily:'No saved setups yet.'}
 function display(){const s=getSettings();$('settingBuffs').checked=s.showBuffs;$('settingStats').checked=s.showStats;$('settingHitboxes').checked=s.hitboxes}
 for(const [id,key] of [['settingBuffs','showBuffs'],['settingStats','showStats'],['settingHitboxes','hitboxes']])$(id).onchange=e=>{status(changeSettings({...getSettings(),[key]:e.target.checked})?'Settings saved':'Storage unavailable · settings apply for this session')};
 for(const b of panel.querySelectorAll('[data-open]'))b.onclick=()=>{setModal('settingsPanel',false);$(b.dataset.open).click()};
 $('settingsClose').onclick=()=>setModal('settingsPanel',false);
 panel.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();setModal('settingsPanel',false)}});
 $('setupList').onchange=()=>{$('setupName').value=$('setupList').value;summary()};
 $('saveSetup').onclick=()=>{
  const name=$('setupName').value.trim();if(!name){status('Enter a name for this setup.');$('setupName').focus();return}
  const next=setups.filter(s=>s.name!==name);if(next.length>=30){status('You can keep up to 30 setups. Update or delete one first.');return}
  next.push({name,setup:normalizeSetup(getSetup())});
  if(!saveSetups(storage,next)){status('Could not save: browser storage is unavailable or full.');return}
  setups=next;refresh(name);status('Saved “'+name+'”.');
 };
 $('loadSetup').onclick=()=>{const row=setups.find(s=>s.name===$('setupList').value);if(!row)return;$('setupName').value=row.name;const persisted=applySetup(normalizeSetup(row.setup));display();status('Loaded “'+row.name+'” · encounter reset'+(persisted?'':'. Storage unavailable; applied for this session.'));};
 $('deleteSetup').onclick=()=>{const name=$('setupList').value,next=setups.filter(s=>s.name!==name);if(!saveSetups(storage,next)){status('Could not delete: browser storage is unavailable.');return}setups=next;refresh();status('Deleted “'+name+'”.')};
 return {open(){display();refresh();status('Changes save automatically.');setModal('settingsPanel',true)}};
}
