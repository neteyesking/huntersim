export const EXTRA_ACTIONS=[
 {id:'WeaveCombo',name:'Raptor + Kick',category:'Macros',tint:'#e6b66e',description:'Queue Raptor Strike up to 2 yd before melee range, then attempt Strider Kick. Kick still requires melee range; press again when in range. Each ability uses its normal range, talent, mana, cooldown and GCD checks. Repeated presses keep Raptor queued. Starting melee turns Auto Shot off.'},
];
export const actionBinding=id=>id==='AutoShot'?'toggleAuto':id==='WeaveCombo'?'weaveCombo':'spell:'+id;
