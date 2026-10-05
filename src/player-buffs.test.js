import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {playerBuffs} from './player-buffs.js';
const p={x:0,z:18,yaw:Math.PI,targeted:true};

test('buff bar follows aspect changes and filters target effects and expired buffs',()=>{
 const c=new Combat();c.finishSpell('AspectOfTheBeast',p);c.finishSpell('RapidFire',p);c.buff('mark',60);c.buff('flare',20);c.buff('dazed',4);
 assert.deepEqual(playerBuffs(c).map(b=>b.id),['AspectOfTheBeast','rapidFire']);
 c.time=c.auras.rapidFire;assert.deepEqual(playerBuffs(c).map(b=>b.id),['AspectOfTheBeast']);
 c.reset();assert.deepEqual(playerBuffs(c).map(b=>b.id),['AspectOfTheHawk']);
});
test('buff bar reflects proc consumption, remaining duration and sniper charges',()=>{
 const c=new Combat(()=>.9);c.talents={counterattack:1};c.mongooseUntil=5;c.counterUntil=5;c.buff('quickShots',12);c.finishSpell('SniperShot',p);
 assert.equal(playerBuffs(c).find(b=>b.id==='sniper').stacks,3);
 c.resolve('ArcaneShot');assert.equal(playerBuffs(c).find(b=>b.id==='sniper').stacks,2);
 c.resolve('MongooseBite');assert.ok(!playerBuffs(c).some(b=>b.id==='mongooseReady'));
 c.time=5;assert.ok(!playerBuffs(c).some(b=>b.id==='counterReady'));
 assert.equal(playerBuffs(c).find(b=>b.id==='quickShots').remaining,7);
 c.resolve('ArcaneShot');c.resolve('ArcaneShot');assert.ok(!playerBuffs(c).some(b=>b.id==='sniper'));
});
test('pet buffs are labelled and disappear when the pet is inactive',()=>{
 const c=new Combat();c.summonPet(p);c.buff('bestialWrath',18);c.pet.frenzyUntil=8;
 const pet=playerBuffs(c).filter(b=>b.owner==='Pet');assert.deepEqual(pet.map(b=>b.name),['Bestial Wrath','Frenzy']);
 c.pet.active=false;assert.equal(playerBuffs(c).filter(b=>b.owner==='Pet').length,0);
});
test('render snapshots cannot change authoritative combat timers',()=>{
 const c=new Combat();c.buff('resourceful',30);const original={...c.auras};const a=playerBuffs(c);a[1].remaining=0;
 assert.deepEqual(c.auras,original);assert.equal(playerBuffs(c)[1].remaining,30);
});
