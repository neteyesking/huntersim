export const YARDS_PER_UNIT = 1;
export const HUMAN_HEIGHT = 2.0277777;
export const HUMAN_RADIUS = 0.30555;
export const HUMAN_COMBAT_REACH = 1.5;
export const MELEE_RANGE_FLOOR = 5;
export const DEFAULT_TARGET_RANGE_RADIUS = 2.8;

export function attackRange(spell, bonusRange = 0, targetRadius = DEFAULT_TARGET_RANGE_RADIUS) {
  if (!spell || spell.maxRange === 0) return {min:0,max:0};
  if (spell.maxRange <= MELEE_RANGE_FLOOR) {
    return {min:0,max:Math.max(MELEE_RANGE_FLOOR,2*HUMAN_COMBAT_REACH+4/3)};
  }
  const reach=2*HUMAN_COMBAT_REACH;
  return {
    min:spell.minRange>0?spell.minRange+Math.max(0,Number.isFinite(targetRadius)?targetRadius:DEFAULT_TARGET_RANGE_RADIUS):0,
    max:spell.maxRange+bonusRange+reach,
  };
}

export function centerDistance(player, target={x:0,z:0}) {
  return Math.hypot(player.x-target.x,player.z-target.z);
}
