import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat, SPELLS, TREES} from './combat.js';

const player={x:0,z:18,yaw:Math.PI};
function step(combat,seconds,moving=false){for(let t=0;t<seconds;t+=0.05)combat.tick(0.05,player,moving)}
test('Hunter spell and talent data is extracted from Forever',()=>{
  assert.equal(SPELLS.AutoShot.minRange,8);
  assert.equal(SPELLS.AutoShot.maxRange,35);
  assert.equal(SPELLS.AimedShot.cooldownMs,6000);
  assert.equal(TREES.length,3);
});
test('ranged dead zone, facing, and melee reach are enforced',()=>{
  const combat=new Combat(()=>0.9);
  assert.equal(combat.canCast('ArcaneShot',player,true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:7},true),false);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:7},true),false);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:4},true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,yaw:0},true),false);
});
test('Auto Shot starts at eight yards between body centers',()=>{
  const combat=new Combat(()=>0.9);
  assert.equal(combat.minRangeFor('AutoShot'),8);
  assert.equal(combat.rangeFor('AutoShot'),38);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:7.99},true),false);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:8},true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:38},true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:38.1},true),false);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:5},true),true);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:5.1},true),false);  const below=new Combat(()=>0.9),atEdge=new Combat(()=>0.9);
  for(let i=0;i<68;i++){
    below.tick(0.05,{...player,z:7.99},false);
    atEdge.tick(0.05,{...player,z:8},false);
  }
  assert.equal(below.events.some(e=>e.message==='Auto Shot fired'),false);
  assert.equal(atEdge.events.some(e=>e.message==='Auto Shot fired'),true);
});
test('Aimed Shot shares its six second cooldown with Multi-Shot',()=>{
  const combat=new Combat(()=>0.9);
  assert.equal(combat.castSpell('AimedShot',player),true);
  assert.equal(combat.cooldowns.AimedShot,combat.cooldowns.MultiShot);
  combat.interrupt();
  step(combat,1.6);
  assert.equal(combat.canCast('MultiShot',player,true),false);
});
test('movement interrupts a cast and sting slots replace one another',()=>{
  const combat=new Combat(()=>0.9);
  combat.castSpell('AimedShot',player);
  combat.tick(0.05,player,true);
  assert.equal(combat.cast,null);
  step(combat,1.5);
  combat.castSpell('SerpentSting',player);
  step(combat,1.6);
  assert.equal(combat.sting?.id,'SerpentSting');
  combat.castSpell('ScorpidSting',player);
  step(combat,1.6);
  assert.equal(combat.sting?.id,'ScorpidSting');
});
test('Auto Shot completes the full weapon swing before its half second windup',()=>{
  const combat=new Combat(()=>0.9);
  while(combat.time<2.7)combat.tick(0.05,player,false);
  assert.equal(combat.autoWindupStart,null);
  assert.equal(combat.lastAutoShot,null);
  while(combat.time<2.85)combat.tick(0.05,player,false);
  assert.ok(Math.abs(combat.autoWindupStart-2.8)<0.051);
  assert.ok(Math.abs(combat.autoWindupEnd-combat.autoWindupStart-0.5)<1e-9);
  while(combat.lastAutoShot===null)combat.tick(0.05,player,false);
  const firstShot=combat.lastAutoShot;
  while(combat.time<firstShot+2.7)combat.tick(0.05,player,false);
  assert.equal(combat.autoWindupStart,null);
  while(combat.time<firstShot+2.85)combat.tick(0.05,player,false);
  assert.ok(Math.abs(combat.autoWindupStart-firstShot-2.8)<0.051);
  assert.equal(combat.lastAutoShot,firstShot);
  while(combat.time<firstShot+3.35)combat.tick(0.05,player,false);
  assert.ok(combat.lastAutoShot>firstShot);
  assert.ok(Math.abs(combat.lastAutoShot-firstShot-3.3)<0.06);
});

test('ranged spell casts finish their listed cast before the bow windup',()=>{
  const combat=new Combat(()=>0.9);
  assert.equal(combat.castSpell('AimedShot',player),true);
  assert.equal(combat.cast.spellDuration,2);
  assert.equal(combat.cast.windupStart,2);
  assert.equal(combat.cast.windupDuration,0.5);
  assert.equal(combat.cast.until,2.5);
  while(combat.time<2.05)combat.tick(0.05,player,false);
  assert.ok(combat.cast);
  while(combat.time<2.55)combat.tick(0.05,player,false);
  assert.equal(combat.cast,null);
});
test('movement cancels Auto Shot windup and melee white hits advance their timer',()=>{
  const combat=new Combat(()=>0.9);
  while(combat.time<2.85)combat.tick(0.05,player,false);
  combat.tick(0.05,player,true);
  assert.equal(combat.autoWindupStart,null);
  assert.equal(combat.lastAutoShot,null);
  assert.ok(combat.nextAuto>combat.time);
  const close={...player,z:4};
  while(combat.time<5.5)combat.tick(0.05,close,false);
  assert.ok(combat.previousMelee>0);
  assert.ok(combat.nextMelee>combat.previousMelee);
  assert.ok(combat.events.some(e=>e.message.startsWith('Melee Swing')));
  assert.equal(combat.autoResetByMelee,true);
  combat.tick(0.05,player,false);
  assert.equal(combat.autoResetByMelee,false);
  assert.ok(combat.nextAuto-combat.time>2);
  assert.equal(combat.autoWindupStart,null);
});
test('stationary Auto Shot damages the dummy and movement prevents firing',()=>{
  const combat=new Combat(()=>0.9);
  step(combat,3.1,true);
  assert.equal(combat.damage,0);
  step(combat,3.1,false);
  assert.ok(combat.damage>0);
});

test('damage and misses emit separate floating combat text outcomes',()=>{
  const hit=new Combat(()=>0.9);
  hit.rollDamage(123,'AutoShot');
  assert.deepEqual(hit.textEvents[0],{text:'123',kind:'damage',id:'AutoShot'});
  const miss=new Combat(()=>0);
  miss.rollDamage(123,'ArcaneShot');
  assert.deepEqual(miss.textEvents[0],{text:'Miss',kind:'miss',id:'ArcaneShot'});
  hit.reset();
  assert.equal(hit.textEvents.length,0);
});
test('ranged fire and melee swings emit timed visual cues',()=>{
  const ranged=new Combat(()=>0.9);
  step(ranged,3.4);
  assert.ok(ranged.visualEvents.some(e=>e.type==='shoot'&&e.id==='AutoShot'));
  const melee=new Combat(()=>0.9);
  const close={...player,z:4};
  while(melee.time<2.5)melee.tick(.05,close,false);
  assert.ok(melee.visualEvents.some(e=>e.type==='melee'&&e.id==='Melee'));
});
test('clearing the target blocks attacks while self buffs remain available',()=>{
  const combat=new Combat(()=>0.9);
  const untargeted={...player,targeted:false};
  assert.equal(combat.canCast('ArcaneShot',untargeted,true),false);
  assert.equal(combat.canCast('RaptorStrike',untargeted,true),false);
  assert.equal(combat.canCast('RapidFire',untargeted,true),true);
  for(let i=0;i<80;i++)combat.tick(.05,untargeted,false);
  assert.equal(combat.damage,0);
  assert.equal(combat.lastAutoShot,null);
  const close={...untargeted,z:4};
  for(let i=0;i<80;i++)combat.tick(.05,close,false);
  assert.equal(combat.previousMelee,0);
});
for(const id of ['AimedShot','MultiShot','Volley'])test('Auto Shot starts and fires during '+id,()=>{
 const c=new Combat(()=>.9);
 for(let i=0;i<250;i++)c.tick(.01,player,false);
 assert.equal(c.castSpell(id,player),true);
 const cast=c.cast,until=cast.until;
 for(let i=0;i<35;i++)c.tick(.01,player,false);
 assert.ok(c.autoWindupStart!==null);
 assert.equal(c.cast,cast);
 while(c.lastAutoShot===null)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-3.3)<1e-8);
 assert.equal(c.cast,cast);assert.equal(c.cast.until,until);
 assert.equal(c.weaving.windupClips,0);
 assert.ok(c.projectiles.some(p=>p.id==='AutoShot'));
 while(c.time<until+.01)c.tick(.01,player,false);
 assert.equal(c.cast,null);
});
test('starting a cast during Auto Shot windup preserves its release time',()=>{
 const c=new Combat(()=>.9);
 for(let i=0;i<290;i++)c.tick(.01,player,false);
 const start=c.autoWindupStart,end=c.autoWindupEnd;
 assert.equal(c.castSpell('AimedShot',player),true);
 c.tick(.01,player,false);
 assert.equal(c.autoWindupStart,start);assert.equal(c.autoWindupEnd,end);
 while(c.lastAutoShot===null)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-end)<1e-8);assert.equal(c.cast.id,'AimedShot');
 assert.equal(c.weaving.windupClips,0);
});
test('movement during overlapping cast and Auto Shot windup cancels both',()=>{
 const c=new Combat(()=>.9);
 for(let i=0;i<290;i++)c.tick(.01,player,false);
 assert.equal(c.castSpell('AimedShot',player),true);
 c.tick(.01,player,true);
 assert.equal(c.cast,null);assert.equal(c.autoWindupStart,null);assert.equal(c.lastAutoShot,null);
 assert.equal(c.weaving.windupClips,1);assert.equal(c.autoTimer().progress,0);
});
test('movement before the windup leaves the ranged swing clock running',()=>{
 const c=new Combat(()=>.9);const ready=c.nextAuto;
 for(let i=0;i<200;i++)c.tick(.01,player,true);
 assert.equal(c.nextAuto,ready);assert.equal(c.autoSwingStart,0);assert.equal(c.weaving.windupClips,0);
 assert.equal(c.castSpell('AimedShot',player),false);
 c.tick(.01,player,false);
 assert.equal(c.castSpell('AimedShot',player),true);
 while(c.lastAutoShot===null)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-3.3)<1e-8);
});
