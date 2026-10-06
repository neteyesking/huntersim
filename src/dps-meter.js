import {SPELLS} from './catalog.js';
export function createDpsMeter(host){
 host.innerHTML='<div class="dps-heading"><strong>DAMAGE DONE</strong><span id="meterDuration">0:00</span></div><div class="dps-total"><b id="meterDps">0</b><span>DPS</span><small id="meterDamage">0 damage</small></div><div id="meterRows" class="meter-rows" aria-label="Damage by ability"></div><details id="meterDetails"><summary>Weaving &amp; combat log</summary></details>';
 const rows=host.querySelector('#meterRows'),nodes=new Map();
 return combat=>{
  const data=combat.meter.snapshot(combat.time,combat.targetHealth>0&&combat.health>0),format=n=>Math.floor(n).toLocaleString();
  host.querySelector('#meterDps').textContent=format(data.dps);host.querySelector('#meterDamage').textContent=format(data.total)+' damage';
  host.querySelector('#meterDuration').textContent=Math.floor(data.elapsed/60)+':'+String(Math.floor(data.elapsed%60)).padStart(2,'0');
  const active=new Set(data.rows.map(r=>r.owner+':'+r.id));for(const [key,node] of nodes)if(!active.has(key)){node.remove();nodes.delete(key)}
  for(const [index,row] of data.rows.entries()){
   const key=row.owner+':'+row.id;let node=nodes.get(key);
   if(!node){node=document.createElement('div');node.className='damage-row';node.innerHTML='<i></i><span></span><b></b>';node.dataset.damageSource=row.id;nodes.set(key,node)}
   const name=(row.owner==='Hunter'?'':row.owner+' · ')+(SPELLS[row.id]?.name||row.id);
   node.querySelector('i').style.width=row.percent+'%';node.querySelector('span').textContent=name;node.querySelector('b').textContent=format(row.damage)+' · '+row.percent.toFixed(0)+'%';
   node.title=name+' · '+format(row.dps)+' DPS · '+row.hits+' hits · '+row.crits+' criticals';
   if(rows.children[index]!==node)rows.insertBefore(node,rows.children[index]||null);
  }
  rows.dataset.empty=String(!data.rows.length);
 };
}
