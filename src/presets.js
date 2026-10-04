import {TREES,validTalents} from './catalog.js';
export const SV_WEAVE_STRING='-00530501114-550200030050220151';
const trees=SV_WEAVE_STRING.split('-');
export const SV_WEAVE=Object.freeze(Object.fromEntries(TREES.flatMap((tree,index)=>tree.talents.map((talent,i)=>[talent.field,Number(trees[index]?.[i]||0)]).filter(([,rank])=>rank))));
if(!validTalents(SV_WEAVE))throw Error('SV Weave preset does not match the talent catalog');
export function loadTalentBuild(storage){
 try{const saved=JSON.parse(storage.getItem('hunter-talents-v2'));if(saved&&typeof saved==='object'&&!Array.isArray(saved)&&validTalents(saved))return {...saved}}catch{}
 return {...SV_WEAVE};
}
export function isSurvivalWeave(ranks){return TREES.every(tree=>tree.talents.every(t=>(ranks[t.field]||0)===(SV_WEAVE[t.field]||0)))}
