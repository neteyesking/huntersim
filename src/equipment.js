export const DEFAULT_LOADOUT={
 stats:{agility:200,intellect:100,meleeAP:450,rangedAP:450,crit:20,hit:0,expertise:0,dodge:5,parry:5,armor:0,health:4000,mana:3000,ammoDps:17.5},
 mode:'twoHand',ranged:{min:95,max:145,speed:2.8},twoHand:{min:80,max:80,speed:2.4},mainHand:{min:50,max:70,speed:2.4,dagger:false},offHand:{min:35,max:55,speed:1.8,dagger:false},
 target:{level:63,canParry:true,parryHaste:false,canBlock:false,blockValue:30,attackSpeed:2,damage:140},
};
const limit=(v,min,max,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function normalizeLoadout(raw={}){
 if(!raw||typeof raw!=='object')raw={};
 const stats={};for(const [key,value] of Object.entries(DEFAULT_LOADOUT.stats))stats[key]=limit(raw.stats?.[key],['health','mana'].includes(key)?1:0,['crit','hit','dodge','parry'].includes(key)?100:key==='expertise'?100:50000,value);
 const result={stats,mode:raw.mode==='dualWield'?'dualWield':'twoHand'};
 for(const key of ['ranged','twoHand','mainHand','offHand']){
  const d=DEFAULT_LOADOUT[key],r=raw[key]||{},min=limit(r.min,0,10000,d.min),max=limit(r.max,0,10000,d.max);
  result[key]={min:Math.min(min,max),max:Math.max(min,max),speed:limit(r.speed,.5,6,d.speed)};
  if('dagger' in d)result[key].dagger=typeof r.dagger==='boolean'?r.dagger:d.dagger;
 }
 const t=raw.target||{},d=DEFAULT_LOADOUT.target;
 result.target={parryHaste:typeof t.parryHaste==='boolean'?t.parryHaste:d.parryHaste,level:Math.round(limit(t.level,60,63,d.level)),canParry:typeof t.canParry==='boolean'?t.canParry:d.canParry,canBlock:typeof t.canBlock==='boolean'?t.canBlock:d.canBlock,blockValue:limit(t.blockValue,0,10000,d.blockValue),attackSpeed:limit(t.attackSpeed,.5,10,d.attackSpeed),damage:limit(t.damage,0,10000,d.damage)};
 return result;
}
export function weaponDamage(weapon,ap,roll,normalizedSpeed=weapon.speed){return weapon.min+(weapon.max-weapon.min)*roll+normalizedSpeed*ap/14}
export function armorMultiplier(armor,attackerLevel=60){return 1-Math.min(.75,Math.max(0,armor)/(Math.max(0,armor)+400+85*attackerLevel))}
