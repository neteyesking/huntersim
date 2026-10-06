export const EXTRA_ACTIONS=[
 {id:'MeleeAttack',name:'Attack',category:'Macros & attacks',tint:'#e6c799',description:'Toggle melee auto-attacks. Starting melee turns Auto Shot off. Walking into melee range alone does not start attacks.'},
 {id:'WeaveCombo',name:'Raptor + Kick',category:'Macros & attacks',tint:'#e6b66e',description:'Queue Raptor Strike if available, then attempt Strider Kick. Each ability uses its normal range, talent, mana, cooldown and GCD checks. Repeated presses keep Raptor queued. Starting melee turns Auto Shot off.'},
];
export const actionBinding=id=>id==='AutoShot'?'toggleAuto':id==='MeleeAttack'?'toggleMelee':id==='WeaveCombo'?'weaveCombo':'spell:'+id;
