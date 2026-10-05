import {SPELLS} from './catalog.js';
import {auraTime} from './nameplate.js';

// Only effects on the hunter belong here; target auras use the nameplate.
const hunterEffects={
 rapidFire:['Rapid Fire','buff'],deterrence:['Deterrence','buff'],trueshot:['Trueshot Aura','buff'],
 quickShots:['Quick Shots','proc'],quickStrikes:['Quick Strikes','proc'],resourceful:['Resourcefulness','proc'],
 rapidKilling:['Rapid Killing','proc'],serpentRegen:['Rapid Recuperation · Sting','proc'],killingRegen:['Rapid Recuperation · Kill','proc'],
 sniper:['Sniper Shot','proc'],strider:['Strider Kick · movement speed','buff'],howl:['Furious Howl','buff'],
 feign:['Feign Death','state'],eyes:['Eyes of the Beast','state'],eagleEye:['Eagle Eye','state'],
};
export function playerBuffs(combat){
 const buffs=[];
 const add=(id,name,until,kind='buff',stacks=1,owner='Hunter')=>{
  if(!(until>combat.time))return;
  buffs.push({id,name,remaining:until-combat.time,kind,stacks,owner});
 };
 if(combat.aspect)add(combat.aspect,SPELLS[combat.aspect]?.name||combat.aspect,Infinity,'aspect');
 for(const [id,[name,kind]] of Object.entries(hunterEffects))add(id,name,combat.auras[id],kind,id==='sniper'?combat.auras.sniperCharges||1:1);
 add('mongooseReady','Mongoose Bite ready',combat.mongooseUntil,'proc');
 if(combat.talents.counterattack)add('counterReady','Counterattack ready',combat.counterUntil,'proc');
 if(combat.petActive()){
  for(const [id,name] of [['bestialWrath','Bestial Wrath'],['intimidation','Intimidation'],['feeding','Feed Pet']])add(id,name,combat.auras[id],'buff',1,'Pet');
  for(const [id,name] of [['frenzyUntil','Frenzy'],['sprintUntil','Dash / Dive'],['defenseUntil','Shell Shield'],['danceUntil',"Trickster’s Dance"]])add(id,name,combat.pet[id],id==='frenzyUntil'?'proc':'buff',1,'Pet');
 }
 return buffs;
}
export function createBuffBar(host){
 host.innerHTML='<div class="buff-heading"><span class="eyebrow">ACTIVE BUFFS</span><small id="buffCount"></small></div><div class="buff-list" role="list" aria-label="Active buffs and procs"></div>';
 const list=host.querySelector('.buff-list'),count=host.querySelector('#buffCount'),nodes=new Map();
 return combat=>{
  const buffs=playerBuffs(combat),active=new Set(buffs.map(b=>b.id));
  for(const [id,node] of nodes)if(!active.has(id)){node.remove();nodes.delete(id)}
  count.textContent=String(buffs.length);
  for(const [index,buff] of buffs.entries()){
   let node=nodes.get(buff.id);
   if(!node){node=document.createElement('div');node.className='buff-tile';node.dataset.buff=buff.id;node.setAttribute('role','listitem');node.innerHTML='<span class="buff-symbol" aria-hidden="true"></span><div><strong class="buff-name"></strong><small class="buff-time"></small></div>';nodes.set(buff.id,node);list.append(node)}
   if(list.children[index]!==node)list.insertBefore(node,list.children[index]||null);
   node.dataset.kind=buff.kind;node.classList.toggle('expiring',buff.remaining<=5);
   node.querySelector('.buff-symbol').textContent=buff.kind==='aspect'?'◇':buff.kind==='proc'?'✦':buff.owner==='Pet'?'◆':'✧';
   node.querySelector('.buff-name').textContent=buff.name;
   const status=[buff.owner==='Pet'?'PET':buff.kind==='proc'?'PROC':buff.kind==='aspect'?'ASPECT':'',Number.isFinite(buff.remaining)?auraTime(buff.remaining):'Active',buff.stacks>1?buff.stacks+' charges':''].filter(Boolean).join(' · ');
   node.querySelector('.buff-time').textContent=status;
   node.title=buff.name+' · '+status;node.setAttribute('aria-label',node.title);
  }
 };
}
