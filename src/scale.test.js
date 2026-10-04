import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDS_PER_UNIT,HUMAN_HEIGHT,HUMAN_RADIUS,HUMAN_COMBAT_REACH,attackRange,centerDistance} from './scale.js';

test('one scene unit is one yard and both bodies use human proportions',()=>{
 assert.equal(YARDS_PER_UNIT,1);
 assert.ok(HUMAN_HEIGHT>2&&HUMAN_HEIGHT<2.1);
 assert.ok(HUMAN_RADIUS>0.3&&HUMAN_RADIUS<0.31);
 assert.equal(HUMAN_COMBAT_REACH,1.5);
});
test('ranged starts at eight yards while human reaches extend its outer bound',()=>{
 assert.deepEqual(attackRange({minRange:8,maxRange:35}),{min:8,max:38});
 assert.deepEqual(attackRange({minRange:0,maxRange:5}),{min:0,max:5});
 assert.deepEqual(attackRange({minRange:8,maxRange:35},6),{min:8,max:44});
});
test('center distance is measured between the human body origins',()=>{
 assert.equal(centerDistance({x:0,z:18}),18);
 assert.equal(centerDistance({x:3,z:4}),5);
});
