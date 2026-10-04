import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
const ranged={x:0,z:18,yaw:Math.PI,targeted:true},melee={...ranged,z:4};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function advance(c,seconds,p=ranged,moving=false){for(let i=0;i<Math.round(seconds/.01);i++)c.tick(.01,p,moving);}
function nextShot(c,p=ranged){const last=c.lastAutoShot;for(let i=0;i<1500&&c.lastAutoShot===last;i++)c.tick(.01,p,false);assert.notEqual(c.lastAutoShot,last);}

test('returning from melee starts an empty Auto Shot cycle with its full swing and windup',()=>{
 const c=new Combat(()=>.9);nextShot(c);const first=c.lastAutoShot,expected=c.expectedAutoShotAt;
 c.tick(.01,melee,true);advance(c,.2,melee);
 assert.equal(c.autoResetByMelee,true);assert.equal(c.autoTimer().progress,0);assert.equal(c.autoTimer().phase,'waiting');
 c.tick(.01,ranged,true);assert.equal(c.autoTimer().progress,0);
 c.tick(.01,ranged,false);const start=c.time;
 near(c.autoSwingStart,start);near(c.autoTimer().progress,0);near(c.autoTimer().remaining,3.3);
 near(c.expectedAutoShotAt,expected);near(c.lastAutoShot,first);
 advance(c,1);near(c.autoTimer().progress,1/3.3);near(c.autoTimer().remaining,2.3);
 nextShot(c);near(c.lastAutoShot,start+3.3);
 const stats=c.weaving.snapshot(c.time,c.expectedAutoShotAt);
 assert.equal(stats.weaves,1);assert.equal(stats.lastWeave.swings,1);
 near(stats.lastWeave.away,.21);near(stats.lastWeave.returnToShot,3.31);
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
test('a cancelled windup resets the displayed swing start and counts only one interruption',()=>{
 const c=new Combat(()=>.9);advance(c,2.8);assert.notEqual(c.autoWindupStart,null);
 c.tick(.01,ranged,true);near(c.autoTimer().progress,0);near(c.autoSwingStart,c.time);
 advance(c,.1,ranged,true);assert.equal(c.weaving.windupClips,1);
});
test('range loss during windup is counted once and does not fill the uncompleted windup segment',()=>{
 const c=new Combat(()=>.9);advance(c,2.9);c.tick(.01,{...ranged,z:7},false);
 advance(c,.2,{...ranged,z:7});assert.equal(c.weaving.windupClips,1);
 assert.equal(c.autoTimer().phase,'ready');near(c.autoTimer().progress,2.8/3.3);
});
test('an excursion without a main-hand swing is not counted as a completed weave',()=>{
 const c=new Combat(()=>.9);nextShot(c);
 advance(c,.2,{...ranged,z:7});advance(c,.2,ranged);nextShot(c);
 assert.equal(c.weaving.weaves,0);assert.equal(c.weaving.active,null);
});
test('white and queued Raptor Strike swing attempts contribute to weave stats',()=>{
 const c=new Combat(()=>0);nextShot(c);
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