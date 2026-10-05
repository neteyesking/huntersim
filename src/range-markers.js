import * as THREE from 'three';

export function createRangeMarkers(scene){
 const group=new THREE.Group();scene.add(group);
 const surface=(color,opacity,y)=>{
  const mesh=new THREE.Mesh(new THREE.RingGeometry(0,1,128),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=y;group.add(mesh);return mesh;
 };
 const meleeFill=surface(0x58b77a,.07,.021),deadFill=surface(0xde9342,.075,.023);
 const melee=surface(0x87e0a2,.7,.036),ranged=surface(0xffce73,.8,.038),outer=surface(0x70bfe0,.3,.04);
 const label=(color)=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.048;group.add(mesh);return {mesh,canvas,texture,color};
 };
 const meleeLabel=label('#b6f5c7'),deadLabel=label('#f5c480'),rangedLabel=label('#ffe2a3');
 const setBand=(mesh,inner,outer)=>{mesh.geometry.dispose();mesh.geometry=new THREE.RingGeometry(Math.max(0,inner),Math.max(.001,outer),128)};
 const paint=(item,text,z)=>{
  const ctx=item.canvas.getContext('2d');ctx.clearRect(0,0,1024,128);ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=8;ctx.strokeStyle='#10251e';ctx.strokeText(text,512,64);ctx.fillStyle=item.color;ctx.fillText(text,512,64);item.texture.needsUpdate=true;item.mesh.position.x=Math.min(4,z*.65);item.mesh.position.z=Math.sqrt(z*z-item.mesh.position.x**2);
 };
 let previous='';
 return {
  update({reach,meleeMax,rangedMin,rangedMax}){
   const key=[reach,meleeMax,rangedMin,rangedMax].join(':');if(key===previous)return false;previous=key;
   setBand(meleeFill,reach,meleeMax);setBand(deadFill,meleeMax,rangedMin);
   setBand(melee,meleeMax-.045,meleeMax+.045);setBand(ranged,rangedMin-.045,rangedMin+.045);setBand(outer,rangedMax-.045,rangedMax+.045);
   paint(meleeLabel,'WEAVE / MELEE ≤ '+meleeMax.toFixed(1)+' YD',(reach+meleeMax)/2);
   paint(deadLabel,'DEAD ZONE · '+meleeMax.toFixed(1)+'–'+rangedMin.toFixed(1)+' YD',(meleeMax+rangedMin)/2);
   paint(rangedLabel,'RANGED ≥ '+rangedMin.toFixed(1)+' YD',rangedMin+.7);
   return true;
  },
  snapshot(){return {melee:melee.geometry.parameters.outerRadius-.045,rangedMin:ranged.geometry.parameters.outerRadius-.045,rangedMax:outer.geometry.parameters.outerRadius-.045,deadZone:{inner:deadFill.geometry.parameters.innerRadius,outer:deadFill.geometry.parameters.outerRadius}}},
 };
}
