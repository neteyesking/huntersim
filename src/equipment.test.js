import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {normalizeLoadout,weaponDamage,armorMultiplier} from './equipment.js';
import {physicalTable,rollPhysical,parryHastedSwing} from './attack-table.js';
import {normalizeSettings,normalizeSetup} from './settings.js';
const near={x:0,z:4,yaw:Math.PI,targeted:true};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('equipment validates corrupt saves and retains separate inactive weapon profiles',()=>{
 const l=normalizeLoadout({mode:'dualWield',stats:{hit:Infinity,crit:-5},ranged:{speed:0,min:500,max:100},twoHand:{speed:3.6},offHand:{speed:1.4}});
 assert.equal(l.stats.hit,0);assert.equal(l.stats.crit,0);assert.equal(l.ranged.speed,.5);assert.equal(l.ranged.min,100);assert.equal(l.ranged.max,500);assert.equal(l.twoHand.speed,3.6);
 const setup=normalizeSetup({settings:{loadout:l}});assert.deepEqual(setup.settings.loadout,l);assert.equal(setup.settings.training.dualWield,true);
 assert.equal(normalizeSettings({training:{dualWield:true}}).loadout.mode,'dualWield');
});
test('weapon damage uses tooltip range, actual speed, AP and separate ranged ammo',()=>{
 close(weaponDamage({min:100,max:200,speed:3},140,.5),180);
 const c=new Combat(()=>.5,{loadout:{stats:{rangedAP:140,meleeAP:140,ammoDps:10},ranged:{min:100,max:200,speed:3},twoHand:{min:200,max:200,speed:3.6}}});c.aspect='AspectOfTheMonkey';
 close(c.weaponDamage(),210);close(c.meleeDamage(),236);close(c.meleeDamage(false,true),233);
 c.configureLoadout({...c.loadout,mode:'dualWield',mainHand:{min:100,max:100,speed:2,dagger:true}});close(c.meleeDamage(false,true),117);
});
test('offhand timer and damage are independent and cannot consume queued Raptor',()=>{
 const c=new Combat(()=>.9,{loadout:{mode:'dualWield',stats:{meleeAP:0,crit:0,hit:100},mainHand:{min:100,max:100,speed:3},offHand:{min:80,max:80,speed:1}}});c.aspect='AspectOfTheMonkey';c.time=1;
 assert.equal(c.castSpell('RaptorStrike',near),true);c.tickWeapons(near,false);
 assert.equal(c.raptorQueued,true);assert.equal(c.nextMelee,3);assert.equal(c.nextOffhand,2);assert.equal(c.damage,40);assert.equal(c.cooldowns.RaptorStrike,undefined);
 c.time=3;c.tickWeapons(near,false);assert.equal(c.raptorQueued,false);assert.equal(c.nextMelee,6);assert.equal(c.nextOffhand,4);assert.ok(c.cooldowns.RaptorStrike>3);
 const rows=c.meter.snapshot(c.time).rows;assert.equal(rows.find(r=>r.id==='RaptorStrike').hits,1);
 assert.ok(c.visualEvents.some(e=>e.type==='offhand'));
});
test('offhand damage penalty and Predator’s Edge use only the offhand weapon',()=>{
 const c=new Combat(()=>.9,{loadout:{mode:'dualWield',stats:{meleeAP:0,crit:0,hit:100},offHand:{min:80,max:80,speed:1}}});c.talents.predatorsEdge=5;c.startMelee(near);c.time=1;c.tickWeapons(near,false);assert.equal(c.damage,60);
});
test('dual-wield miss penalty is white only and Raptor never glances',()=>{
 const c=new Combat(()=>.2,{loadout:{mode:'dualWield',stats:{crit:0}}});
 close(c.attackTable('Melee Swing').miss,.27);close(c.attackTable('Offhand').miss,.27);close(c.attackTable('RaptorStrike').miss,.08);close(c.attackTable('AutoShot').miss,.08);
 assert.equal(c.attackTable('RaptorStrike').glance,0);assert.equal(c.attackTable('AutoShot').dodge,0);
 assert.equal(c.physicalOutcome('Melee Swing').kind,'miss');
});
test('NPC dodge applies behind while parry and block require the front',()=>{
 const front=physicalTable({front:true,canBlock:true}),back=physicalTable({front:false,canBlock:true});
 close(front.dodge,.065);close(front.parry,.14);close(front.block,.05);assert.equal(back.parry,0);assert.equal(back.block,0);close(back.dodge,.065);
 const capped=physicalTable({expertise:26,hit:.09});close(capped.dodge,0);close(capped.miss,0);
 assert.equal(rollPhysical(back,()=>.1).kind,'dodge');
});
test('white rolls use one table with glancing ahead of crit; specials use separate crit rolls',()=>{
 const table=physicalTable({level:63,white:true,crit:1});let calls=0;
 const result=rollPhysical(table,()=>{calls++;return .2},true);assert.equal(result.kind,'glance');assert.equal(result.crit,false);close(result.multiplier,.75);assert.equal(calls,1);
 const special=rollPhysical(physicalTable({crit:1}),()=>.9);assert.equal(special.crit,true);
});
test('a dodged Raptor spends the queued swing and opens the Mongoose window',()=>{
 const c=new Combat(()=>.1);c.time=3;c.castSpell('RaptorStrike',near);c.tickWeapons(near,false);
 assert.equal(c.damage,0);assert.equal(c.raptorQueued,false);assert.ok(c.cooldowns.RaptorStrike>3);assert.equal(c.mongooseSource,'Target dodge');assert.equal(c.mongooseUntil,8);assert.equal(c.outcomes.dodge,1);
});
test('incoming dodge and parry open reactive windows; armor reduces landed damage',()=>{
 const dodge=new Combat(()=>.1,{loadout:{target:{level:60},stats:{dodge:20}}});dodge.options.sparring=true;dodge.incoming(near);assert.equal(dodge.mongooseSource,'Dodge');assert.equal(dodge.health,dodge.maxHealth);
 const parry=new Combat(()=>.1,{loadout:{target:{level:60},stats:{dodge:0,parry:20}}});parry.options.sparring=true;parry.incoming(near);assert.equal(parry.counterUntil,5);close(parry.nextMelee,1.44);
 const c=new Combat(()=>.9,{loadout:{target:{level:60,damage:100},stats:{armor:5500}}});c.options.sparring=true;c.incoming(near);close(c.maxHealth-c.health,50);
 close(armorMultiplier(5500),.5);close(parryHastedSwing(0,.3,2.4),.3);
});
test('combat reset keeps configured weapon speeds and restores configured resources',()=>{
 const c=new Combat(()=>.9,{loadout:{stats:{health:5000,mana:4200},twoHand:{speed:3.5},offHand:{speed:1.3}}});c.health=1;c.mana=0;c.reset();assert.equal(c.health,5000);assert.equal(c.mana,4200);assert.equal(c.nextMelee,3.5);assert.equal(c.nextOffhand,1.3);assert.equal(c.meleeAttack,false);
});
test('front and rear positions change actual Raptor outcomes and optional target parry haste',()=>{
 const c=new Combat(()=>.2,{loadout:{target:{parryHaste:true}}});c.tick(0,near,false);assert.equal(c.physicalOutcome('RaptorStrike').kind,'parry');close(c.nextIncoming,1.2);
 c.tick(0,{...near,z:-4,yaw:0},false);assert.equal(c.physicalOutcome('RaptorStrike').kind,'hit');
});
test('block and glancing damage reduce physical damage without a second crit roll',()=>{
 const c=new Combat(()=>.9,{loadout:{target:{blockValue:30}}});
 assert.equal(c.rollDamage(100,'Melee Swing',{landed:true,outcome:{kind:'block',crit:false,multiplier:1}}),70);
 assert.equal(c.rollDamage(100,'Melee Swing',{landed:true,outcome:{kind:'glance',crit:false,multiplier:.75}}),75);
});
test('normalized ranged attacks use 2.8 AP speed while Auto Shot uses actual weapon speed',()=>{
 const c=new Combat(()=>.5,{loadout:{stats:{rangedAP:140,ammoDps:0},ranged:{min:100,max:100,speed:4}}});c.aspect='AspectOfTheMonkey';close(c.weaponDamage(),140);close(c.weaponDamage(true),128);
});
test('ranged block can combine with crit, while Raptor block precedes its crit roll',()=>{
 let rolls=[.1,.01];const ranged=rollPhysical(physicalTable({ranged:true,front:true,canBlock:true,crit:1}),()=>rolls.shift(),false,true);assert.equal(ranged.kind,'block');assert.equal(ranged.crit,true);
 const raptor=rollPhysical(physicalTable({front:true,canBlock:true,crit:1}),()=>.3);assert.equal(raptor.kind,'block');assert.equal(raptor.crit,false);
});
