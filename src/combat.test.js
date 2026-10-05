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
test('Auto Shot uses the nominal minimum plus target range radius',()=>{
  const combat=new Combat(()=>0.9);
  assert.equal(combat.minRangeFor('AutoShot'),10.8);
  assert.equal(combat.rangeFor('AutoShot'),38);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:10.79},true),false);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:10.8},true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:38},true),true);
  assert.equal(combat.canCast('ArcaneShot',{...player,z:38.1},true),false);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:5},true),true);
  assert.equal(combat.canCast('RaptorStrike',{...player,z:5.1},true),false);  const below=new Combat(()=>0.9),atEdge=new Combat(()=>0.9);
  for(let i=0;i<68;i++){
    below.tick(0.05,{...player,z:10.79},false);
    atEdge.tick(0.05,{...player,z:10.8},false);
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
test('Auto Shot opens with windup and includes it inside each weapon-speed cycle',()=>{
 const c=new Combat(()=>.9);c.tick(0,player,false);
 assert.equal(c.autoWindupStart,0);assert.equal(c.autoWindupEnd,.5);
 for(let i=0;i<50;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-.5)<1e-8);
 assert.ok(Math.abs(c.nextAuto-2.8)<1e-8);
 for(let i=0;i<230;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.autoWindupStart-2.8)<1e-8);
 for(let i=0;i<50;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-3.3)<1e-8);
 assert.ok(Math.abs(c.expectedAutoShotAt-6.1)<1e-8);
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
  const previous= combat.lastAutoShot;
  combat.tick(0.05,player,true);
  assert.equal(combat.autoWindupStart,null);
  assert.equal(combat.lastAutoShot,previous);
  assert.ok(combat.autoRetryAt>combat.time);
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
 const c=new Combat(()=>.9);c.tick(0,player,false);
 for(let i=0;i<250;i++)c.tick(.01,player,false);
 assert.equal(c.castSpell(id,player),true);
 const cast=c.cast,until=cast.until,previous=c.lastAutoShot;
 for(let i=0;i<35;i++)c.tick(.01,player,false);
 assert.ok(c.autoWindupStart!==null);
 assert.equal(c.cast,cast);
 while(c.lastAutoShot===previous)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-3.3)<1e-8);
 assert.equal(c.cast,cast);assert.equal(c.cast.until,until);
 assert.equal(c.weaving.windupClips,0);
 assert.ok(c.projectiles.some(p=>p.id==='AutoShot'));
 while(c.time<until+.01)c.tick(.01,player,false);
 assert.equal(c.cast,null);
});
test('starting a cast during Auto Shot windup preserves its release time',()=>{
 const c=new Combat(()=>.9);c.tick(0,player,false);
 for(let i=0;i<290;i++)c.tick(.01,player,false);
 const start=c.autoWindupStart,end=c.autoWindupEnd,previous=c.lastAutoShot;
 assert.equal(c.castSpell('AimedShot',player),true);
 c.tick(.01,player,false);
 assert.equal(c.autoWindupStart,start);assert.equal(c.autoWindupEnd,end);
 while(c.lastAutoShot===previous)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-end)<1e-8);assert.equal(c.cast.id,'AimedShot');
 assert.equal(c.weaving.windupClips,0);
});
test('movement during overlapping cast and Auto Shot windup cancels both',()=>{
 const c=new Combat(()=>.9);c.tick(0,player,false);
 for(let i=0;i<290;i++)c.tick(.01,player,false);
 assert.equal(c.castSpell('AimedShot',player),true);
 const previous=c.lastAutoShot;
 c.tick(.01,player,true);
 assert.equal(c.cast,null);assert.equal(c.autoWindupStart,null);assert.equal(c.lastAutoShot,previous);
 assert.equal(c.weaving.windupClips,1);assert.equal(c.autoTimer().phase,'retry');
 assert.ok(Math.abs(c.autoRetryAt-c.time-.5)<1e-8);
});
test('movement before the windup leaves the ranged swing clock running',()=>{
 const c=new Combat(()=>.9);c.tick(0,player,false);for(let i=0;i<50;i++)c.tick(.01,player,false);
 const ready=c.nextAuto,previous=c.lastAutoShot;
 for(let i=0;i<200;i++)c.tick(.01,player,true);
 assert.equal(c.nextAuto,ready);assert.ok(Math.abs(c.autoSwingStart-.5)<1e-8);assert.equal(c.weaving.windupClips,0);
 assert.equal(c.castSpell('AimedShot',player),false);
 c.tick(.01,player,false);
 assert.equal(c.castSpell('AimedShot',player),true);
 while(c.lastAutoShot===previous)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-3.3)<1e-8);
});


test('haste shortens the Auto Shot period while the windup stays at half a second',()=>{
 const c=new Combat(()=>.9);c.buff('rapidFire',15);c.tick(0,player,false);
 for(let i=0;i<50;i++)c.tick(.01,player,false);
 const first=c.lastAutoShot;assert.ok(Math.abs(c.expectedAutoShotAt-first-2)<1e-8);
 for(let i=0;i<150;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.autoWindupEnd-c.autoWindupStart-.5)<1e-8);
 for(let i=0;i<50;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-first-2)<1e-8);
});
test('a shot ready while moving retries at half-second intervals and resumes automatically',()=>{
 const c=new Combat(()=>.9);c.tick(0,player,true);
 assert.equal(c.autoRetryAt,.5);
 for(let i=0;i<50;i++)c.tick(.01,player,true);
 assert.ok(Math.abs(c.autoRetryAt-1)<1e-8);assert.equal(c.lastAutoShot,null);
 for(let i=0;i<49;i++)c.tick(.01,player,false);
 assert.equal(c.autoWindupStart,null);
 c.tick(.01,player,false);assert.ok(Math.abs(c.autoWindupStart-1)<1e-8);
 for(let i=0;i<50;i++)c.tick(.01,player,false);
 assert.ok(Math.abs(c.lastAutoShot-1.5)<1e-8);assert.equal(c.autoShot,true);
});

test('target range radius changes shooting availability while melee keeps its five-yard boundary',()=>{
 const c=new Combat(()=>.9);
 for(const radius of [0,2.8,5]){
  c.options.targetRangeRadius=radius;
  assert.equal(c.minRangeFor('AutoShot'),8+radius);
  for(const id of ['ArcaneShot','AimedShot','MultiShot','SerpentSting']){
   assert.equal(c.minRangeFor(id),8+radius);
   assert.equal(c.canCast(id,{...player,z:8+radius-.01},true),false);
   assert.equal(c.canCast(id,{...player,z:8+radius},true),true);
  }
  assert.equal(c.canCast('RaptorStrike',{...player,z:5},true),true);
  assert.equal(c.canCast('RaptorStrike',{...player,z:5.01},true),false);
 }
});
