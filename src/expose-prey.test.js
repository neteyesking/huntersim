import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {SV_WEAVE} from './presets.js';
import {playerBuffs} from './player-buffs.js';
const near={x:0,z:4,yaw:Math.PI,targeted:true},far={...near,z:18};
function marked(rank=2,roll=.09){const c=new Combat(()=>roll);c.talents={exposePrey:rank};c.finishSpell('HuntersMark',far);return c}
test('SV Weave includes both Expose Prey ranks and marked attacks open a five second window',()=>{
 assert.equal(SV_WEAVE.exposePrey,2);
 for(const id of ['AutoShot','ArcaneShot','RaptorStrike','Melee Swing','Offhand','SummonHawk']){
  const c=marked();c.time=2;c.rollDamage(100,id,{landed:true});
  assert.equal(c.mongooseUntil,7,id);assert.equal(c.abilityState('MongooseBite',near).usable,true,id);
  assert.equal(c.abilityState('MongooseBite',far).code,'range');assert.equal(c.abilityState('MongooseBite',far).procRemaining,5);
  assert.ok(c.events.some(e=>e.message.includes('Expose Prey')));
  assert.equal(playerBuffs(c).find(b=>b.id==='mongooseReady').name,'Expose Prey · Mongoose Bite');
 }
});
test('Expose Prey chance is five or ten percent and requires an active mark and eligible damage',()=>{
 for(const [rank,roll,proc] of [[0,0,false],[1,.049,true],[1,.05,false],[2,.099,true],[2,.1,false]]){
  const c=marked(rank,roll);c.rollDamage(100,'AutoShot',{landed:true});assert.equal(c.mongooseUntil>0,proc);
 }
 for(const flag of ['unmarked','expired','miss','periodic','pet','guardian','trap','zero']){
  const c=marked();if(flag==='unmarked')delete c.auras.mark;if(flag==='expired')c.auras.mark=c.time;if(flag==='miss')c.random=()=>0;
  c.rollDamage(flag==='zero'?0:100,flag==='trap'?'ExplosiveTrap':'AutoShot',{landed:flag!=='miss',periodic:flag==='periodic',pet:flag==='pet',guardian:flag==='guardian'});
  assert.equal(c.mongooseUntil,0,flag);
 }
});
test('Expose Prey refreshes, expires, and is consumed by Mongoose Bite without bypassing lockouts',()=>{
 const c=marked();c.rollDamage(100,'AutoShot',{landed:true});c.time=3;c.rollDamage(100,'AutoShot',{landed:true});assert.equal(c.mongooseUntil,8);
 c.gcdUntil=4;assert.equal(c.abilityState('MongooseBite',near).code,'gcd');assert.equal(c.abilityState('MongooseBite',near).procRemaining,5);
 c.time=4;c.mana=0;assert.equal(c.abilityState('MongooseBite',near).code,'mana');c.mana=3000;
 c.nextMelee=c.time+2;assert.equal(c.castSpell('MongooseBite',near),true);c.tick(.01,near,false);assert.equal(c.mongooseUntil,0);assert.ok(!playerBuffs(c).some(b=>b.id==='mongooseReady'));
 const d=marked();d.rollDamage(100,'AutoShot',{landed:true});d.time=5;assert.equal(d.abilityState('MongooseBite',near).procRemaining,0);assert.equal(d.abilityState('MongooseBite',near).code,'proc');
});
