import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {targetDebuffs} from './nameplate.js';
import {layoutCombatText} from './combat-text-layout.js';
const player={x:0,z:18,yaw:Math.PI,targeted:true};
test('nameplate reads Mark and Sting expiry, refresh and replacement from combat',()=>{
 const c=new Combat(()=>.9);c.autoShot=false;
 c.finishSpell('HuntersMark',player);c.resolve('SerpentSting');
 let a=targetDebuffs(c);assert.deepEqual(a.map(a=>a.id),['HuntersMark','SerpentSting']);
 const mark=a[0].remaining;c.tick(.05,player,false);
 a=targetDebuffs(c);assert.equal(a[0].remaining,mark-.05);assert.equal(a[1].remaining,14.95);
 c.resolve('SerpentSting');assert.equal(targetDebuffs(c)[1].remaining,15);
 c.resolve('ScorpidSting');assert.deepEqual(targetDebuffs(c).map(a=>a.id),['HuntersMark','ScorpidSting']);
 c.time=c.sting.until;assert.deepEqual(targetDebuffs(c).map(a=>a.id),['HuntersMark']);
 c.respawnTarget();assert.deepEqual(targetDebuffs(c),[]);
});
test('nameplate shows pet dot stacks and control durations without slow percentage metadata',()=>{
 const c=new Combat(()=>.9);c.dot('Scorpid Poison',8,2,10);c.dots['Scorpid Poison'].stacks=3;
 c.control('slow',4);c.debuffs.slowPercent=60;
 assert.deepEqual(targetDebuffs(c).map(a=>[a.name,a.remaining,a.stacks]),[['Scorpid Poison',10,3],['Slowed',4,1]]);
 c.targetHealth=0;assert.deepEqual(targetDebuffs(c),[]);
 c.reset();assert.deepEqual(targetDebuffs(c),[]);
});
test('combat text avoids the nameplate bounds',()=>{
 const plate={x:400,y:300,width:210,height:90};
 const [text]=layoutCombatText([{x:400,y:280,width:60,height:24}],800,600,[plate]);
 assert.ok(Math.abs(text.x-plate.x)>=(text.width+plate.width)/2+10);
});
