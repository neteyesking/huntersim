// Level 60 attacker against level 60–63 NPCs, using the simulator's attack tables.
export function physicalTable({level=63,hit=0,expertise=0,crit=0,white=false,dualWield=false,ranged=false,front=false,canParry=true,canBlock=false,unavoidable=false}={}){
 const i=Math.max(0,Math.min(3,level-60)),suppression=i===3?.01:0;
 return {
  miss:Math.max(0,[.05,.055,.06,.08][i]+(white&&dualWield?.19:0)-Math.max(0,hit-suppression)),
  dodge:ranged||unavoidable?0:Math.max(0,[.05,.055,.06,.065][i]-expertise*.0025),
  parry:ranged||unavoidable||!front||!canParry?0:Math.max(0,[.05,.055,.06,.14][i]-expertise*.0025),
  glance:white?[.06,.12,.18,.24][i]:0,glanceMultiplier:[.95,.95,.85,.75][i],
  block:front&&canBlock&&!unavoidable?.05:0,crit:Math.max(0,crit-[0,.01,.02,.048][i]),
 };
}
export function rollPhysical(table,random,white=false,critOnBlock=false){
 const roll=random();let cursor=0;
 for(const kind of ['miss','dodge','parry','glance','block']){
  cursor+=table[kind];if(roll<cursor)return {kind,crit:kind==='block'&&critOnBlock&&random()<table.crit,multiplier:kind==='glance'?table.glanceMultiplier:1};
 }
 return {kind:'hit',crit:white?roll<cursor+table.crit:random()<table.crit,multiplier:1};
}
export function parryHastedSwing(now,next,speed){return next-now>speed*.2?Math.max(now+speed*.2,next-speed*.4):next}
