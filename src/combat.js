import {WeavingStats} from './weaving.js';
import {attackRange,centerDistance,DEFAULT_TARGET_COMBAT_REACH} from './scale.js';
import {SPELLS,TREES,ACTIONS,RECORDS,PET_FAMILIES,MELEE,TRAPS,CHANNELS,TALENT_GATES,isShot,isHostile,talentValue} from './catalog.js';
export {SPELLS,TREES,ACTIONS};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const rangedWeapon=new Set(['AutoShot','AimedShot','MultiShot','SniperShot','ScatterShot']);
const tracks={TrackBeasts:'Beast',TrackDemons:'Demon',TrackDragonkin:'Dragonkin',TrackElementals:'Elemental',TrackGiants:'Giant',TrackHumanoids:'Humanoid',TrackUndead:'Undead'};
export class Combat {
 constructor(random=Math.random,{rangedWeaponSpeed=2.8}={}){this.rangedWeaponSpeed=rangedWeaponSpeed;this.random=random;this.talents={};this.options={sparring:false,targetArmor:0,targetRegen:false,targetType:'Humanoid',enraged:false,hidden:false,dualWield:false,targetCombatReach:DEFAULT_TARGET_COMBAT_REACH};this.petFamily='Cat';this.reset()}
 reset(){
  Object.assign(this,{moving:false,time:0,mana:3000,maxMana:3000,health:4000,maxHealth:4000,targetHealth:50000,targetMaxHealth:50000,targetMana:3000,damage:0,gcdUntil:0,gcdDuration:1.5,cooldowns:{},cooldownDurations:{},auras:{},debuffs:{},dots:{},sting:null,cast:null,projectiles:[],autoShot:true,autoSwingStart:0,nextAuto:0,autoRetryAt:null,autoWindupStart:null,autoWindupEnd:0,lastAutoShot:null,expectedAutoShotAt:null,autoDelay:0,autoResetByMelee:false,previousMelee:0,nextMelee:2.4,nextOffhand:2.4,raptorQueued:false,mongooseUntil:0,counterUntil:0,aspect:'AspectOfTheHawk',tracking:'TrackHumanoids',events:[],textEvents:[],visualEvents:[],traps:[],hawks:[],lastSpend:-10,nextIncoming:2,nextSpirit:10,threat:0,petThreat:0,trainingOpen:false,pet:null});
  this.weaving=new WeavingStats();
  this.log('Training begins.');
 }
 log(message,kind='info'){this.events.unshift({time:this.time,message,kind});this.events.length=Math.min(9,this.events.length)}
 rank(field){return this.talents[field]||0}
 value(field,index=0){return talentValue(this.talents,field,index)}
 pct(field,index=0){return this.value(field,index)/100}
 distance(p){return centerDistance(p)}
 facing(p){return Math.cos(Math.atan2(-p.x,-p.z)-p.yaw)>=0}
 rangeFor(id){return attackRange(SPELLS[id],isShot(id)?(id==='SniperShot'?0:this.value('hawkEye'))+(this.auras.sniper&&id!=='SniperShot'?10:0):0,this.options.targetCombatReach).max}
 minRangeFor(id){return attackRange(SPELLS[id],0,this.options.targetCombatReach).min}
 petActive(){return !!this.pet?.active&&this.pet.health>0}
 stats(){
  const agi=200*(1+this.pct('lightningReflexes')),intellect=100;
  const common=450+(agi-200)+intellect*this.pct('carefulAim');
  return {agi,intellect,melee:common+(this.auras.howl?RECORDS.FuriousHowlTriggered.effects[0].value:0)+(['AspectOfTheBeast','AspectOfTheFalcon'].includes(this.aspect)?this.aspect==='AspectOfTheBeast'?110:120:0),
   ranged:common+(['AspectOfTheHawk','AspectOfTheFalcon'].includes(this.aspect)?120:0)+(this.auras.mark?71:0)+(this.auras.trueshot?SPELLS.TrueshotAura.effects[0].value:0),
   crit:.2+this.pct('lethalAttacks')+(agi-200)/5300};
 }
 manaCost(id){
  const s=SPELLS[id];let cost=(s.mana||0)+(s.manaPct||0)*this.maxMana/100;
  if(isShot(id)||MELEE.has(id))cost*=1+this.pct('efficiency');
  if(MELEE.has(id)||TRAPS.includes(id))cost*=1+this.pct('resourcefulness');
  if(id==='RevivePet')cost*=1+this.pct('improvedRevivePet',1);
  if(id==='MendPet')cost*=1-Math.abs(this.pct('improvedMendPet',1));
  return Math.ceil(cost-1e-9);
 }
 cooldown(id){
  let cd=SPELLS[id].cooldownMs/1000;
  if(id==='ArcaneShot')cd+=this.value('improvedArcaneShot')/1000;
  if(id==='ViperSting')cd+=this.value('improvedStings',1)/1000;
  if(id==='RapidFire')cd+=this.value('rapidKilling')/1000;
  if(TRAPS.includes(id)||id==='Deterrence')cd*=1+this.pct('survivalistsDiscipline');
  return Math.max(0,cd);
 }
 setCooldown(id,seconds){this.cooldowns[id]=this.time+seconds;this.cooldownDurations[id]=seconds}
 spend(id){this.mana-=this.manaCost(id);if(this.manaCost(id))this.lastSpend=this.time}
 abilityState(id,p){
  const s=SPELLS[id],queued=id==='RaptorStrike'&&this.raptorQueued;
  const procUntil=id==='MongooseBite'?this.mongooseUntil:id==='Counterattack'?this.counterUntil:0;
  const state={usable:true,reason:'',code:'ready',queued,procRemaining:Math.max(0,procUntil-this.time)};
  const blocked=(code,reason)=>({...state,usable:false,code,reason});
  if(!s)return blocked('unknown','Unavailable');
  if(queued)return state;
  if(this.health<=0)return blocked('dead','Reset after defeat');
  if(TALENT_GATES[id]&&!this.rank(TALENT_GATES[id]))return blocked('talent','Requires '+s.name+' talent');
  if(isHostile(id)&&(p.targeted===false||this.targetHealth<=0))return blocked('target','No living target');
  if(isHostile(id)&&!this.targetVisible())return blocked('target','Target is hidden: use Flare or tracking');
  if(isHostile(id)&&s.maxRange>0){
   const range=this.distance(p);
   if(range<this.minRangeFor(id)-1e-8)return blocked('range','Too close: requires at least '+this.minRangeFor(id)+' yd');
   if(range>this.rangeFor(id)+1e-8)return blocked('range','Out of range: maximum '+this.rangeFor(id)+' yd');
   if(!this.facing(p))return blocked('facing','Face the target');
  }
  if(['MendPet','FeedPet','DismissPet','EyesOfTheBeast','BestialWrath','Intimidation'].includes(id)&&!this.petActive())return blocked('pet','Requires a living pet');
  if(['MendPet','FeedPet','EyesOfTheBeast','Intimidation','BestialWrath'].includes(id)&&this.petActive()&&Math.hypot(this.pet.x-p.x,this.pet.z-p.z)>45)return blocked('pet','Pet out of range');
  if(id==='CallPet'&&(this.petActive()||this.pet?.health<=0))return blocked('pet',this.petActive()?'Pet already active':'Revive your pet first');
  if(id==='RevivePet'&&(!this.pet||this.pet.health>0))return blocked('pet','Requires a dead pet');
  if(['TameBeast','ScareBeast','BeastLore'].includes(id)&&this.options.targetType!=='Beast')return blocked('target','Requires a Beast target');
  if(id==='TameBeast'&&this.petActive())return blocked('pet','Dismiss your pet first');
  if(id==='Intimidation'&&(p.targeted===false||this.targetHealth<=0))return blocked('target','No living target');
  if(id==='MongooseBite'&&this.time>=this.mongooseUntil)return blocked('proc','Requires a dodge or Expose Prey');
  if(id==='Counterattack'&&this.time>=this.counterUntil)return blocked('proc','Requires a parry');
  if(this.mana<this.manaCost(id))return blocked('mana','Not enough mana: requires '+this.manaCost(id));
  if(this.cast)return blocked('casting','Already casting');
  if(this.moving&&(s.castMs>0||CHANNELS[id]))return blocked('moving','Must stand still to cast');
  if(this.time<(this.cooldowns[id]||0)-.001)return blocked('cooldown','Ability cooldown');
  if(s.gcdMs&&this.time<this.gcdUntil-.001)return blocked('gcd','Global cooldown');
  return state;
 }
 canCast(id,p,silent=false){
  const state=this.abilityState(id,p);
  if(!state.usable&&!silent)this.log(state.reason,'error');
  return state.usable;
 }
 castSpell(id,p){
  if(!this.canCast(id,p))return false;
  if(id==='AutoShot'){this.autoShot=!this.autoShot;return true}
  if(id==='RaptorStrike'){this.raptorQueued=!this.raptorQueued;this.log(this.raptorQueued?'Raptor Strike queued':'Raptor Strike cancelled');return true}
  delete this.auras.feign;delete this.auras.eagleEye;delete this.auras.eyes;
  this.spend(id);
  const s=SPELLS[id];
  if(s.gcdMs){this.gcdDuration=s.gcdMs/1000;this.gcdUntil=this.time+this.gcdDuration}
  this.setCooldown(id,this.cooldown(id));
  if(id==='AimedShot'||id==='MultiShot'){this.setCooldown('AimedShot',6);this.setCooldown('MultiShot',6)}
  if(id==='ArcaneShot'||id==='SummonHawk'){this.setCooldown('ArcaneShot',this.cooldown(id));this.setCooldown('SummonHawk',this.cooldown(id))}
  if(TRAPS.includes(id))for(const trap of TRAPS)this.setCooldown(trap,this.cooldown(id));
  const ranged=['AimedShot','MultiShot','SniperShot'].includes(id),haste=ranged?this.rangedHaste():1;
  const spellDuration=Math.max(0,(s.castMs+(id==='RevivePet'?this.value('improvedRevivePet'):0))/1000)/haste;
  const windupDuration=ranged?.5/haste:0,duration=CHANNELS[id]||spellDuration+windupDuration;
  if(duration>0){
   this.cast={id,start:this.time,until:this.time+duration,duration,spellDuration:CHANNELS[id]||spellDuration,windupDuration,windupStart:this.time+spellDuration,channel:!!CHANNELS[id],nextTick:this.time+1};
   this.log(s.name+(CHANNELS[id]?' channeling':' casting'));
  }else this.finishSpell(id,p);
  return true;
 }
 interrupt(reason='movement'){if(this.cast){this.log(SPELLS[this.cast.id].name+' interrupted by '+reason,'error');this.cast=null}}
 buff(name,seconds){this.auras[name]=seconds<0?Infinity:this.time+seconds}
 control(name,seconds){this.debuffs[name]=this.time+seconds}
 targetVisible(){return !this.options.hidden||this.auras.mark||this.auras.flare||this.tracking==='TrackHidden'}
 finishSpell(id,p){
  if(id==='SniperShot'){this.buff('sniper',10);this.auras.sniperCharges=3}
  const s=SPELLS[id],duration=s.durationMs/1000;
  if(id.startsWith('Aspect')){this.aspect=id;this.log(s.name+' active','buff');return}
  if(id.startsWith('Track')){this.tracking=id;this.log(s.name+' active','buff');return}
  if(TRAPS.includes(id)){this.traps=[{id,x:p.x,z:p.z,armed:this.time+2,until:this.time+60}];this.log(s.name+' placed: arms in 2 seconds');return}
  switch(id){
   case 'RapidFire':this.buff('rapidFire',duration);break;
   case 'Deterrence':this.buff('deterrence',duration);break;
   case 'HuntersMark':this.buff('mark',duration);break;
   case 'TrueshotAura':this.buff('trueshot',duration);break;
   case 'FeignDeath':
    this.autoShot=false;this.raptorQueued=false;
    if(this.random()<Math.max(0,.04-this.pct('survivalTactics')))this.log('Feign Death resisted','miss');
    else {this.buff('feign',duration);this.threat=0}break;
   case 'CallPet':this.summonPet(p);break;
   case 'DismissPet':this.pet.active=false;this.pet.order='follow';break;
   case 'RevivePet':this.pet.active=true;this.pet.health=this.pet.maxHealth*(.15+this.pct('improvedRevivePet',2));this.pet.x=p.x+1;this.pet.z=p.z;break;
   case 'FeedPet':this.buff('feeding',20);this.pet.nextFeed=this.time+2;break;
   case 'MendPet':case 'Volley':break;
   case 'TameBeast':this.summonPet(p);this.autoShot=false;this.log('Training beast tamed; encounter dummy remains available');break;
   case 'BeastTraining':this.trainingOpen=true;break;
   case 'EyesOfTheBeast':this.buff('eyes',duration);this.pet.order='stay';break;
   case 'EagleEye':this.buff('eagleEye',duration);break;
   case 'Flare':case 'EnchantedFlare':this.buff('flare',duration);break;
   case 'BeastLore':this.control('lore',30);this.log('Training Beast: '+this.targetHealth+' health, '+this.options.targetArmor+' armor, omnivore');break;
   case 'BestialWrath':this.buff('bestialWrath',duration);this.pet.controlUntil=0;break;
   case 'Intimidation':this.buff('intimidation',15);break;
   default:
    this.projectiles.push({id,at:this.time+(s.speed>0?this.distance(p)/s.speed:0)});
    this.visualEvents.push({type:MELEE.has(id)||id==='Disengage'?'melee':'shoot',id});
    this.log(s.name+' fired','shot');return;
  }
  this.log(s.name+' active','buff');
 }
 hit(id,bonus=0){
  if(this.random()<Math.max(0,.08-this.pct('surefooted',2)-bonus)){
   this.log((SPELLS[id]?.name||id)+' missed','miss');this.textEvents.push({text:'Miss',kind:'miss',id});return false;
  }return true;
 }
 damageMultiplier(id,pet=false){
  let m=1;
  if(this.petActive())m*=1+this.pct('focusedFire');
  else if(!pet)m*=1+this.pct('loneWolf');
  if(!pet&&this.options.targetType===tracks[this.tracking])m*=1+this.pct('improvedTracking');
  if(rangedWeapon.has(id))m*=1+this.pct('rangedWeaponSpecialization');
  if(['AimedShot','MultiShot','Volley'].includes(id))m*=1+this.pct('barrage');
  if(id==='SerpentSting')m*=(1+this.pct('improvedStings'))*(1+this.pct('improvedSerpentSting'));
  if(TRAPS.includes(id))m*=1+this.pct('cleverTraps',1);
  return m;
 }
 rollDamage(base,id,{periodic=false,landed=false,pet=false,guardian=false,raw=false,guaranteedCrit=false}={}){
  if(this.targetHealth<=0)return 0;
  if(!periodic&&!landed&&!this.hit(id))return 0;
  const melee=MELEE.has(id)||id==='Melee Swing'||id==='Offhand';
  const chance=this.stats().crit+(MELEE.has(id)?this.pct('savageStrikes'):0)+((pet||guardian||id==='SummonHawk')?this.pct('ferocity'):0);
  const intimidating=pet&&!periodic&&!!this.auras.intimidation;
  const crit=!periodic&&(intimidating||guaranteedCrit||this.random()<chance);
  const bonus=pet||guardian?0:melee?this.pct('predatorsEdge'):rangedWeapon.has(id)||isShot(id)?this.pct('mortalShots'):0;
  const physical=melee||rangedWeapon.has(id)||pet;
  const armor=Math.max(0,(this.options.targetArmor||0)-(this.debuffs.armorReduced?505:0));
  const mitigation=!periodic&&physical?1-armor/(armor+5500):1;
  const amount=Math.max(0,Math.floor(base*mitigation*(crit?2+bonus:1)+1e-9));
  this.targetHealth=Math.max(0,this.targetHealth-amount);this.damage+=amount;
  if(pet)this.petThreat+=amount;else this.threat+=amount;
  if(intimidating){this.control('stun',3);this.petThreat+=RECORDS.IntimidationTriggered.effects[0].value;delete this.auras.intimidation}
  if(amount){delete this.debuffs.freeze;delete this.debuffs.scatter;delete this.debuffs.fear}
  this.log((crit?'Critical ':'')+(SPELLS[id]?.name||id)+' '+amount,crit?'crit':'damage');
  this.textEvents.push({text:String(amount),kind:crit?'crit':'damage',id});
  if(!periodic&&!pet&&!guardian){
   if(this.auras.mark&&this.random()<this.pct('exposePrey'))this.mongooseUntil=this.time+5;
   if(crit&&this.random()<this.rank('resourcefulness')*.3)this.buff('resourceful',30);
   const proc=this.random()<this.pct('deadlyAspects');
   if(proc&&id==='AutoShot'&&['AspectOfTheHawk','AspectOfTheFalcon'].includes(this.aspect))this.buff('quickShots',12);
   if(proc&&id==='Melee Swing'&&['AspectOfTheBeast','AspectOfTheFalcon'].includes(this.aspect))this.buff('quickStrikes',12);
   if(this.auras.sniper&&id!=='SniperShot'&&isShot(id)&&--this.auras.sniperCharges<=0)delete this.auras.sniper;
  }
  if(pet&&crit&&this.random()<this.pct('frenzy')){if(pet)this.pet.frenzyUntil=this.time+8;else this.buff('hawkFrenzy',8)}
  if(this.targetHealth===0&&this.rank('rapidKilling'))this.buff('rapidKilling',20);
  return amount;
 }
 weaponDamage(){return 95+this.random()*50+this.rangedWeaponSpeed*this.stats().ranged/14+this.rangedWeaponSpeed*17.5}
 meleeDamage(){return 80+this.stats().melee*2.4/14}
 dot(id,amount,period,duration,{raw=false,pet=false,drain=0}={}){
  this.dots[id]={id,amount:raw?amount:amount*this.damageMultiplier(id,pet),period,next:this.time+period,until:this.time+duration,pet,drain};
 }
 resolve(id){
  if(this.targetHealth<=0)return;
  if(id==='MongooseBite')this.mongooseUntil=0;
  if(id==='Counterattack')this.counterUntil=0;
  if(id!=='SummonHawk'&&!this.hit(id))return;
  const s=SPELLS[id],v=s?.effects[0]?.value||0;
  if(id.endsWith('Sting')){
   if(this.sting)delete this.dots[this.sting.id];
   const duration=s.durationMs/1000+(id==='ScorpidSting'?this.value('improvedStings',2)/1000:0);
   this.sting={id,until:this.time+duration};
   if(id==='SerpentSting'){this.dot(id,v+.03*this.stats().ranged,3,duration);if(this.rank('rapidRecuperation'))this.buff('serpentRegen',15)}
   if(id==='ViperSting')this.dot(id,0,2,duration,{drain:v});
   this.log(s.name+' applied','buff');return;
  }
  let base=0;
  switch(id){
   case 'AutoShot':case 'MultiShot':base=this.weaponDamage();break;
   case 'ArcaneShot':base=v+.1*this.stats().ranged;break;
   case 'AimedShot':case 'SniperShot':base=this.weaponDamage()+v;break;
   case 'RaptorStrike':case 'MongooseBite':base=this.meleeDamage()+v;break;
   case 'WingClip':base=v;this.control('slow',10);this.debuffs.slowPercent=60;if(this.random()<this.pct('improvedWingClip'))this.control('root',5);break;
   case 'Counterattack':base=this.meleeDamage()*.5+v;this.control('root',5);this.counterUntil=0;break;
   case 'StriderKick':base=this.meleeDamage();this.buff('strider',3);break;
   case 'ScatterShot':base=this.weaponDamage()*.5;this.autoShot=false;this.autoWindupStart=null;break;
   case 'ConcussiveShot':this.control('slow',4);this.debuffs.slowPercent=50;if(this.random()<this.pct('improvedConcussiveShot'))this.control('stun',3);break;
   case 'DistractingShot':this.threat+=600;break;
   case 'Disengage':this.threat=Math.max(0,this.threat-810);break;
   case 'TranquilizingShot':this.options.enraged=false;break;
   case 'ScareBeast':this.control('fear',20);this.autoShot=false;break;
   case 'Lacerate':this.dot(id,v,3,21);break;
   case 'SummonHawk':
    base=108+.05*this.stats().ranged;
    if(this.hawks.length>=2)this.hawks.shift();
    this.hawks.push({until:this.time+18,next:this.time+2});break;
   default:throw new Error('Missing impact handler: '+id);
  }
  if(base){
   let multiplier=this.damageMultiplier(id)*(id==='SummonHawk'?1+this.pct('unleashedFury'):1);
   if(this.auras.rapidKilling&&isShot(id)){multiplier*=1+this.pct('rapidKilling',1);delete this.auras.rapidKilling;if(this.rank('rapidRecuperation'))this.buff('killingRegen',15)}
   const amount=this.rollDamage(base*multiplier,id,{landed:true});
   if(id==='MongooseBite'){this.mongooseUntil=0;if(this.rank('laceratingStrikes'))this.dot('Lacerating Strikes',amount*this.pct('laceratingStrikes')/7,3,21,{raw:true})}
  }
  if(id==='ScatterShot')this.control('scatter',4);
 }
 rangedHaste(){return (this.auras.rapidFire?1.4:1)*(this.auras.quickShots?1.3:1)}
 meleeHaste(){return (this.auras.rapidFire?1.4:1)*(this.auras.quickStrikes?1.3:1)}
 movementMultiplier(){return (this.auras.dazed?.5:1)*(1+Math.max(['AspectOfTheCheetah','AspectOfThePack'].includes(this.aspect)?.3+this.pct('pathfinding'):0,this.auras.strider?.3:0))}
 summonPet(p){
  if(this.pet?.health>0){this.pet.active=true;this.pet.x=p.x+1;this.pet.z=p.z;return}
  const family=PET_FAMILIES[this.petFamily],health=2200*(1+this.pct('enduranceTraining'))*(1+(family.passive.effects[2]?.value||0)/100);
  this.pet={active:true,family:this.petFamily,health,maxHealth:health,focus:100,happiness:1.25,x:p.x+1,z:p.z,order:'follow',next:0,gcd:0,cooldowns:{},autocast:this.petAutocast??true,frenzyUntil:0,threat:0};
 }
 receiveNatureDamage(amount){
  const resistance=this.aspect==='AspectOfTheWild'?SPELLS.AspectOfTheWild.effects[0].value:0;
  this.health=Math.max(0,this.health-amount*(1-Math.min(.75,resistance/300*.75)));
 }
 applyPetControl(seconds){if(!this.petActive()||this.auras.bestialWrath)return false;this.pet.controlUntil=this.time+seconds;return true}
 petDamageMultiplier(){
  const family=PET_FAMILIES[this.pet.family];
  return (1+(family.passive.effects[0]?.value||0)/100)*(1+this.pct('unleashedFury'))*this.damageMultiplier('Pet',true)*this.pet.happiness*(this.auras.bestialWrath?1.5:1);
 }
 respawnTarget(){this.targetHealth=this.targetMaxHealth;this.targetMana=3000;this.debuffs={};this.dots={};this.sting=null;this.threat=0;this.petThreat=0;this.projectiles=[];delete this.auras.mark;this.log('Training target restored')}
 petCommand(order){if(!this.petActive())return false;this.pet.order=order;this.log('Pet: '+order);return true}
 tickPet(dt,p){
  if(!this.petActive())return;
  const pet=this.pet,family=PET_FAMILIES[pet.family];
  if(pet.debuff&&this.time>=pet.nextPoison){pet.nextPoison=this.time+2;pet.health=Math.max(0,pet.health-35)}
  pet.maxHealth=2200*(1+this.pct('enduranceTraining'))*(1+(family.passive.effects[2]?.value||0)/100);
  pet.health=Math.min(pet.health,pet.maxHealth);
  pet.focus=Math.min(100,pet.focus+dt*5*(1+this.pct('bestialDiscipline')));
  if(this.auras.feeding&&this.time>=pet.nextFeed){pet.nextFeed+=2;pet.happiness=Math.min(1.25,pet.happiness+.05);pet.health=Math.min(pet.maxHealth,pet.health+pet.maxHealth*.01)}
  if(pet.controlUntil>this.time)return;
  const attacking=pet.order==='attack'&&this.targetHealth>0;
  if(!this.auras.eyes&&pet.order!=='stay'){
   const x=attacking?1:p.x+1,z=attacking?1:p.z,dx=x-pet.x,dz=z-pet.z,d=Math.hypot(dx,dz);
   const speed=7*(1+this.pct('bestialSwiftness'))*(pet.sprintUntil>this.time?1.8:1)*(pet.prowl?.6:1);
   if(d>.1){const n=Math.min(d,speed*dt)/d;pet.x+=dx*n;pet.z+=dz*n}
  }
  const near=Math.hypot(pet.x,pet.z)<=this.rangeFor('RaptorStrike');
  const multiplier=this.petDamageMultiplier();
  if(attacking&&near&&this.time>=pet.next){
   pet.next=this.time+2/(pet.frenzyUntil>this.time?1.3:1)/(pet.danceUntil>this.time?1.3:1);
   const intimidate=!!this.auras.intimidation;
   const hit=this.rollDamage((36.34+this.random()*18.98+2*(252+.1*Math.max(this.stats().ranged,this.stats().melee)+(pet.chargeAP||0))/14)*multiplier*(pet.prowl?1.5:1),'Pet melee',{pet:true,guaranteedCrit:intimidate});
   if(hit){pet.prowl=false;pet.chargeAP=0}
   
  }
  if(attacking&&pet.autocast&&this.time>=pet.gcd){
   for(const id of [...family.abilities].sort((a,b)=>RECORDS[b].cooldownMs-RECORDS[a].cooldownMs)){
    if(!['ProwlTriggered','CowerTriggered'].includes(id)&&this.petAbility(id,multiplier,near)){pet.gcd=this.time+1.5;break}
   }
  }
 }
 petAbility(id,multiplier=this.petActive()?this.petDamageMultiplier():1,near=true){
  const pet=this.pet,s=RECORDS[id];if(!s||!this.petActive()||!PET_FAMILIES[pet.family].abilities.includes(id))return false;
  if(this.time<pet.gcd||this.time<(pet.cooldowns[id]||0)||pet.focus<s.mana)return false;
  const distance=Math.hypot(pet.x,pet.z),self=['DashTriggered','DiveTriggered','ProwlTriggered','ShellShieldTriggered','TrickstersDanceTriggered','FuriousHowlTriggered'].includes(id);
  if(!self&&(this.targetHealth<=0||distance<s.minRange||distance>(s.maxRange>5?s.maxRange:this.rangeFor('RaptorStrike'))))return false;
  if(near&&/Dash|Dive/.test(id))return false;
  if(id==='ProwlTriggered'&&pet.order==='attack')return false;
  const auraNames={DustCloudTriggered:'armorReduced',DismemberTriggered:'healingReduced',LavaBreathTriggered:'castingSlow',DemoralizingScreechTriggered:'petWeaken',MineTriggered:'disarm'};
  if(auraNames[id]&&this.debuffs[auraNames[id]]>this.time+2)return false;
  if(id==='FuriousHowlTriggered'&&this.auras.howl>this.time+2)return false;
  pet.focus-=s.mana;pet.cooldowns[id]=this.time+s.cooldownMs/1000;pet.gcd=this.time+s.gcdMs/1000;
  this.log('Pet: '+s.name);
  if(!self&&!this.hit(s.name))return true;
  const values=s.effects,duration=s.durationMs/1000;
  if(id==='GrowlTriggered'||id==='CowerTriggered')this.petThreat=Math.max(0,this.petThreat+values[0].value);
  const direct=values.find(e=>[2,58,121].includes(e.type));
  if(direct)this.rollDamage(direct.value*(1+(this.random()-.5)*direct.variance)*multiplier,s.name,{pet:true,landed:true});
  const dot=values.find(e=>e.aura===3&&e.periodMs);
  if(dot){
   const previous=this.dots[s.name],stacks=Math.min(s.aura.MaxStack||1,(previous?.stacks||0)+1);
   this.dot(s.name,dot.value*stacks*multiplier,dot.periodMs/1000,duration,{raw:true,pet:true});
   this.dots[s.name].stacks=stacks;if(previous)this.dots[s.name].next=previous.next;
  }
  if(/Dash|Dive/.test(id))pet.sprintUntil=this.time+duration;
  if(id==='ChargeTriggered'){pet.x=1;pet.z=1;pet.chargeAP=values[1].value;this.control('root',1)}
  if(id==='WebTriggered')this.control('root',duration);
  const slow=values.find(e=>e.aura===33);
  if(slow&&!self){this.control('slow',duration);this.debuffs.slowPercent=Math.abs(slow.value)}
  if(id==='ShellShieldTriggered')pet.defenseUntil=this.time+duration;
  if(id==='TrickstersDanceTriggered')pet.danceUntil=this.time+duration;
  if(auraNames[id])this.control(auraNames[id],duration);
  if(id==='FuriousHowlTriggered')this.buff('howl',duration);
  if(id==='ProwlTriggered')pet.prowl=true;
  return true;
 }
 incoming(p){
  if(!this.options.sparring||this.targetHealth<=0||this.health<=0||this.auras.feign||['freeze','stun','scatter','fear','disarm'].some(k=>this.debuffs[k]>this.time))return;
  const petTarget=this.petActive()&&this.pet.order==='attack'&&this.petThreat>this.threat;
  if(!petTarget&&this.distance(p)>this.rangeFor('RaptorStrike'))return;
  const dodge=.05+(petTarget&&this.pet.danceUntil>this.time?.5:0)+(this.aspect==='AspectOfTheMonkey'?(.08+this.pct('improvedAspectOfTheMonkey'))*(petTarget?.5:1):0)+(this.auras.deterrence&&!petTarget?.25:0);
  const parry=petTarget?0:.05+this.pct('deflection')+(this.auras.deterrence?.25:0);
  const roll=this.random(),miss=.05+(this.sting?.id==='ScorpidSting'?.02:0);
  if(roll<miss)return;
  if(roll<miss+dodge){if(!petTarget)this.mongooseUntil=this.time+5;this.log('Dodged incoming attack');return}
  if(roll<miss+dodge+parry){this.counterUntil=this.time+5;this.log('Parried incoming attack');return}
  let damage=140*(this.options.enraged?1.5:1)*(this.debuffs.petWeaken?.8:1);
  if(petTarget){damage/=1+.15*(1+this.pct('enduranceTraining'));if(this.pet.defenseUntil>this.time)damage*=.5;this.pet.health=Math.max(0,this.pet.health-damage)}
  else {this.health=Math.max(0,this.health-damage);if(['AspectOfTheCheetah','AspectOfThePack'].includes(this.aspect))this.buff('dazed',4*(1+this.pct('surefooted')))}
  this.log((petTarget?'Pet':'Hunter')+' takes '+Math.round(damage),'error');
 }
 tickTraps(){
  for(const trap of this.traps){
   if(this.time<trap.armed||this.time>trap.until||Math.hypot(trap.x,trap.z)>3)continue;
   trap.until=0;
   if(!this.hit(trap.id,this.pct('survivalTactics')))continue;
   if(this.rank('entrapment'))this.control('root',this.value('entrapment')/1000);
   const duration=1+this.pct('cleverTraps');
   if(trap.id==='FreezingTrap')this.control('freeze',20*duration);
   if(trap.id==='FrostTrap'){this.control('slow',30*duration);this.debuffs.slowPercent=60}
   if(trap.id==='ImmolationTrap')this.dot(trap.id,138,3,15);
   if(trap.id==='ExplosiveTrap'){this.rollDamage(229*this.damageMultiplier(trap.id),trap.id,{landed:true});this.dot(trap.id,33,2,20)}
   this.log(SPELLS[trap.id].name+' triggered');
  }
  this.traps=this.traps.filter(t=>t.until>this.time);
 }
 tick(dt,p,moving){
  dt=clamp(dt,0,.05);this.time+=dt;this.moving=!!moving;
  this.maxHealth=4000*(1+this.pct('survivalist'));this.health=Math.min(this.health,this.maxHealth);
  if(this.options.targetRegen&&this.targetHealth>0)this.targetHealth=Math.min(this.targetMaxHealth,this.targetHealth+dt*100*(this.debuffs.healingReduced?.5:1));
  this.maxMana=3000+(this.stats().intellect-100)*15;
  const castingRegen=Math.min(1,this.pct('bestialDiscipline',1)+Math.max(this.auras.serpentRegen?this.pct('rapidRecuperation'):0,this.auras.killingRegen?this.pct('rapidRecuperation',1):0)+(this.auras.resourceful?.5:0));
  this.mana=Math.min(this.maxMana,this.mana+dt*22*(this.time-this.lastSpend>=5?1:castingRegen));
  if(this.value('spiritBond',1)&&this.nextSpirit>this.time+this.value('spiritBond',1))this.nextSpirit=this.time+this.value('spiritBond',1);
  if(this.time>=this.nextSpirit){this.nextSpirit=this.time+(this.value('spiritBond',1)||10);if(this.petActive()&&this.rank('spiritBond')){this.health=Math.min(this.maxHealth,this.health+this.maxHealth*.01);this.pet.health=Math.min(this.pet.maxHealth,this.pet.health+this.pet.maxHealth*.01)}}
  if(moving){this.interrupt();delete this.auras.feign;delete this.auras.eagleEye}
  for(const dot of Object.values(this.dots)){
   while(dot.next<=this.time+1e-8&&dot.next<=dot.until+1e-8){
    dot.next+=dot.period;
    if(dot.amount)this.rollDamage(dot.id==='SerpentSting'?(SPELLS.SerpentSting.effects[0].value+.03*this.stats().ranged)*this.damageMultiplier(dot.id):dot.amount,dot.id,{periodic:true,pet:dot.pet});
    if(dot.drain)this.targetMana=Math.max(0,this.targetMana-dot.drain);
   }
   if(dot.until<=this.time)delete this.dots[dot.id];
  }
  if(this.sting?.until<=this.time)this.sting=null;
  for(const [name,until] of Object.entries(this.auras))if(name!=='sniperCharges'&&until<=this.time)delete this.auras[name];
  for(const [name,until] of Object.entries(this.debuffs))if(name!=='slowPercent'&&until<=this.time)delete this.debuffs[name];
  if(this.cast){
   const c=this.cast;
   if(c.channel&&this.time+1e-8>=c.nextTick&&c.nextTick<=c.until){
    c.nextTick++;
    if(c.id==='Volley')this.rollDamage((RECORDS.VolleyTriggered.effects[0].value)*this.damageMultiplier('Volley'),'Volley',{periodic:true});
    if(c.id==='MendPet'&&this.petActive()){this.pet.health=Math.min(this.pet.maxHealth,this.pet.health+245);if(this.random()<this.pct('improvedMendPet'))delete this.pet.debuff}
   }
   if(this.time+1e-8>=c.until){this.cast=null;this.finishSpell(c.id,p)}
  }
  for(let i=this.projectiles.length-1;i>=0;i--)if(this.time>=this.projectiles[i].at){this.resolve(this.projectiles[i].id);this.projectiles.splice(i,1)}
  this.tickTraps();this.tickPet(dt,p);
  for(const hawk of this.hawks)if(this.time<hawk.until&&this.time>=hawk.next&&this.targetHealth>0){hawk.next=this.time+2/this.meleeHaste();this.rollDamage((45+252*2/14)*(1+this.pct('unleashedFury'))*this.damageMultiplier('Hawk'),'Hawk',{guardian:true})}
  this.hawks=this.hawks.filter(h=>h.until>this.time);
  if(this.time>=this.nextIncoming){this.nextIncoming=this.time+2;this.incoming(p)}
  const autoTracking=this.autoShot&&this.health>0&&this.targetHealth>0&&p.targeted!==false&&!this.auras.feign&&!this.auras.eyes&&!this.auras.eagleEye;
  this.weaving.position(this.time,this.distance(p),this.minRangeFor('AutoShot'),this.rangeFor('AutoShot'),autoTracking);
  if(!autoTracking)this.expectedAutoShotAt=null;
  if(this.health<=0||this.auras.feign||this.auras.eyes||this.auras.eagleEye)return;
  this.tickWeapons(p,moving);
 }
 restartAutoSwing(){
  this.autoSwingStart=this.time;
  this.nextAuto=this.time+Math.max(0,this.rangedWeaponSpeed/this.rangedHaste()-0.5);
  this.autoRetryAt=null;
 }
 autoTimer(){
  const duration=Math.max(0.5,this.rangedWeaponSpeed/this.rangedHaste());
  if(!this.autoShot)return {phase:'off',progress:0,remaining:0,duration,swingDuration:duration-0.5};
  if(this.autoResetByMelee)return {phase:'waiting',progress:0,remaining:duration,duration,swingDuration:duration-0.5};
  const swingDuration=Math.max(0,this.nextAuto-this.autoSwingStart);
  const cycle=swingDuration+0.5;
  const winding=this.autoWindupStart!==null;
  const ready=winding?this.autoWindupEnd:Math.max(this.nextAuto,this.autoRetryAt??0)+0.5;
  const elapsed=winding?swingDuration+this.time-this.autoWindupStart:Math.min(swingDuration,this.time-this.autoSwingStart);
  return {phase:!this.autoShot?'off':winding?'windup':this.autoRetryAt!==null?'retry':this.time>=this.nextAuto?'ready':'swing',
    progress:this.autoShot?clamp(elapsed/cycle,0,1):0,remaining:Math.max(0,ready-this.time),duration:cycle,swingDuration};
 }
 tickWeapons(player,moving){
    const range=this.distance(player);
    const ranged=this.targetVisible()&&player.targeted!==false&&range>=this.minRangeFor('AutoShot')&&range<=this.rangeFor('AutoShot')&&this.facing(player);
    if(moving&&this.autoWindupStart!==null){
      this.weaving.windupClips++;
      this.autoWindupStart=null;
      this.autoWindupEnd=0;
      this.autoRetryAt=this.time+0.5;
    }
    if(this.autoShot&&this.targetHealth>0&&ranged&&this.autoResetByMelee){
      this.restartAutoSwing();this.autoResetByMelee=false;
    }
    if(!this.autoShot||this.targetHealth<=0||!ranged){
      if(this.autoShot&&this.targetHealth>0&&this.autoWindupStart!==null)this.weaving.windupClips++;
      this.autoWindupStart=null;
      this.autoWindupEnd=0;
    }else if(this.time+1e-8>=Math.max(this.nextAuto,this.autoRetryAt??0)){
      if(moving){this.autoRetryAt=this.time+0.5}
      else if(this.autoWindupStart===null){
        this.autoRetryAt=null;
        this.autoWindupStart=this.time;
        this.autoWindupEnd=this.time+0.5;
      }else if(this.autoWindupStart!==null&&this.time+1e-8>=this.autoWindupEnd){
        const speed=this.rangedWeaponSpeed/this.rangedHaste();
        this.autoDelay=this.expectedAutoShotAt===null?0:Math.max(0,this.time-this.expectedAutoShotAt);
        this.weaving.shot(this.time,this.expectedAutoShotAt,this.lastAutoShot);
        this.lastAutoShot=this.time;
        this.autoSwingStart=this.time;
        this.expectedAutoShotAt=this.time+Math.max(0.5,speed);
        this.nextAuto=this.time+Math.max(0,speed-0.5);
        this.autoWindupStart=null;
        this.autoWindupEnd=0;
        this.projectiles.push({id:'AutoShot',at:this.time+range/SPELLS.AutoShot.speed});
        this.log('Auto Shot fired','shot');
        this.visualEvents.push({type:'shoot',id:'AutoShot'});
      }
    }
    if(!this.cast&&this.facing(player)&&player.targeted!==false&&range<=this.rangeFor('RaptorStrike')&&this.targetHealth>0&&this.time>=this.nextMelee){
      this.weaving.melee();
      this.previousMelee=this.time;
      this.nextMelee=this.time+2.4/this.meleeHaste();
      this.autoWindupStart=null;
      this.autoWindupEnd=0;
      this.autoResetByMelee=true;
      this.nextAuto=Infinity;
      this.autoRetryAt=null;
      const id=this.raptorQueued&&this.mana>=this.manaCost('RaptorStrike')&&this.time>=(this.cooldowns.RaptorStrike||0)?'RaptorStrike':'Melee';
      if(id==='RaptorStrike'){this.spend(id);this.cooldowns[id]=this.time+SPELLS[id].cooldownMs/1000;this.cooldownDurations[id]=SPELLS[id].cooldownMs/1000;this.raptorQueued=false}
      this.visualEvents.push({type:'melee',id});
      if(id==='Melee')this.rollDamage(this.meleeDamage()*this.damageMultiplier('Melee Swing'),'Melee Swing');else this.resolve(id);
    }
    if(this.options.dualWield&&!this.cast&&player.targeted!==false&&this.facing(player)&&range<=this.rangeFor('RaptorStrike')&&this.targetHealth>0&&this.time>=this.nextOffhand){
      this.nextOffhand=this.time+2.4/this.meleeHaste();
      this.rollDamage(this.meleeDamage()*.5*(1+this.pct('predatorsEdge',1))*this.damageMultiplier('Offhand'),'Offhand');
    }
  }
}
