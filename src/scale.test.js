import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDS_PER_UNIT,HUMAN_HEIGHT,HUMAN_RADIUS,HUMAN_COMBAT_REACH,attackRange,centerDistance,meleeReach} from './scale.js';

test('one scene unit is one yard and both bodies use human proportions',()=>{
 assert.equal(YARDS_PER_UNIT,1);
 assert.ok(HUMAN_HEIGHT>2&&HUMAN_HEIGHT<2.1);
 assert.ok(HUMAN_RADIUS>0.3&&HUMAN_RADIUS<0.31);
 assert.equal(HUMAN_COMBAT_REACH,1.5);
});
test('both ranged bounds include both combat reaches',()=>{
 assert.deepEqual(attackRange({minRange:8,maxRange:35}),{min:11,max:38});
 assert.deepEqual(attackRange({minRange:0,maxRange:5}),{min:0,max:5});
 assert.deepEqual(attackRange({minRange:8,maxRange:35},6),{min:11,max:44});
});
test('center distance is measured between the human body origins',()=>{
 assert.equal(centerDistance({x:0,z:18}),18);
 assert.equal(centerDistance({x:3,z:4}),5);
});

test('larger target reach moves both ranged boundaries without changing zero-minimum spells',()=>{
 assert.equal(attackRange({minRange:8,maxRange:35},0,5).min,14.5);
 assert.equal(attackRange({minRange:0,maxRange:100},0,5).min,0);
 assert.equal(attackRange({minRange:0,maxRange:5},0,5).max,1.5+5+4/3);
});

test('melee uses the reach sum plus offset with a five-yard floor',()=>{
 assert.equal(meleeReach(1.5),5);assert.equal(meleeReach(5),1.5+5+4/3);assert.equal(meleeReach(1),5);
 assert.equal(meleeReach(0),5);assert.ok(meleeReach(20)>20);
 assert.equal(attackRange({minRange:8,maxRange:35},0,5).max,41.5);
});
