import test from 'node:test';
import assert from 'node:assert/strict';
import {SV_WEAVE,loadTalentBuild,isSurvivalWeave} from './presets.js';
import {TREES,validTalents} from './catalog.js';
test('SV Weave is a valid 0/20/31 build with its defining talents',()=>{
 assert.equal(validTalents(SV_WEAVE),true);
 assert.deepEqual(TREES.map(tree=>tree.talents.reduce((n,t)=>n+(SV_WEAVE[t.field]||0),0)),[0,20,31]);
 for(const [field,rank] of Object.entries({loneWolf:1,trueshotAura:1,exposePrey:2,striderKick:1,lightningReflexes:5,laceratingStrikes:1}))assert.equal(SV_WEAVE[field],rank,field);
 assert.equal(SV_WEAVE.summonHawk,undefined);assert.equal(SV_WEAVE.sniperShot,undefined);
});
test('new or invalid saved talents default to SV Weave; valid custom and empty builds survive',()=>{
 for(const saved of [null,'{','{"invented":5}','[]'])assert.equal(isSurvivalWeave(loadTalentBuild({getItem:()=>saved})),true);
 for(const saved of [{},{deadlyAspects:1},SV_WEAVE])assert.deepEqual(loadTalentBuild({getItem:()=>JSON.stringify(saved)}),saved);
 const loaded=loadTalentBuild({getItem:()=>null});loaded.loneWolf=0;assert.equal(SV_WEAVE.loneWolf,1);
});
