import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from './combat.js';
import {normalizeSettings,loadSettings,saveSettings,normalizeSetup,loadSetups,saveSetups} from './settings.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
test('training and display settings persist with validated limits and safe defaults',()=>{
 const storage=memory();assert.ok(saveSettings(storage,{training:{targetCombatReach:4,targetArmor:3500,dualWield:true,targetType:'Beast'},petFamily:'Wolf',petAutocast:false,aspect:'AspectOfTheBeast',showStats:false}));
 const s=loadSettings(storage);assert.equal(s.training.targetCombatReach,4);assert.equal(s.training.targetArmor,3500);assert.equal(s.training.dualWield,true);assert.equal(s.petFamily,'Wolf');assert.equal(s.aspect,'AspectOfTheBeast');assert.equal(s.petAutocast,false);assert.equal(s.showStats,false);
 const invalid=normalizeSettings({training:{targetCombatReach:999,targetArmor:-2,sparring:'yes',targetType:'bad'},aspect:'removed',petFamily:'__proto__'});
 assert.equal(invalid.training.targetCombatReach,20);assert.equal(invalid.training.targetArmor,0);assert.equal(invalid.training.sparring,false);assert.equal(invalid.petFamily,'Cat');
});
test('named setups round trip empty talents, cleared slots and independent copies',()=>{
 const storage=memory(),setup=normalizeSetup({talents:{},slots:Array(12).fill(null),settings:{aspect:'AspectOfTheMonkey'},bindings:{forward:'KeyI'}});
 assert.ok(saveSetups(storage,[{name:'Melee',setup}]));const saved=loadSetups(storage);assert.equal(saved[0].name,'Melee');assert.deepEqual(saved[0].setup.talents,{});assert.deepEqual(saved[0].setup.slots,Array(12).fill(null));assert.equal(saved[0].setup.bindings.forward,'KeyI');
 saved[0].setup.settings.aspect='AspectOfTheHawk';assert.equal(loadSetups(storage)[0].setup.settings.aspect,'AspectOfTheMonkey');
});
test('corrupt or unavailable storage does not break startup or report successful writes',()=>{
 assert.deepEqual(loadSetups({getItem:()=>'{bad'}),[]);assert.deepEqual(loadSettings({getItem:()=>'{bad'}),normalizeSettings());
 const blocked={getItem(){throw Error('denied')},setItem(){throw Error('full')}};
 assert.deepEqual(loadSetups(blocked),[]);assert.equal(saveSetups(blocked,[]),false);assert.equal(saveSettings(blocked,{}),false);
});
test('pet autocast preference applies when summoning and survives encounter reset',()=>{
 const c=new Combat();c.petAutocast=false;c.summonPet({x:0,z:18});assert.equal(c.pet.autocast,false);c.reset();c.summonPet({x:0,z:18});assert.equal(c.pet.autocast,false);
});
