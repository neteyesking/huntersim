import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat,ACTIONS} from './combat.js';
const far={x:0,z:18,yaw:Math.PI,targeted:true};
const near={...far,z:4};
function fresh(){const c=new Combat(()=>.9);c.autoShot=false;return c}
test('range availability follows melee, dead zone and ranged boundaries',()=>{
 const c=fresh();
 for(const id of ['ArcaneShot','AimedShot','MultiShot','SerpentSting','ScorpidSting']){
  assert.equal(c.abilityState(id,near).code,'range',id);
  assert.equal(c.abilityState(id,far).usable,true,id);
 }
 assert.equal(c.abilityState('RaptorStrike',far).code,'range');
 assert.equal(c.abilityState('RaptorStrike',near).usable,true);
 for(const id of ['RaptorStrike','ArcaneShot'])assert.equal(c.abilityState(id,{...near,z:6}).code,'range');
 assert.equal(c.abilityState('HuntersMark',near).usable,true);
 assert.equal(c.abilityState('AspectOfTheHawk',near).usable,true);
});
test('reactive abilities track missing, live and expired proc windows',()=>{
 const c=fresh();c.talents.counterattack=1;
 for(const id of ['MongooseBite','Counterattack'])assert.equal(c.abilityState(id,near).code,'proc');
 c.mongooseUntil=5;c.counterUntil=3;
 assert.equal(c.abilityState('MongooseBite',near).procRemaining,5);
 assert.equal(c.abilityState('MongooseBite',near).usable,true);
 assert.equal(c.abilityState('Counterattack',near).usable,true);
 assert.equal(c.abilityState('MongooseBite',far).usable,false);
 c.time=5;
 assert.equal(c.abilityState('MongooseBite',near).code,'proc');
 assert.equal(c.abilityState('Counterattack',near).code,'proc');
});
test('availability exposes target, facing, mana, talent and pet requirements without logging',()=>{
 const c=fresh(),count=c.events.length;
 assert.equal(c.abilityState('ArcaneShot',{...far,targeted:false}).code,'target');
 assert.equal(c.abilityState('ArcaneShot',{...far,yaw:0}).code,'facing');
 assert.equal(c.abilityState('SniperShot',far).code,'talent');
 c.talents.bestialWrath=1;
 assert.equal(c.abilityState('BestialWrath',far).code,'pet');
 c.summonPet(far);assert.equal(c.abilityState('BestialWrath',far).usable,true);
 c.mana=0;assert.equal(c.abilityState('ArcaneShot',far).code,'mana');
 assert.equal(c.events.length,count);
});
test('cooldown and GCD lockouts leave off-GCD skills available',()=>{
 const c=fresh();c.gcdUntil=1.5;
 assert.equal(c.abilityState('ArcaneShot',far).code,'gcd');
 assert.equal(c.abilityState('RapidFire',far).usable,true);
 assert.equal(c.abilityState('RaptorStrike',near).usable,true);
 c.cooldowns.RapidFire=10;assert.equal(c.abilityState('RapidFire',far).code,'cooldown');
 c.time=10;assert.equal(c.abilityState('RapidFire',far).usable,true);
});
test('movement prevents starting stationary casts and channels, but permits instant attacks',()=>{
 const c=fresh();c.tick(.01,far,true);
 assert.equal(c.abilityState('AimedShot',far).code,'moving');
 assert.equal(c.abilityState('Volley',far).code,'moving');
 assert.equal(c.castSpell('AimedShot',far),false);
 assert.equal(c.abilityState('ArcaneShot',far).usable,true);
 c.tick(.01,far,false);
 assert.equal(c.abilityState('AimedShot',far).usable,true);
 c.castSpell('AimedShot',far);
 assert.equal(c.abilityState('ArcaneShot',far).code,'casting');
});
test('queued Raptor Strike can be cancelled after leaving range or losing mana',()=>{
 const c=fresh();assert.equal(c.castSpell('RaptorStrike',near),true);
 c.mana=0;
 const state=c.abilityState('RaptorStrike',{...far,targeted:false});
 assert.equal(state.queued,true);assert.equal(state.usable,true);
 assert.equal(c.castSpell('RaptorStrike',{...far,targeted:false}),true);
 assert.equal(c.raptorQueued,false);
 assert.equal(c.abilityState('RaptorStrike',far).usable,false);
});
test('render queries and casting use one evaluator for every action without mutating combat',()=>{
 const c=fresh();
 for(const p of [far,near,{...far,targeted:false},{...far,yaw:0}]){
  for(const action of ACTIONS)assert.equal(c.canCast(action.id,p,true),c.abilityState(action.id,p).usable,action.id);
 }
 assert.equal(c.time,0);assert.equal(c.events.length,1);assert.equal(c.mana,3000);
});
