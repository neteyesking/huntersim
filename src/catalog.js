import data from './hunter-data.json' with {type:'json'};
export const SPELLS=data.spells;
export const TREES=data.talents;
export const RECORDS=data.records;
export const PET_FAMILIES=Object.fromEntries(Object.entries(data.petFamilies).map(([id,f])=>[id,{...f,abilities:[...f.abilities,'GrowlTriggered','CowerTriggered']}]));
export const TALENTS=Object.fromEntries(TREES.flatMap(t=>t.talents).map(t=>[t.field,t]));
export const TALENT_GATES={SummonHawk:'summonHawk',BestialWrath:'bestialWrath',Intimidation:'intimidation',TrueshotAura:'trueshotAura',ScatterShot:'scatterShot',SniperShot:'sniperShot',Counterattack:'counterattack',Deterrence:'deterrence',StriderKick:'striderKick'};
export const MELEE=new Set(['RaptorStrike','MongooseBite','WingClip','Counterattack','StriderKick','Lacerate']);
export const TRAPS=['ImmolationTrap','ExplosiveTrap','FreezingTrap','FrostTrap'];
export const CHANNELS={Volley:6,MendPet:5,TameBeast:20};
export const PRIMARY=['ArcaneShot','AimedShot','MultiShot','SerpentSting','ScorpidSting','HuntersMark','RaptorStrike','MongooseBite','RapidFire','SniperShot','AspectOfTheHawk','AspectOfTheBeast'];
export function category(id){
 if(PRIMARY.includes(id))return 'Core';
 if(id.startsWith('Aspect')||id==='HeartOfTheLion'||id==='TrueshotAura')return 'Aspects & auras';
 if(TRAPS.includes(id)||['FeignDeath','Deterrence','Disengage','Flare','EnchantedFlare'].includes(id))return 'Traps & defense';
 if(['CallPet','DismissPet','RevivePet','MendPet','FeedPet','TameBeast','BeastTraining','EyesOfTheBeast','Intimidation','BestialWrath','SummonHawk'].includes(id))return 'Pets';
 if(id.startsWith('Track')||['BeastLore','EagleEye','ScareBeast'].includes(id))return 'Utility';
 return 'Attacks & control';
}
export const ACTIONS=Object.keys(SPELLS).filter(id=>id!=='AutoShot').map(id=>({id,talent:TALENT_GATES[id],category:category(id),tint:MELEE.has(id)?'#dd8e69':TRAPS.includes(id)?'#a4d78a':'#e2c38c'}));
export const isShot=id=>id.endsWith('Shot')||id.endsWith('Sting')||id==='SummonHawk';
export const isHostile=id=>!id.startsWith('Aspect')&&!id.startsWith('Track')&&!TRAPS.includes(id)&&!['AutoShot','RapidFire','Deterrence','FeignDeath','TrueshotAura','HeartOfTheLion','CallPet','DismissPet','RevivePet','MendPet','FeedPet','BeastTraining','EyesOfTheBeast','EagleEye','Flare','EnchantedFlare','BestialWrath','Intimidation'].includes(id);
export function talentValue(ranks,field,index=0){
 const rank=ranks[field]||0,t=TALENTS[field];
 return !rank||!t?0:t.curves[index]?.[rank-1]??t.data.effects[index]?.value??0;
}
export function validTalents(ranks){
 if(Object.entries(ranks).some(([key,n])=>!TALENTS[key]||!Number.isInteger(n)||n<0||n>TALENTS[key].max))return false;
 if(Object.values(ranks).reduce((a,b)=>a+b,0)>51)return false;
 return TREES.every(tree=>tree.talents.every(t=>{
  if(!ranks[t.field])return true;
  const below=tree.talents.filter(v=>v.row<t.row).reduce((sum,v)=>sum+(ranks[v.field]||0),0);
  const parent=t.requires&&tree.talents.find(v=>v.row===t.requires.rowIdx&&v.col===t.requires.colIdx);
  return below>=t.row*5&&(!parent||ranks[parent.field]===parent.max);
 }));
}
export function changeTalent(ranks,field,delta){
 const next={...ranks,[field]:(ranks[field]||0)+delta};
 return validTalents(next)?next:null;
}
const rowsById=Object.fromEntries([...Object.values(RECORDS),...Object.values(TALENTS).map(t=>t.data)].map(r=>[r.id,r]));
export function describe(row,ranks=null,field=null){
 if(!row)return '';
 const resolve=(reference)=>reference?rowsById[reference]:row;
 return row.description.replace(/\$(\d+)?([somxta])(\d+)/gi,(_,ref,type,n)=>{
  const source=resolve(ref),index=Number(n)-1,e=source?.effects[index];
  if(!source)return 'spell '+ref;
  const value=!ref&&ranks&&field?talentValue(ranks,field,index):e?.value??0;
  if(field==='resourcefulness'&&n==='3')return 30*(ranks?.[field]||1);
  if(type.toLowerCase()==='o')return Math.round(value*source.durationMs/(e?.periodMs||source.durationMs||1));
  if(type.toLowerCase()==='t')return (e?.periodMs||0)/1000;
  if(type.toLowerCase()==='a')return e?.radius||0;
  if(type.toLowerCase()==='x')return e?.targets||value;
  return Math.abs(value);
 }).replace(/\$(\d+)?d\b/g,(_,ref)=>{const r=resolve(ref);return r?Math.max(0,r.durationMs/1000)+' seconds':'the effect duration'})
 .replace(/\$n\b/g,row.aura?.ProcCharges||'3').replace(/\$rap\b/g,'ranged attack power').replace(/\$\{([^}]+)\}/g,'($1)');
}
