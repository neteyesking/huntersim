export function layoutCombatText(items, viewportWidth, viewportHeight) {
  const placed=[];
  for(const item of items){
    const gap=10;
    const baseX=Math.max(item.width/2,Math.min(viewportWidth-item.width/2,item.x));
    const baseY=Math.max(item.height,Math.min(viewportHeight,item.y));
    let x=baseX;
    for(let lane=0;lane<24;lane++){
      const shift=lane===0?0:Math.ceil(lane/2)*(lane%2?-1:1)*(item.width+gap);
      const candidate=Math.max(item.width/2,Math.min(viewportWidth-item.width/2,baseX+shift));
      const overlaps=placed.some(other=>
        Math.abs(candidate-other.x)<(item.width+other.width)/2+gap &&
        baseY-item.height<other.y+gap &&
        baseY>other.y-other.height-gap
      );
      if(!overlaps){x=candidate;break}
      if(lane===23)x=candidate;
    }
    placed.push({...item,x,y:baseY});
  }
  return placed;
}