import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {normalizeSlots} from './custom-bar.js';
const near={x:0,z:4,yaw:Math.PI,targeted:true},far={...near,z:18};
function advance(c,n,p=near){for(let i=0;i<n*100;i++)c.tick(.01,p,false)}
test('walking into melee does not activate either weapon, including offhand',()=>{
 const c=new Combat(()=>.9);c.options.dualWield=true;advance(c,5);
 assert.equal(c.previousMelee,0);assert.equal(c.damage,0);assert.equal(c.meleeAttack,false);
 c.toggleMelee(near);assert.equal(c.autoShot,false);advance(c,.1);assert.ok(c.damage>0);
 c.toggleMelee(near);const damage=c.damage;advance(c,5);assert.equal(c.damage,damage);
});
test('melee commands stop Auto Shot and returning to ranged requires a manual restart',()=>{
 const c=new Combat(()=>.9);advance(c,1,far);const shot=c.lastAutoShot;c.castSpell('RaptorStrike',near);
 assert.equal(c.autoShot,false);assert.equal(c.meleeAttack,true);advance(c,2);assert.ok(c.previousMelee>0);
 advance(c,5,far);assert.equal(c.lastAutoShot,shot);c.setAutoShot(true);assert.equal(c.meleeAttack,false);assert.equal(c.raptorQueued,false);advance(c,3,far);assert.ok(c.lastAutoShot>shot);
});
test('Raptor plus Kick queues and casts through normal rules without cancelling the queue on repeat',()=>{
 const c=new Combat(()=>.9);c.talents={striderKick:1};assert.ok(c.weaveCombo(near));
 assert.equal(c.raptorQueued,true);assert.equal(c.meleeAttack,true);assert.equal(c.autoShot,false);const mana=c.mana,cd=c.cooldowns.StriderKick;
 c.weaveCombo(near);assert.equal(c.raptorQueued,true);assert.equal(c.mana,mana);assert.equal(c.cooldowns.StriderKick,cd);
 advance(c,2.5);assert.ok(c.cooldowns.RaptorStrike>0);assert.ok(c.events.some(e=>e.message.includes('Raptor Strike')));assert.ok(c.damage>0);
});
test('macro cannot bypass talent, range, mana or GCD requirements',()=>{
 const c=new Combat(()=>.9);assert.equal(c.weaveCombo(far),false);assert.equal(c.meleeAttack,false);
 assert.ok(c.weaveCombo(near));assert.equal(c.cooldowns.StriderKick,undefined);
 const d=new Combat(()=>.9);d.talents={striderKick:1};d.gcdUntil=10;d.weaveCombo(near);assert.equal(d.raptorQueued,true);assert.equal(d.cooldowns.StriderKick,undefined);
 const dry=new Combat();dry.mana=0;dry.talents={striderKick:1};assert.equal(dry.weaveCombo(near),false);assert.equal(dry.meleeAttack,false);
 assert.deepEqual(normalizeSlots(['MeleeAttack','WeaveCombo']).slice(0,2),['MeleeAttack','WeaveCombo']);
});
test('damage meter includes periodic and pet damage once, tracks crits, and resets',()=>{
 const c=new Combat(()=>.9);c.time=10;c.rollDamage(100,'AutoShot',{landed:true});c.time=12;c.rollDamage(50,'SerpentSting',{periodic:true});c.rollDamage(25,'Bite',{pet:true,landed:true});
 const m=c.meter.snapshot(14);assert.equal(m.total,c.damage);assert.equal(m.total,175);assert.equal(m.dps,43.75);assert.equal(m.rows.length,3);assert.equal(m.rows.find(r=>r.id==='Bite').owner,'Pet');
 c.rollDamage(10,'AutoShot',{landed:true,guaranteedCrit:true});assert.equal(c.meter.snapshot(14).rows[0].crits,1);assert.equal(c.meter.snapshot(50,false).elapsed,2);
 c.reset();assert.equal(c.meter.snapshot(0).total,0);assert.deepEqual(c.meter.snapshot(0).rows,[]);
});
