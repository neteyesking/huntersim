import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
const p=z=>({x:0,z,yaw:Math.PI,targeted:true});
test('Raptor can queue two yards beyond melee reach without extending other attacks',()=>{
 for(const reach of [1.5,5]){
  const c=new Combat();c.options.targetCombatReach=reach;const melee=c.rangeFor('RaptorStrike'),queue=c.raptorQueueRange();c.talents.striderKick=1;
  assert.equal(queue,melee+2);assert.equal(c.abilityState('RaptorStrike',p(queue)).usable,true);assert.equal(c.abilityState('RaptorStrike',p(queue)).queueOnly,true);
  assert.equal(c.abilityState('RaptorStrike',p(queue+.01)).code,'range');assert.equal(c.abilityState('StriderKick',p(melee+.01)).code,'range');
 }
});
test('an early queue waits for actual melee reach and spends mana only on the swing',()=>{
 const c=new Combat(()=>.9);c.time=3;const mana=c.mana;
 assert.equal(c.castSpell('RaptorStrike',p(6.5)),true);assert.equal(c.raptorQueued,true);assert.equal(c.autoShot,true);assert.equal(c.mana,mana);assert.equal(c.cooldowns.RaptorStrike,undefined);
 c.tick(0,p(6.5),true);assert.equal(c.damage,0);assert.equal(c.raptorQueued,true);assert.equal(c.previousMelee,0);
 c.tick(0,p(5.01),true);assert.equal(c.damage,0);assert.equal(c.raptorQueued,true);
 c.tick(0,p(5),true);assert.equal(c.raptorQueued,false);assert.equal(c.autoShot,false);assert.ok(c.damage>0);assert.equal(c.mana,mana-c.manaCost('RaptorStrike'));assert.ok(c.cooldowns.RaptorStrike>c.time);
});
test('an early macro queues Raptor but Kick still requires a press in melee',()=>{
 const c=new Combat(()=>.9);c.time=3;c.talents.striderKick=1;const mana=c.mana;
 assert.equal(c.weaveCombo(p(6.5)),true);assert.equal(c.raptorQueued,true);assert.equal(c.cooldowns.StriderKick,undefined);assert.equal(c.mana,mana);
 c.weaveCombo(p(6.5));assert.equal(c.raptorQueued,true);
 c.tick(0,p(4.5),true);assert.ok(c.cooldowns.RaptorStrike>3);assert.equal(c.cooldowns.StriderKick,undefined);
 c.weaveCombo(p(4.5));assert.ok(c.cooldowns.StriderKick>3);
});
test('early queue respects target, facing, mana and cooldown and remains cancellable',()=>{
 for(const [field,value,reason] of [['mana',0,'mana'],['cooldowns',{RaptorStrike:10},'cooldown'],['health',0,'dead']]){
  const c=new Combat();c[field]=value;assert.equal(c.abilityState('RaptorStrike',p(6.5)).code,reason);assert.equal(c.castSpell('RaptorStrike',p(6.5)),false);
 }
 const c=new Combat();assert.equal(c.abilityState('RaptorStrike',{...p(6.5),targeted:false}).code,'target');assert.equal(c.abilityState('RaptorStrike',{...p(6.5),yaw:0}).code,'facing');
 c.castSpell('RaptorStrike',p(6.5));c.mana=0;assert.equal(c.castSpell('RaptorStrike',p(18)),true);assert.equal(c.raptorQueued,false);
});
