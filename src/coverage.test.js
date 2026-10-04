import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat,SPELLS,ACTIONS,TREES} from './combat.js';
import {PET_FAMILIES,TALENTS,TALENT_GATES,changeTalent,validTalents,talentValue} from './catalog.js';
import {DEFAULT_BINDINGS} from './bindings.js';
const ranged={x:0,z:18,yaw:Math.PI,targeted:true};
const melee={...ranged,z:3};
function advance(c,seconds,p=ranged){for(let i=0;i<Math.ceil(seconds/.05);i++)c.tick(.05,p,false)}
function quiet(random=()=>.9){const c=new Combat(random);c.autoShot=false;c.nextMelee=Infinity;return c}
test('every exported ability has a usable handler and keybinding entry',()=>{
 for(const id of Object.keys(SPELLS)){
  const c=quiet();c.mana=c.maxMana=100000;c.talents=Object.fromEntries(Object.entries(TALENTS).map(([k,t])=>[k,t.max]));
  c.options.targetType='Beast';c.mongooseUntil=c.counterUntil=100;
  c.summonPet(ranged);
  if(id==='CallPet'||id==='TameBeast')c.pet=null;
  if(id==='RevivePet')c.pet.health=0;
  const p=SPELLS[id].minRange>=8?ranged:melee;
  assert.equal(c.castSpell(id,p),true,id);
  advance(c,22,p);
  if(id!=='AutoShot')assert.ok('spell:'+id in DEFAULT_BINDINGS,id+' keybind');
 }
});
test('talent tree validates prerequisites, lower tiers, budget and refunds',()=>{
 assert.equal(Object.keys(TALENTS).length,51);
 assert.equal(changeTalent({},'sniperShot',1),null);
 let ranks={};for(let i=0;i<5;i++)ranks=changeTalent(ranks,'deadlyAspects',1);
 assert.ok(validTalents(ranks));
 ranks=changeTalent(ranks,'improvedAspectOfTheMonkey',1);assert.ok(ranks);
 assert.equal(changeTalent(ranks,'deadlyAspects',-1),null);
 assert.equal(validTalents({efficiency:6}),false);
 assert.equal(validTalents({invented:1}),false);
 const all=Object.fromEntries(Object.entries(TALENTS).map(([k,t])=>[k,t.max]));
 assert.equal(validTalents(all),false);
 assert.equal(talentValue({barrage:2},'barrage'),7);
 assert.equal(talentValue({ferocity:5},'ferocity'),10);
 assert.equal(talentValue({resourcefulness:2},'resourcefulness'),-60);
});
test('cost and cooldown talent modifiers apply only to their spell families',()=>{
 const c=quiet();c.talents={efficiency:5,resourcefulness:2,improvedArcaneShot:5,rapidKilling:2,improvedStings:3,survivalistsDiscipline:2};
 assert.equal(c.manaCost('ArcaneShot'),162);
 assert.equal(c.manaCost('RaptorStrike'),34);
 assert.equal(c.manaCost('FreezingTrap'),40);
 assert.equal(c.manaCost('RapidFire'),100);
 assert.equal(c.cooldown('ArcaneShot'),4.5);
 assert.equal(c.cooldown('RapidFire'),180);
 assert.equal(c.cooldown('ViperSting'),9);
 assert.equal(c.cooldown('Deterrence'),180);
 assert.equal(c.cooldown('FreezingTrap'),18);
});
test('off-GCD abilities neither wait for nor replace the GCD',()=>{
 const c=quiet();c.castSpell('ArcaneShot',ranged);const until=c.gcdUntil;
 assert.equal(c.castSpell('RapidFire',ranged),true);assert.equal(c.gcdUntil,until);
 assert.equal(c.castSpell('SerpentSting',ranged),false);
});
test('Hawk Eye does not extend melee, Mark, or pet commands',()=>{
 const c=quiet(),mark=c.rangeFor('HuntersMark');c.talents={hawkEye:3};
 assert.equal(c.rangeFor('ArcaneShot'),44);assert.equal(c.rangeFor('RaptorStrike'),5);assert.equal(c.rangeFor('HuntersMark'),mark);
});
test('periodic Serpent damage cannot miss or crit and includes its final tick',()=>{
 const c=quiet();c.resolve('SerpentSting');c.random=()=>0;
 advance(c,15.1);const hits=c.textEvents.filter(e=>e.id==='SerpentSting');
 assert.equal(hits.length,5);assert.ok(hits.every(e=>e.kind==='damage'));assert.equal(c.sting,null);
});
test('sting replacement stops old ticks and Viper drains target mana',()=>{
 const c=quiet();c.resolve('SerpentSting');c.resolve('ViperSting');advance(c,8.1);
 assert.equal(c.textEvents.length,0);assert.equal(c.targetMana,3000-4*277);
});
test('Mongoose consumes its trigger and Lacerating Strikes snapshots landed damage',()=>{
 const c=quiet();c.talents={laceratingStrikes:1};c.mongooseUntil=5;c.resolve('MongooseBite');
 const bite=c.damage;c.random=()=>0;advance(c,21.1);
 assert.equal(c.mongooseUntil,0);assert.equal(c.damage-bite,7*Math.floor(bite*.4/7));
});
test('Sniper range charges are retained on misses and spent on landed shots',()=>{
 const c=quiet();c.finishSpell('SniperShot',ranged);assert.equal(c.auras.sniperCharges,3);
 c.random=()=>0;c.resolve('ArcaneShot');assert.equal(c.auras.sniperCharges,3);
 c.random=()=>.9;c.resolve('ArcaneShot');assert.equal(c.auras.sniperCharges,2);
});
test('Arcane and Summon Hawk share cooldown; guardians are capped at two',()=>{
 const c=quiet();c.talents={summonHawk:1,improvedArcaneShot:5};
 c.castSpell('ArcaneShot',ranged);assert.equal(c.cooldowns.SummonHawk,4.5);
 c.time=6;c.castSpell('SummonHawk',ranged);assert.equal(c.cooldowns.ArcaneShot,12);
 c.resolve('SummonHawk');c.resolve('SummonHawk');c.resolve('SummonHawk');assert.equal(c.hawks.length,2);
});
test('trap arming, shared cooldown, Entrapment and Clever Traps work together',()=>{
 const c=quiet();c.talents={entrapment:5,cleverTraps:2,survivalistsDiscipline:2};
 c.castSpell('FreezingTrap',melee);
 assert.equal(c.cooldowns.ExplosiveTrap,18);
 advance(c,1.9,melee);assert.equal(c.debuffs.freeze,undefined);
 advance(c,.2,melee);assert.ok(c.debuffs.freeze>27);assert.ok(c.debuffs.root>6);
 c.rollDamage(10,'AutoShot',{landed:true});assert.equal(c.debuffs.freeze,undefined);
});
test('channels tick during casting and movement stops subsequent ticks',()=>{
 const c=quiet();c.castSpell('Volley',ranged);advance(c,2.1);assert.equal(c.damage,224);
 c.tick(.05,ranged,true);assert.equal(c.cast,null);advance(c,5);assert.equal(c.damage,224);
 const mend=quiet();mend.summonPet(ranged);mend.pet.health=100;mend.castSpell('MendPet',ranged);advance(mend,5.1);assert.equal(mend.pet.health,1325);
});
test('pet talent bonuses, focus regeneration and Lone Wolf respond to pet presence',()=>{
 const c=quiet();c.talents={loneWolf:1,focusedFire:2,enduranceTraining:5,bestialDiscipline:2};
 assert.equal(c.damageMultiplier('ArcaneShot'),1.2);c.summonPet(ranged);
 assert.equal(c.damageMultiplier('ArcaneShot'),1.02);assert.ok(c.pet.maxHealth>2200);
 c.pet.focus=0;advance(c,2);assert.ok(Math.abs(c.pet.focus-12)<1e-6);
 c.pet.health=0;assert.equal(c.damageMultiplier('ArcaneShot'),1.2);
});
test('all nineteen pet families can approach and damage the target',()=>{
 for(const family of Object.keys(PET_FAMILIES)){
  const c=quiet();c.petFamily=family;c.summonPet(ranged);c.petCommand('attack');advance(c,15);
  assert.ok(c.damage>0,family);assert.ok(c.pet.focus>=0&&c.pet.focus<=100,family);
 }
});
test('pet crits trigger Frenzy and Intimidation waits for a landed attack',()=>{
 const c=quiet(()=>.1);c.talents={frenzy:5,intimidation:1};c.summonPet(melee);c.pet.autocast=false;c.petCommand('attack');c.buff('intimidation',15);
 advance(c,.1,melee);assert.ok(c.pet.frenzyUntil>0);assert.ok(c.debuffs.stun>0);assert.equal(c.auras.intimidation,undefined);
});
test('dodge and parry enable different reactive abilities',()=>{
 const c=quiet(()=>.1);c.options.sparring=true;c.aspect='AspectOfTheMonkey';c.incoming(melee);assert.ok(c.mongooseUntil>0);
 c.aspect='AspectOfTheHawk';c.random=()=>.13;c.incoming(melee);assert.ok(c.counterUntil>0);
 c.talents={counterattack:1};assert.equal(c.canCast('Counterattack',melee,true),true);
});
test('aspect speed talents leave jump physics separate; Wild mitigates nature damage',()=>{
 const c=quiet();c.aspect='AspectOfTheCheetah';c.talents={pathfinding:2};
 assert.ok(Math.abs(c.movementMultiplier()-1.36)<1e-9);
 c.aspect='AspectOfTheWild';c.receiveNatureDamage(300);assert.ok(c.health>3700);
});
test('tracking bonus needs matching type; Careful Aim and Lightning Reflexes change stats',()=>{
 const c=quiet();c.talents={improvedTracking:5,carefulAim:5,lightningReflexes:5};
 assert.equal(c.damageMultiplier('ArcaneShot'),1.05);
 c.options.targetType='Beast';assert.equal(c.damageMultiplier('ArcaneShot'),1);
 assert.ok(Math.abs(c.stats().agi-230)<1e-9);assert.equal(c.stats().melee,580);
});
test('Rapid Recuperation and Resourcefulness enable regeneration inside five-second rule',()=>{
 const c=quiet();c.talents={rapidRecuperation:2};c.resolve('SerpentSting');c.lastSpend=0;c.mana=1000;
 advance(c,1);assert.ok(Math.abs(c.mana-1011)<1e-6);
 const resource=quiet(()=>.1);resource.talents={resourcefulness:2};resource.resolve('ArcaneShot');assert.ok(resource.auras.resourceful);
});
test('self buffs work without a target and each active talent spell is gated',()=>{
 for(const [id,talent] of Object.entries(TALENT_GATES)){
  const c=quiet();assert.equal(c.canCast(id,melee,true),false,id);
 }
 const c=quiet();assert.equal(c.castSpell('AspectOfTheMonkey',{...ranged,targeted:false}),true);
});
test('melee requires facing the target',()=>{
 const m=quiet();m.nextMelee=0;advance(m,3,{...melee,yaw:0});assert.equal(m.damage,0);
});

test('Revive and Mend Pet talents change cast, cost, restored health and cleanse',()=>{
 const c=quiet();c.talents={improvedRevivePet:2,improvedMendPet:2};c.summonPet(ranged);c.pet.health=0;
 assert.equal(c.manaCost('RevivePet'),1800);c.castSpell('RevivePet',ranged);assert.equal(c.cast.duration,4);
 advance(c,4.1);assert.ok(Math.abs(c.pet.health/c.pet.maxHealth-.45)<1e-9);
 c.pet.debuff='Poison';c.pet.nextPoison=100;c.mana=3000;c.random=()=>.1;c.castSpell('MendPet',ranged);
 assert.equal(c.manaCost('MendPet'),384);advance(c,1.1);assert.equal(c.pet.debuff,undefined);
});
test('Spirit Bond heals both units at its ranked interval',()=>{
 const c=quiet();c.talents={spiritBond:2};c.summonPet(ranged);c.pet.health=100;c.health=100;
 advance(c,5.1);assert.equal(c.health,140);assert.ok(c.pet.health>120);
});
test('Bestial Wrath releases pet control and rejects new control without cleansing poison',()=>{
 const c=quiet();c.talents={bestialWrath:1};c.summonPet(ranged);c.pet.debuff='Poison';
 assert.equal(c.applyPetControl(5),true);c.castSpell('BestialWrath',ranged);
 assert.equal(c.pet.controlUntil,0);assert.equal(c.applyPetControl(5),false);assert.equal(c.pet.debuff,'Poison');
 assert.ok(c.petDamageMultiplier()>1.8);
});
test('pet disarm, armor reduction, poison stacks and threat abilities have distinct effects',()=>{
 const c=quiet();c.petFamily='BirdOfPrey';c.summonPet(melee);c.pet.x=1;c.pet.z=1;
 c.petAbility('MineTriggered');assert.ok(c.debuffs.disarm);assert.equal(c.dots['Pet Mine'],undefined);
 c.time=5;c.pet.focus=100;c.petAbility('GrowlTriggered');assert.ok(c.petThreat>=415);
 const threat=c.petThreat;c.time=10;c.pet.focus=100;c.petAbility('CowerTriggered');assert.equal(c.petThreat,threat-225);
 const poison=quiet();poison.petFamily='Scorpid';poison.summonPet(melee);poison.pet.x=1;poison.pet.z=1;
 poison.petAbility('ScorpidPoisonTriggered');poison.time=4;poison.pet.focus=100;poison.petAbility('ScorpidPoisonTriggered');
 assert.equal(poison.dots['Scorpid Poison'].stacks,2);
});
test('Mortal Shots and Predator Edge enhance their respective crits only',()=>{
 const c=quiet(()=>.1);c.talents={mortalShots:5,predatorsEdge:5};
 assert.equal(c.rollDamage(100,'AutoShot',{landed:true}),230);
 assert.equal(c.rollDamage(100,'Melee Swing',{landed:true}),230);
 c.talents={mortalShots:5};assert.equal(c.rollDamage(100,'Melee Swing',{landed:true}),200);
 c.talents={predatorsEdge:5};assert.equal(c.rollDamage(100,'AutoShot',{landed:true}),200);
});
test('tracking, flare and tranquilizing shot operate on training target state',()=>{
 const c=quiet();c.options.hidden=true;assert.equal(c.canCast('ArcaneShot',ranged,true),false);
 c.finishSpell('Flare',ranged);assert.equal(c.canCast('ArcaneShot',ranged,true),true);
 c.options.enraged=true;c.resolve('TranquilizingShot');assert.equal(c.options.enraged,false);
});
test('kill proc survives target restoration and is consumed by the next shot',()=>{
 const c=quiet();c.talents={rapidKilling:2,rapidRecuperation:2};c.targetHealth=1;c.resolve('ArcaneShot');
 assert.ok(c.auras.rapidKilling);c.respawnTarget();c.resolve('AimedShot');
 assert.equal(c.auras.rapidKilling,undefined);assert.ok(c.auras.killingRegen);
});
