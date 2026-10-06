export class DamageMeter {
 constructor(){this.total=0;this.started=null;this.last=0;this.rows=new Map()}
 add(time,id,amount,crit=false,owner='Hunter'){
  if(amount<=0)return;if(this.started===null)this.started=time;this.last=time;this.total+=amount;
  const key=owner+':'+id,row=this.rows.get(key)||{id,owner,damage:0,hits:0,crits:0};row.damage+=amount;row.hits++;if(crit)row.crits++;this.rows.set(key,row);
 }
 snapshot(time,active=true){
  const elapsed=this.started===null?0:Math.max(0,(active?time:this.last)-this.started),divisor=Math.max(1,elapsed);
  return {total:this.total,elapsed,dps:this.total/divisor,rows:[...this.rows.values()].map(r=>({...r,dps:r.damage/divisor,percent:this.total?r.damage/this.total*100:0})).sort((a,b)=>b.damage-a.damage)};
 }
}
