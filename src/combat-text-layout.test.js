import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutCombatText} from './combat-text-layout.js';

test('simultaneous combat numbers occupy separate screen rectangles',()=>{
  const items=[
    {x:500,y:300,width:90,height:35},
    {x:500,y:300,width:180,height:70},
    {x:500,y:310,width:80,height:35},
    {x:500,y:300,width:100,height:35},
  ];
  const placed=layoutCombatText(items,1000,700);
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
    const a=placed[i],b=placed[j];
    const overlapsX=Math.abs(a.x-b.x)<(a.width+b.width)/2;
    const overlapsY=a.y-a.height<b.y&&b.y-b.height<a.y;
    assert.equal(overlapsX&&overlapsY,false);
  }
});