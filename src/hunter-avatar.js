import * as THREE from 'three';
import {HUMAN_HEIGHT} from './scale.js';

export const MELEE_ANIMATION_DURATION=.68;

export function createHunterAvatar(){
 const group=new THREE.Group(),upperBody=new THREE.Group(),body=new THREE.Group();group.add(upperBody);upperBody.add(body);
 const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness});
 const skin=material('#c89a78'),tunic=material('#47786c'),pants=material('#485052'),leather=material('#65452e'),hair=material('#38291e'),steel=material('#c8d4d1',.65),brass=material('#c29b57',.4),wood=material('#986331');
 const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const ball=(parent,r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=mesh(parent,new THREE.SphereGeometry(r,12,8),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
 const yAxis=new THREE.Vector3(0,1,0);
 const bone=(parent,r1,r2,mat)=>mesh(parent,new THREE.CylinderGeometry(r1,r2,1,10),mat);
 const placeBone=(m,a,b)=>{m.position.copy(a).add(b).multiplyScalar(.5);const d=new THREE.Vector3().subVectors(b,a);m.scale.y=d.length();m.quaternion.setFromUnitVectors(yAxis,d.normalize())};
 // The standing body occupies human height; weapons are separate from body bounds.
 mesh(body,new THREE.CylinderGeometry(.235,.18,.49,12),tunic,0,1.335,0).scale.z=.64;
 ball(body,.195,pants,0,.99,0,1,.65,.72);
 mesh(body,new THREE.CylinderGeometry(.187,.19,.07,12),leather,0,1.10,0).scale.z=.75;
 mesh(body,new THREE.BoxGeometry(.10,.065,.025),brass,0,1.10,.15);
 mesh(body,new THREE.CylinderGeometry(.072,.087,.16,10),skin,0,1.66,0);
 ball(body,.17,skin,0,1.83,.012,.84,1.08,.84);
 ball(body,.17,hair,0,1.898,-.018,.87,.76,.86);
 for(const x of [-.145,.145])ball(body,.041,skin,x,1.825,.006,.65,1,.65);
 mesh(body,new THREE.BoxGeometry(.044,.066,.047),skin,0,1.814,.147);
 for(const x of [-.058,.058]){mesh(body,new THREE.BoxGeometry(.041,.013,.013),hair,x,1.856,.147);mesh(body,new THREE.BoxGeometry(.055,.012,.012),hair,x,1.886,.143)}
 mesh(body,new THREE.BoxGeometry(.063,.01,.012),hair,0,1.768,.143);
 // Leather shoulder patches and a diagonal quiver strap.
 for(const x of [-.24,.24])ball(body,.105,leather,x,1.565,0,1,.65,1);
 const strap=mesh(body,new THREE.BoxGeometry(.055,.56,.018),leather,0,1.345,.16);strap.rotation.z=-.45;
 const quiver=new THREE.Group();quiver.position.set(.12,1.36,-.20);quiver.rotation.z=-.22;body.add(quiver);
 mesh(quiver,new THREE.CylinderGeometry(.085,.06,.47,10),leather);
 mesh(quiver,new THREE.TorusGeometry(.084,.015,6,12),brass,0,.235,0).rotation.x=Math.PI/2;
 for(let i=0;i<4;i++){const x=(i%2-.5)*.06,z=(Math.floor(i/2)-.5)*.06;mesh(quiver,new THREE.CylinderGeometry(.009,.009,.68,5),wood,x,.14,z);mesh(quiver,new THREE.BoxGeometry(.045,.08,.006),tunic,x,.44,z)}
 const legs=[-1,1].map(side=>{
  const hip=new THREE.Group();hip.position.set(side*.115,.97,0);group.add(hip);
  mesh(hip,new THREE.CylinderGeometry(.099,.074,.40,10),pants,0,-.20,0);
  const knee=new THREE.Group();knee.position.y=-.41;hip.add(knee);ball(knee,.079,pants,0,0,0);
  mesh(knee,new THREE.CylinderGeometry(.073,.065,.37,10),leather,0,-.205,0);
  ball(knee,.09,leather,0,-.49,.065,.87,.65,1.7);
  return {hip,knee};
 });
 const arms=[-1,1].map(side=>({
  shoulder:new THREE.Vector3(side*.27,1.56,0),upper:bone(body,.075,.064,tunic),lower:bone(body,.062,.048,skin),bracer:bone(body,.065,.055,leather),elbow:ball(body,.066,skin,0,0,0),hand:ball(body,.064,skin,0,0,0,.8,1,1),position:new THREE.Vector3(side*.32,1.0,.03),
 }));
 const poseArm=(arm,goal,side,blend)=>{
  arm.position.lerp(goal,blend);
  const direction=new THREE.Vector3().subVectors(arm.position,arm.shoulder),distance=THREE.MathUtils.clamp(direction.length(),.07,.679);direction.normalize();
  const bend=new THREE.Vector3(side,-.35,-.55);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const along=(.35*.35-.33*.33+distance*distance)/(2*distance);
  const elbow=arm.shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,.35*.35-along*along)));
  const hand=arm.shoulder.clone().addScaledVector(direction,distance);
  placeBone(arm.upper,arm.shoulder,elbow);placeBone(arm.lower,elbow,hand);placeBone(arm.bracer,elbow.clone().lerp(hand,.60),hand);
  arm.elbow.position.copy(elbow);arm.hand.position.copy(hand);
 };
 const bow=new THREE.Group();body.add(bow);
 const bowCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.60,-.13),new THREE.Vector3(0,-.36,.065),new THREE.Vector3(0,0,0),new THREE.Vector3(0,.36,.065),new THREE.Vector3(0,.60,-.13)]);
 mesh(bow,new THREE.TubeGeometry(bowCurve,24,.023,7),wood);
 mesh(bow,new THREE.CylinderGeometry(.029,.029,.17,8),leather);
 const stringGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.60,-.13),new THREE.Vector3(),new THREE.Vector3(0,.60,-.13)]);
 const string=new THREE.Line(stringGeometry,new THREE.LineBasicMaterial({color:'#e5d6b1'}));bow.add(string);
 const arrow=new THREE.Group();bow.add(arrow);
 mesh(arrow,new THREE.CylinderGeometry(.007,.007,.70,5),wood,0,0,.32).rotation.x=Math.PI/2;
 mesh(arrow,new THREE.ConeGeometry(.028,.075,4),steel,0,0,.70).rotation.x=Math.PI/2;
 mesh(arrow,new THREE.BoxGeometry(.048,.009,.09),tunic,0,0,.035);
 const sword=new THREE.Group();body.add(sword);
 mesh(sword,new THREE.BoxGeometry(.075,.68,.022),steel,0,.39,0);
 mesh(sword,new THREE.ConeGeometry(.045,.14,4),steel,0,.80,0);
 mesh(sword,new THREE.BoxGeometry(.24,.04,.06),brass,0,.04,0);
 mesh(sword,new THREE.CylinderGeometry(.026,.026,.17,8),leather,0,-.065,0);
 ball(sword,.036,brass,0,-.16,0);
 const offSword=sword.clone();body.add(offSword);offSword.scale.setScalar(.8);
 const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Array(18).fill(0),3));
 const trail=mesh(body,trailGeometry,new THREE.MeshBasicMaterial({color:'#f4cf7e',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));trail.castShadow=false;
 const previousTip=new THREE.Vector3(),previousBase=new THREE.Vector3();let wasSlashing=false;
 const shadow=mesh(group,new THREE.CircleGeometry(.43,32),new THREE.MeshBasicMaterial({color:0x071713,transparent:true,opacity:.3}),0,.025,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
 let state={pose:'idle',draw:0,ability:null};
 const v=(x,y,z)=>new THREE.Vector3(x,y,z);
 function update({time,dt,moving,airborne,melee,aiming,draw,releaseAge,meleeAge,ability,dualWield=false,offhandAge=-1}){
  const blend=1-Math.exp(-dt*22),release=releaseAge>=0&&releaseAge<.28,slashing=meleeAge>=0&&meleeAge<MELEE_ANIMATION_DURATION;
  const offSlashing=dualWield&&offhandAge>=0&&offhandAge<MELEE_ANIMATION_DURATION;
  const shooting=(aiming||release)&&!slashing&&!offSlashing,ready=melee||slashing||offSlashing;
  const recoil=release?Math.sin(Math.PI*releaseAge/.28):0;
  const progress=THREE.MathUtils.clamp(draw,0,1),pull=.13+progress*.37;
  const gait=moving&&!airborne?Math.sin(time*13)*.13:0;
  let left=v(-.32,1.01,.04-gait),right=v(.32,1.01,.04+gait);
  if(shooting){left=v(-.12,1.70,.61-recoil*.045);right=v(-.12,1.70,.61-(release?.5:pull)-recoil*.14)}
  else if(ready){left=v(-.29,1.28,.23);right=v(.33,1.24,.30)}
  // A raised blade cuts across the front of the body before returning to guard.
  // These phases follow the combat event and never schedule damage.
  let swordDirection=ready?v(.05,.5,.85):v(.12,-1,-.08),swingPhase=null,twist=0;
  if(slashing){
   const heavy=ability==='RaptorStrike',cutEnd=heavy?.38:.34;
   const guard=v(.33,1.24,.30),raised=v(.66,1.77,.10),follow=v(-.30,1.30,.20);
   const raisedBlade=v(.75,.95,-.20),followBlade=v(-1,-.15,.05),guardBlade=v(.05,.5,.85);
   const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
   if(meleeAge<.12){
    swingPhase='raise';const t=smooth(meleeAge/.12);
    right=guard.clone().lerp(raised,t);swordDirection=guardBlade.clone().lerp(raisedBlade,t);twist=-.24*t;
   }else if(meleeAge<cutEnd){
    swingPhase='cut';const t=smooth((meleeAge-.12)/(cutEnd-.12)),arc=Math.sin(Math.PI*t);
    right=raised.clone().lerp(follow,t);right.z+=arc*.30;
    swordDirection=raisedBlade.clone().lerp(followBlade,t);swordDirection.z+=arc*1.5;
    twist=THREE.MathUtils.lerp(-.24,heavy?.22:.16,t);
   }else{
    swingPhase='recover';const t=smooth((meleeAge-cutEnd)/(MELEE_ANIMATION_DURATION-cutEnd));
    right=follow.clone().lerp(guard,t);swordDirection=followBlade.clone().lerp(guardBlade,t);twist=(heavy?.22:.16)*(1-t);
   }
   left=v(-.34,1.34,.12);
  }
  let offDirection=v(-.05,.5,.85);
  if(offSlashing){const phase=offhandAge/MELEE_ANIMATION_DURATION,arc=Math.sin(phase*Math.PI);left=v(-.33+arc*.5,1.24+arc*.25,.30+arc*.35);offDirection=v(-.5+phase*1.3,Math.cos(phase*Math.PI),1);}
  body.rotation.y=twist;
  if(airborne&&!shooting&&!slashing){left.y+=.17;right.y+=.17}
  poseArm(arms[0],left,-1,offSlashing?1:blend);poseArm(arms[1],right,1,slashing?1:blend);
  for(const {hip,knee} of legs)knee.rotation.x=airborne?.45:Math.max(0,-hip.rotation.x)*1.05;
  if(shooting){bow.position.copy(arms[0].hand.position);bow.rotation.set(0,0,-.06)}
  else if(ready){bow.position.set(-.18,1.30,-.27);bow.rotation.set(0,0,.35)}
  else{bow.position.copy(arms[0].hand.position);bow.rotation.set(.22,0,-.22)}
  const positions=stringGeometry.attributes.position;positions.setXYZ(1,0,0,shooting?-pull:-.13);positions.needsUpdate=true;stringGeometry.computeBoundingSphere();
  arrow.visible=shooting&&!release;arrow.position.set(0,0,-pull);
  sword.position.copy(ready?arms[1].hand.position:v(.25,.97,-.05));
  sword.quaternion.setFromUnitVectors(yAxis,swordDirection.normalize());
  sword.scale.setScalar(dualWield?.85:1);offSword.visible=dualWield;
  offSword.position.copy(ready?arms[0].hand.position:v(-.25,.97,-.05));offSword.quaternion.setFromUnitVectors(yAxis,(ready?offDirection:v(-.12,-1,-.08)).normalize());
  const tip=v(0,.87,0).applyQuaternion(sword.quaternion).add(sword.position),base=v(0,.23,0).applyQuaternion(sword.quaternion).add(sword.position);
  if(swingPhase==='cut'&&wasSlashing){const a=trailGeometry.attributes.position;[previousBase,previousTip,tip,previousBase,tip,base].forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true;trailGeometry.computeBoundingSphere();trail.material.opacity=(ability==='RaptorStrike'?.42:.20)*Math.sin(Math.PI*(meleeAge-.12)/((ability==='RaptorStrike'?.38:.34)-.12))}else trail.material.opacity=0;
  previousTip.copy(tip);previousBase.copy(base);wasSlashing=slashing;
  state={dualWield,offhandSwing:offSlashing,offhandTip:v(0,.87,0).multiplyScalar(.8).applyQuaternion(offSword.quaternion).add(offSword.position).toArray(),pose:slashing?'sword-swing':release?'bow-release':shooting?'bow-draw':airborne?'jump':moving?'run':ready?'melee-ready':'idle',draw:progress,ability:slashing||release?ability:null,height:HUMAN_HEIGHT,swingPhase,swordTip:tip.clone().applyAxisAngle(yAxis,twist).toArray()};
 }
 update({time:0,dt:1,moving:false,airborne:false,melee:false,aiming:false,draw:0,releaseAge:-1,meleeAge:-1,ability:null});
 return {group,upperBody,legL:legs[0].hip,legR:legs[1].hip,update,snapshot:()=>({...state,swordTip:[...state.swordTip],stringPull:-stringGeometry.attributes.position.getZ(1),leftHand:arms[0].hand.position.toArray(),rightHand:arms[1].hand.position.toArray()}),muzzlePosition:()=>bow.localToWorld(new THREE.Vector3(0,0,.25))};
}
