import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {normalizeSlots} from './custom-bar.js';
const near={x:0,z:4,yaw:Math.PI,targeted:true},far={...near,z:18};
function advance(c,n,p=near){for(let i=0;i<n*100;i++)c.tick(.01,p,false)}
test('entering melee stays idle until a melee command, including after restarting ranged',()=>{
 const c=new Combat(()=>.9);c.options.dualWield=true;assert.equal(c.meleeAttack,false);
 advance(c,1,far);advance(c,5);assert.equal(c.autoShot,false);assert.equal(c.previousMelee,0);
 assert.ok(!c.meter.snapshot(c.time).rows.some(r=>['Melee Swing','Offhand'].includes(r.id)));
 assert.equal(c.castSpell('WingClip',near),true);advance(c,5);
 const rows=c.meter.snapshot(c.time).rows;assert.ok(rows.some(r=>r.id==='Melee Swing'));assert.ok(rows.some(r=>r.id==='Offhand'));
 const lastMelee=c.previousMelee;c.setAutoShot(true);advance(c,3,far);assert.equal(c.meleeAttack,false);
 advance(c,3);assert.equal(c.previousMelee,lastMelee);assert.equal(c.autoShot,false);
 assert.equal(c.castSpell('RaptorStrike',{...near,z:6.5}),true);assert.equal(c.meleeAttack,true);
 advance(c,.1);assert.ok(c.previousMelee>lastMelee);assert.ok(c.cooldowns.RaptorStrike>c.time);
 c.reset();assert.equal(c.meleeAttack,false);
});
test('armed melee autos still require range, facing and a living selected target',()=>{
 for(const p of [{...near,targeted:false},{...near,yaw:0},far]){
  const c=new Combat(()=>.9);c.startMelee(near);advance(c,3,p);assert.equal(c.previousMelee,0);assert.equal(c.damage,0);
 }
 const c=new Combat(()=>.9);c.health=0;advance(c,3);assert.equal(c.previousMelee,0);
 const d=new Combat(()=>.9);d.targetHealth=0;advance(d,3);assert.equal(d.previousMelee,0);
});
test('melee entry uses the configured reach and does not stop Auto Shot in the dead zone',()=>{
 const c=new Combat(()=>.9);advance(c,.1,{...far,z:7});assert.equal(c.autoShot,true);
 c.options.targetCombatReach=5;advance(c,.1,{...far,z:7});assert.equal(c.autoShot,false);assert.equal(c.meleeAttack,false);
});
test('valid ranged attacks resume Auto Shot while failed attacks and utility spells leave it off',()=>{
 for(const id of ['ArcaneShot','SerpentSting','MultiShot','Volley']){
  const c=new Combat(()=>.9);advance(c,.1);assert.equal(c.autoShot,false);
  assert.equal(c.castSpell(id,{...far,z:100}),false);assert.equal(c.autoShot,false);
  assert.equal(c.castSpell(id,far),true);assert.equal(c.autoShot,true);assert.equal(c.meleeAttack,false);
 }
 const c=new Combat(()=>.9);advance(c,.1);c.castSpell('HuntersMark',far);assert.equal(c.autoShot,false);
 c.gcdUntil=0;c.mana=0;assert.equal(c.castSpell('ArcaneShot',far),false);assert.equal(c.autoShot,false);
});
test('a ranged ability preserves a running Auto Shot windup',()=>{
 const c=new Combat(()=>.9);advance(c,.1,far);const start=c.autoWindupStart,end=c.autoWindupEnd;
 c.castSpell('MultiShot',far);assert.equal(c.autoWindupStart,start);assert.equal(c.autoWindupEnd,end);
 advance(c,.5,far);assert.ok(c.lastAutoShot!==null);assert.ok(c.cast);
});
test('melee commands stop Auto Shot and returning to ranged requires a manual restart',()=>{
 const c=new Combat(()=>.9);advance(c,1,far);const shot=c.lastAutoShot;c.castSpell('RaptorStrike',near);
 assert.equal(c.autoShot,false);assert.equal(c.meleeAttack,true);advance(c,2);assert.ok(c.previousMelee>0);
 advance(c,5,far);assert.equal(c.lastAutoShot,shot);c.setAutoShot(true);assert.equal(c.meleeAttack,false);assert.equal(c.raptorQueued,false);advance(c,3,far);assert.ok(c.lastAutoShot>shot);
});
test('Raptor plus Kick works while moving without cancelling the queue on repeat',()=>{
 const c=new Combat(()=>.9);c.talents={striderKick:1};c.moving=true;assert.ok(c.weaveCombo(near));
 assert.equal(c.raptorQueued,true);assert.equal(c.meleeAttack,true);assert.equal(c.autoShot,false);const mana=c.mana,cd=c.cooldowns.StriderKick;
 c.weaveCombo(near);assert.equal(c.raptorQueued,true);assert.equal(c.mana,mana);assert.equal(c.cooldowns.StriderKick,cd);
 advance(c,2.5);assert.ok(c.cooldowns.RaptorStrike>0);assert.ok(c.events.some(e=>e.message.includes('Raptor Strike')));assert.ok(c.damage>0);
});
test('macro cannot bypass talent, range, mana or GCD requirements',()=>{
 const c=new Combat(()=>.9);assert.equal(c.weaveCombo(far),false);assert.equal(c.meleeAttack,false);
 assert.ok(c.weaveCombo(near));assert.equal(c.cooldowns.StriderKick,undefined);
 const d=new Combat(()=>.9);d.talents={striderKick:1};d.gcdUntil=10;d.weaveCombo(near);assert.equal(d.raptorQueued,true);assert.equal(d.cooldowns.StriderKick,undefined);
 const dry=new Combat();dry.mana=0;dry.talents={striderKick:1};assert.equal(dry.weaveCombo(near),false);assert.equal(dry.meleeAttack,false);
 assert.deepEqual(normalizeSlots(['MeleeAttack','WeaveCombo']).slice(0,2),[null,'WeaveCombo']);
});
test('damage meter includes periodic and pet damage once, tracks crits, and resets',()=>{
 const c=new Combat(()=>.9);c.time=10;c.rollDamage(100,'AutoShot',{landed:true});c.time=12;c.rollDamage(50,'SerpentSting',{periodic:true});c.rollDamage(25,'Bite',{pet:true,landed:true});
 const m=c.meter.snapshot(14);assert.equal(m.total,c.damage);assert.equal(m.total,175);assert.equal(m.dps,43.75);assert.equal(m.rows.length,3);assert.equal(m.rows.find(r=>r.id==='Bite').owner,'Pet');
 c.rollDamage(10,'AutoShot',{landed:true,guaranteedCrit:true});assert.equal(c.meter.snapshot(14).rows[0].crits,1);assert.equal(c.meter.snapshot(50,false).elapsed,2);
 c.reset();assert.equal(c.meter.snapshot(0).total,0);assert.deepEqual(c.meter.snapshot(0).rows,[]);
});
