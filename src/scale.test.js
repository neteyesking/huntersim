import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDS_PER_UNIT,HUMAN_HEIGHT,HUMAN_RADIUS,HUMAN_COMBAT_REACH,attackRange,centerDistance,meleeReach} from './scale.js';

test('one scene unit is one yard and both bodies use human proportions',()=>{
 assert.equal(YARDS_PER_UNIT,1);
 assert.ok(HUMAN_HEIGHT>2&&HUMAN_HEIGHT<2.1);
 assert.ok(HUMAN_RADIUS>0.3&&HUMAN_RADIUS<0.31);
 assert.equal(HUMAN_COMBAT_REACH,1.5);
});
test('ranged minimum includes target radius while human reaches extend its outer bound',()=>{
 assert.deepEqual(attackRange({minRange:8,maxRange:35}),{min:10.8,max:38});
 assert.deepEqual(attackRange({minRange:0,maxRange:5}),{min:0,max:5});
 assert.deepEqual(attackRange({minRange:8,maxRange:35},6),{min:10.8,max:44});
});
test('center distance is measured between the human body origins',()=>{
 assert.equal(centerDistance({x:0,z:18}),18);
 assert.equal(centerDistance({x:3,z:4}),5);
});

test('larger target hitbox radii widen the minimum without changing zero-minimum spells',()=>{
 assert.equal(attackRange({minRange:8,maxRange:35},0,5).min,13);
 assert.equal(attackRange({minRange:0,maxRange:100},0,5).min,0);
 assert.equal(attackRange({minRange:0,maxRange:5},0,5).max,7.2);
});

test('melee boundary follows target hitbox edge and preserves the default five-yard reach',()=>{
 assert.equal(meleeReach(2.8),5);assert.equal(meleeReach(5),7.2);assert.equal(meleeReach(1),3.2);
 assert.ok(meleeReach(20)>20);
});
