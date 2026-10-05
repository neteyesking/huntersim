import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
const ranged={x:0,z:18,yaw:Math.PI,targeted:true},melee={...ranged,z:4};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function advance(c,seconds,p=ranged,moving=false){for(let i=0;i<Math.round(seconds/.01);i++)c.tick(.01,p,moving);}
function nextShot(c,p=ranged){const last=c.lastAutoShot;for(let i=0;i<1500&&c.lastAutoShot===last;i++)c.tick(.01,p,false);assert.notEqual(c.lastAutoShot,last);}

test('returning to range while moving starts one Auto Shot cycle including windup',()=>{
 const c=new Combat(()=>.9);nextShot(c);advance(c,2);const first=c.lastAutoShot,expected=c.expectedAutoShotAt;
 c.tick(.01,melee,true);advance(c,.2,melee);
 assert.equal(c.autoResetByMelee,true);assert.equal(c.autoTimer().progress,0);assert.equal(c.autoTimer().phase,'waiting');
 c.tick(.01,ranged,true);const start=c.time;assert.equal(c.autoTimer().progress,0);
 assert.equal(c.autoResetByMelee,false);
 near(c.autoSwingStart,start);near(c.autoTimer().progress,0);near(c.autoTimer().remaining,2.8);
 near(c.expectedAutoShotAt,expected);near(c.lastAutoShot,first);
 advance(c,1);near(c.autoTimer().progress,1/2.8);near(c.autoTimer().remaining,1.8);
 nextShot(c);near(c.lastAutoShot,start+2.8);
 const stats=c.weaving.snapshot(c.time,c.expectedAutoShotAt);
 assert.equal(stats.weaves,1);assert.equal(stats.lastWeave.swings,1);
 near(stats.lastWeave.away,.21);near(stats.lastWeave.returnToShot,2.8);
 near(stats.lastDelay,c.lastAutoShot-expected);near(stats.totalDelay,stats.lastDelay);
 near(stats.liveDelay,0);
});
test('live delay grows while a shot is overdue and completed intervals update average and worst',()=>{
 const c=new Combat(()=>.9);nextShot(c);const expected=c.expectedAutoShotAt;
 advance(c,4,ranged,true);
 const live=c.weaving.snapshot(c.time,c.expectedAutoShotAt);
 near(live.liveDelay,c.time-expected);assert.equal(live.intervals,0);
 nextShot(c);const delay=c.autoDelay;
 assert.ok(delay>1);nextShot(c);
 const stats=c.weaving.snapshot(c.time,c.expectedAutoShotAt);
 assert.equal(stats.shots,3);assert.equal(stats.intervals,2);
 near(stats.averageDelay,stats.totalDelay/2);near(stats.worstDelay,delay);near(stats.lastDelay,0);
});
test('movement clips one windup and retries after half a second without a full swing reset',()=>{
 const c=new Combat(()=>.9);advance(c,.1);const start=c.autoSwingStart;
 c.tick(.01,ranged,true);const retry=c.autoRetryAt;
 near(retry,c.time+.5);near(c.autoSwingStart,start);assert.equal(c.autoTimer().phase,'retry');
 advance(c,.49);assert.equal(c.autoWindupStart,null);
 c.tick(.01,ranged,false);near(c.autoWindupStart,retry);
 advance(c,.5);near(c.lastAutoShot,retry+.5);assert.equal(c.weaving.windupClips,1);
});

test('range loss during windup is counted once and does not fill the uncompleted windup segment',()=>{
 const c=new Combat(()=>.9);advance(c,2.9);c.tick(.01,{...ranged,z:7},false);
 advance(c,.2,{...ranged,z:7});assert.equal(c.weaving.windupClips,1);
 assert.equal(c.autoTimer().phase,'ready');near(c.autoTimer().progress,2.3/2.8);
});
test('an excursion without a main-hand swing is not counted as a completed weave',()=>{
 const c=new Combat(()=>.9);nextShot(c);
 advance(c,.2,{...ranged,z:7});advance(c,.2,ranged);nextShot(c);
 assert.equal(c.weaving.weaves,0);assert.equal(c.weaving.active,null);
});
test('white and queued Raptor Strike swing attempts contribute to weave stats',()=>{
 const c=new Combat(()=>0);nextShot(c);advance(c,2);
 c.raptorQueued=true;c.tick(.01,melee,false);advance(c,2.5,melee);
 c.tick(.01,ranged,false);nextShot(c);
 const stats=c.weaving.snapshot(c.time,c.expectedAutoShotAt);
 assert.equal(stats.weaves,1);assert.equal(stats.lastWeave.swings,2);
 assert.equal(stats.averageSwings,2);
});
test('turning Auto Shot off cancels pending measurements and reset clears all stats',()=>{
 const c=new Combat(()=>.9);nextShot(c);c.tick(.01,melee,false);
 c.autoShot=false;advance(c,8,ranged);assert.equal(c.expectedAutoShotAt,null);assert.equal(c.weaving.active,null);
 c.autoShot=true;nextShot(c);assert.equal(c.weaving.intervals,0);assert.equal(c.weaving.weaves,0);
 c.reset();assert.equal(c.weaving.shots,0);assert.equal(c.weaving.totalDelay,0);assert.equal(c.weaving.windupClips,0);near(c.autoTimer().progress,0);
});