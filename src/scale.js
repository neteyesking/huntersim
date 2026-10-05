export const YARDS_PER_UNIT = 1;
export const HUMAN_HEIGHT = 2.0277777;
export const HUMAN_RADIUS = 0.30555;
export const HUMAN_COMBAT_REACH = 1.5;
export const MELEE_RANGE_FLOOR = 5;
export const DEFAULT_TARGET_COMBAT_REACH = HUMAN_COMBAT_REACH;

export function combatReach(value=DEFAULT_TARGET_COMBAT_REACH) {
  return Math.max(0,Math.min(20,Number.isFinite(value)?value:DEFAULT_TARGET_COMBAT_REACH));
}
export function meleeReach(targetReach=DEFAULT_TARGET_COMBAT_REACH) {
  return Math.max(MELEE_RANGE_FLOOR,HUMAN_COMBAT_REACH+combatReach(targetReach)+4/3);
}

export function attackRange(spell, bonusRange = 0, targetReach = DEFAULT_TARGET_COMBAT_REACH) {
  if (!spell || spell.maxRange === 0) return {min:0,max:0};
  if (spell.maxRange <= MELEE_RANGE_FLOOR) {
    return {min:0,max:meleeReach(targetReach)};
  }
  const reach=HUMAN_COMBAT_REACH+combatReach(targetReach);
  return {
    min:spell.minRange>0?spell.minRange+reach:0,
    max:spell.maxRange+bonusRange+reach,
  };
}

export function centerDistance(player, target={x:0,z:0}) {
  return Math.hypot(player.x-target.x,player.z-target.z);
}
