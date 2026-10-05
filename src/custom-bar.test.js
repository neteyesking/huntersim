import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SLOTS,loadSlots,normalizeSlots,swapSlots} from './custom-bar.js';
test('custom bar preserves empty slots and rejects removed or unknown abilities',()=>{
 const slots=normalizeSlots(['RaptorStrike',null,'BlackArrow','unknown','AutoShot']);
 assert.equal(slots.length,12);assert.deepEqual(slots.slice(0,5),['RaptorStrike',null,null,null,'AutoShot']);
});
test('custom bar recovers from corrupt or unavailable storage',()=>{
 assert.deepEqual(loadSlots({getItem:()=>'{broken'}),DEFAULT_SLOTS);
 assert.deepEqual(loadSlots({getItem:()=>{throw Error('unavailable')}}),DEFAULT_SLOTS);
 assert.deepEqual(loadSlots({getItem:()=>JSON.stringify(Array(12).fill(null))}),Array(12).fill(null));
});
test('moving a custom slot swaps without losing either ability or changing keybinds',()=>{
 const slots=[...DEFAULT_SLOTS],moved=swapSlots(slots,0,5);
 assert.equal(moved[0],slots[5]);assert.equal(moved[5],slots[0]);assert.deepEqual(slots,DEFAULT_SLOTS);
 assert.deepEqual(swapSlots(slots,-1,5),slots);
});
