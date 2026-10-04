import {SPELLS,RECORDS} from './catalog.js';
const controls={slow:'Slowed',root:'Rooted',stun:'Stunned',freeze:'Freezing Trap',scatter:'Scatter Shot',fear:'Scare Beast',lore:'Beast Lore',armorReduced:'Armor reduced',healingReduced:'Healing reduced',castingSlow:'Casting slowed',petWeaken:'Attack power reduced',disarm:'Disarmed'};
const symbols={HuntersMark:'◎',SerpentSting:'ϟ',ScorpidSting:'Ψ',ViperSting:'◈',slow:'≋',root:'⤓',stun:'✦',freeze:'❄',scatter:'✧',fear:'!'};
export function targetDebuffs(combat){
 if(combat.targetHealth<=0)return [];
 const entries=new Map();
 const add=(id,until,stacks=1)=>{
  if(!(until>combat.time))return;
  entries.set(id,{id,name:SPELLS[id]?.name||RECORDS[id]?.name||controls[id]||id,remaining:until-combat.time,stacks,symbol:symbols[id]||'◆',kind:id==='HuntersMark'?'mark':id.includes('Sting')?'sting':'effect'});
 };
 add('HuntersMark',combat.auras.mark);
 if(combat.sting)add(combat.sting.id,combat.sting.until);
 for(const dot of Object.values(combat.dots))add(dot.id,dot.until,dot.stacks||1);
 for(const [id,until] of Object.entries(combat.debuffs))if(id!=='slowPercent')add(id,until);
 return [...entries.values()];
}
export function auraTime(seconds){
 if(!Number.isFinite(seconds))return '∞';
 if(seconds>=60)return Math.ceil(seconds/60)+'m';
 return seconds<10?seconds.toFixed(1):Math.ceil(seconds)+'s';
}
export function createNameplate(host,onSelect){
 host.innerHTML='<div class="plate-debuffs" role="list" aria-label="Target debuffs"></div><button class="plate-select" aria-label="Target Clockwork Sentinel"><span class="plate-name">Clockwork Sentinel</span><span class="plate-frame"><span class="plate-health"><i></i><span class="plate-percent"></span></span><span class="plate-level">60</span></span></button>';
 const button=host.querySelector('button'),health=host.querySelector('.plate-health i'),percent=host.querySelector('.plate-percent'),debuffs=host.querySelector('.plate-debuffs'),nodes=new Map();
 button.onclick=onSelect;
 return ({combat,selected,x,y,visible,auras})=>{
  host.hidden=!visible;
  host.style.left=x+'px';host.style.top=y+'px';host.classList.toggle('selected',selected);
  const hp=Math.max(0,Math.min(1,combat.targetHealth/combat.targetMaxHealth));
  health.style.width=hp*100+'%';percent.textContent=Math.ceil(hp*100)+'%';
  button.title='Clockwork Sentinel · Level 60 · '+Math.ceil(combat.targetHealth).toLocaleString()+' / '+combat.targetMaxHealth.toLocaleString()+' health';
  const active=new Set(auras.map(a=>a.id));
  for(const [id,node] of nodes)if(!active.has(id)){node.remove();nodes.delete(id)}
  for(const aura of auras){
   let node=nodes.get(aura.id);
   if(!node){node=document.createElement('span');node.className='plate-aura '+aura.kind;node.dataset.aura=aura.id;node.setAttribute('role','listitem');node.innerHTML='<span class="plate-aura-symbol"></span><b class="plate-aura-time"></b><small class="plate-aura-stacks"></small>';nodes.set(aura.id,node)}
   node.querySelector('.plate-aura-symbol').textContent=aura.symbol;
   node.querySelector('.plate-aura-time').textContent=auraTime(aura.remaining);
   node.querySelector('.plate-aura-stacks').textContent=aura.stacks>1?aura.stacks:'';
   node.classList.toggle('expiring',aura.remaining<5);
   node.title=aura.name+' · '+(Number.isFinite(aura.remaining)?Math.ceil(aura.remaining)+' seconds remaining':'Permanent')+(aura.stacks>1?' · '+aura.stacks+' stacks':'');
   node.setAttribute('aria-label',node.title);
   debuffs.appendChild(node);
  }
 };
}
