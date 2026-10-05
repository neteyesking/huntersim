document.documentElement.dataset.build=typeof __HUNTER_BUILD_ID__==='undefined'?'development':__HUNTER_BUILD_ID__;
import * as THREE from 'three';
import {Combat, SPELLS, TREES, ACTIONS} from './combat.js';
import {movementAxes, stepMovement, turnDelta, CameraRig, cameraCommand, bodyHeading, angleDifference, PressGesture} from './movement.js';
import {createRangeMarkers} from './range-markers.js';
import {createHunterAvatar} from './hunter-avatar.js';
import {HUMAN_HEIGHT, HUMAN_RADIUS, combatReach} from './scale.js';
import {SV_WEAVE,loadTalentBuild,isSurvivalWeave} from './presets.js';
import {WEAVE_GUIDE} from './weave-guide.js';
import {createNameplate,targetDebuffs,auraTime} from './nameplate.js';
import {layoutCombatText} from './combat-text-layout.js';
import {BINDING_GROUPS, DEFAULT_BINDINGS, eventChord, mouseChord, wheelChord, bindingLabel, actionForChord, held, rebind, loadBindings, saveBindings} from './bindings.js';
import {PET_FAMILIES, RECORDS, changeTalent, validTalents, describe} from './catalog.js';
import './style.css';

const app=document.querySelector('#app');
app.innerHTML=`
<div id="scene"></div><div id="targetNameplate" class="target-nameplate" hidden></div><div id="combatText" aria-hidden="true"></div>
<div class="topbar"><div class="brand"><span class="brand-mark">◆</span><div><strong>HUNTER</strong><small>TRAINING GROUND · FOREVER</small></div></div><div class="top-actions"><button id="trainingBtn">Training</button><button id="howToBtn">How to</button><button id="helpBtn">Controls</button><button id="keybindBtn">Keybinds</button><button id="talentBtn">Talents <span id="pointsBadge">0/51</span></button><button id="resetBtn">Reset encounter</button></div></div>
<div class="target-panel" id="targetPanel"><div class="eyebrow">TARGET · TRAINING DUMMY</div><div class="target-title"><strong>Clockwork Sentinel</strong><span id="targetPct">100%</span></div><div class="meter health"><i id="healthFill"></i></div><div class="target-stats"><span id="targetHp">50,000 / 50,000</span><span id="rangeText">18 yd</span></div><div id="targetAuras"></div><div id="rangeLegend" class="range-legend"></div></div>
<div class="player-panel"><div class="eyebrow">HUNTER · LEVEL 60</div><div class="player-title"><strong>Wayfinder</strong><span id="manaText">3,000 / 3,000</span></div><div class="meter mana"><i id="manaFill"></i></div><div class="player-meta"><span id="aspectText">Aspect of the Hawk</span><span id="rapidText"></span></div><div id="hunterVitals" class="vitals"></div><div id="petVitals" class="vitals"></div><div class="pet-orders"><button id="petAttack">Pet attack</button><button id="petFollow">Follow</button><button id="petStay">Stay</button></div><div class="scale-note">1 grid square = 1 yd · human body 2.03 yd tall · target combat reach adjustable in Training</div></div>
<div class="telemetry-column"><div class="status-card"><div class="eyebrow">ENCOUNTER</div><div class="statline"><span>Duration</span><strong id="timeText">0:00</strong></div><div class="statline"><span>Damage</span><strong id="damageText">0</strong></div><div class="statline"><span>DPS</span><strong id="dpsText">0</strong></div><div class="statline"><span>Position</span><strong id="positionText">18 yd</strong></div><div class="statline"><span>Auto Shot</span><strong id="autoText">ON</strong></div><button class="inline" id="autoBtn"><span id="autoBtnLabel">Stop Auto Shot</span> <kbd id="autoKey">T</kbd></button><button class="inline" id="hitboxBtn">Show hitboxes</button></div>
<div class="combat-log"><div class="telemetry-tabs"><button id="weavingTab" class="selected">Weaving</button><button id="combatLogTab">Combat log</button></div><div id="weavingStats">
<div class="statline" title="How overdue the next Auto Shot is against the previous shot's expected release"><span>Live ranged delay</span><strong id="liveRangedDelay">+0.00s</strong></div>
<div class="statline" title="Delay on the last completed shot interval / average across completed intervals"><span>Last / avg delay</span><strong id="lastAverageDelay">— / —</strong></div>
<div class="statline" title="Accumulated delay / longest delay across completed shot intervals"><span>Total / worst delay</span><strong id="totalWorstDelay">0.00s / 0.00s</strong></div>
<div class="statline" title="Completed ranged-to-melee-to-ranged cycles containing at least one main-hand swing, finalized by the next Auto Shot"><span>Completed weaves</span><strong id="completedWeaves">0</strong></div>
<div class="statline" title="Time inside the current ranged boundary, including the dead zone; last completed weave / average"><span>Last / avg time inside</span><strong id="weaveAway">— / —</strong></div>
<div class="statline" title="Main-hand white or Raptor Strike swing attempts, including misses; last weave / average"><span>Swings per weave</span><strong id="weaveSwings">— / —</strong></div>
<div class="statline" title="Time from crossing back into ranged distance until the next Auto Shot fires, for the last completed weave"><span>Return → shot</span><strong id="returnToShot">—</strong></div>
<div class="statline" title="Auto Shot windups interrupted by movement, facing, or range loss"><span>Interrupted windups</span><strong id="windupClips">0</strong></div>
<div id="weaveSession" class="weave-session">Shoot, weave in, then return.</div></div><div id="combatLogBody" class="hidden"><div id="logRows"></div></div></div></div>
<div class="reticle"><div class="reticle-ring"></div><span id="reticleText">TARGET LOCKED</span></div>
<div class="bottom"><div id="weaveStrip" class="weave-strip"><span class="weave-icon">➶</span><div class="weave-field"><i id="weaveFill"></i><span id="weaveZone">RANGED</span><b id="weaveCue">WAIT</b></div><span class="weave-icon melee-icon">⚔</span></div><div class="timer-bars"><div class="timer-row auto-row"><button class="timer-icon" id="autoTimerToggle" aria-label="Toggle Auto Shot">➶</button><button type="button" id="autoTrackToggle" class="timer-track auto-track" aria-label="Toggle Auto Shot"><i id="autoBar"></i><em id="multiTick" class="timer-tick multi-tick" title="Multi-Shot cast plus windup"></em><em id="windupTick" class="timer-tick windup-tick" title="Auto Shot windup begins"></em><span class="bar-title" id="autoTrackLabel">AUTO ON · STOP</span><span class="bar-delay" id="autoDelay">+0.00</span></button><b id="autoBarText">0.5s</b></div><div class="timer-row windup-row"><span>WINDUP</span><div class="timer-track windup-track"><i id="windupBar"></i></div><b id="windupBarText">WAITING</b></div><div class="timer-row melee-row"><span class="timer-icon melee-icon">⚔</span><div class="timer-track melee-track"><i id="meleeBar"></i></div><b id="meleeBarText">2.4s</b></div></div><div id="castWrap"><div id="castLabel"></div><div class="cast-track"><i id="castFill"></i><i id="castWindupFill"></i><em id="castBoundary"></em></div></div><div id="spellTabs" class="spell-tabs"></div><div id="actionBar"></div><div class="hint" id="controlHint"></div></div>
<div id="toast"></div>
<div id="talentPanel" class="drawer hidden"><div class="drawer-head"><div><div class="eyebrow">BUILD YOUR HUNTER</div><h2>Talents <span id="talentPoints">0 / 51</span></h2></div><button class="close" id="talentClose">×</button></div><p class="drawer-intro">All 51 talents use Forever rank data. Left click to learn; right click to refund. Tier requirements, prerequisites and the 51 point budget are enforced. Builds save in this browser.</p><div class="preset-controls"><button class="inline" id="svPreset">Load SV Weave &amp; reset</button><span id="buildLabel"></span></div><div id="talentTrees"></div><button class="inline" id="clearTalents">Clear talents</button></div>
<div id="helpPanel" class="modal hidden"><div class="help-card"><button class="close" id="helpClose">×</button><div class="eyebrow">FIELD GUIDE</div><h2>Hunter controls</h2><p>Left click the dummy to target it; left click empty ground to clear the target. Move and face the stationary dummy. Auto Shot uses its nominal range plus both combat reaches: 11–38 yd with default human reach. Melee reaches 5 yd by default and extends with larger combat reach. Adjust Target combat reach in Training; the colored ground zones update. Face the target and keep enough mana. Moving during a cast interrupts it.</p><div class="help-grid" id="helpGrid"></div><button class="inline" id="helpBindings">Edit keybinds</button><button id="helpPlay">Enter the ground</button></div></div><div id="keybindPanel" class="modal hidden"><div class="keybind-card"><div class="drawer-head"><div><div class="eyebrow">CUSTOMIZE CONTROLS</div><h2>Keybinds</h2></div><button class="close" id="keybindClose">×</button></div><p>Click a binding, then press a key, mouse button or wheel direction. Backspace clears it. Escape cancels capture.</p><div id="bindingConflict" class="binding-conflict hidden"></div><div id="bindingGroups"></div><div class="keybind-actions"><button class="inline" id="restoreBindings">Restore defaults</button><button class="inline" id="keybindDone">Done</button></div></div></div>`;

const $=id=>document.getElementById(id);
const combat=new Combat();
for(const [tab,body,otherTab,otherBody] of [['weavingTab','weavingStats','combatLogTab','combatLogBody'],['combatLogTab','combatLogBody','weavingTab','weavingStats']])$(tab).onclick=()=>{$(body).classList.remove('hidden');$(otherBody).classList.add('hidden');$(tab).classList.add('selected');$(otherTab).classList.remove('selected')};
combat.talents=loadTalentBuild(window.localStorage);
const howTo=document.createElement('div');howTo.id='howToPanel';howTo.className='modal hidden';howTo.innerHTML=WEAVE_GUIDE;app.appendChild(howTo);
const training=document.createElement('div');training.id='trainingPanel';training.className='modal hidden';
training.innerHTML='<div class="help-card training-card"><button class="close" id="trainingClose">×</button><div class="eyebrow">ENCOUNTER LAB</div><h2>Training settings</h2><p>Single dummy, fixed level 60 training equipment. Optional sparring enables incoming attacks inside the current melee boundary so you can practice defenses and pet threat.</p><label><input id="sparringOption" type="checkbox"> Dummy sparring</label><label><input id="enrageOption" type="checkbox"> Target enraged</label><label><input id="hiddenOption" type="checkbox"> Target stealthed</label><label><input id="offhandOption" type="checkbox"> Equip training offhand</label><label><input id="regenOption" type="checkbox"> Target health regeneration</label><label>Target combat reach (yd) <input id="targetReachOption" type="number" min="0" max="20" step="0.1" value="1.5"></label><p class="training-note" id="targetRangeNote"></p><label>Target armor <input id="armorOption" type="number" min="0" max="20000" step="500" value="0"></label><label>Target type <select id="targetTypeOption"></select></label><label>Pet family <select id="petFamilyOption"></select></label><label><input id="petAutoOption" type="checkbox" checked> Pet autocast</label><div id="petSkills" class="pet-skills"></div><div class="training-actions"><button id="callPetBtn">Call pet</button><button id="petHurtBtn">Wound pet</button><button id="petDebuffBtn">Poison pet</button><button id="petStunBtn">Stun pet</button><button id="natureHitBtn">Nature damage</button><button id="respawnBtn">Restore target</button><button id="revivePetBtn">Revive pet</button><button id="endViewBtn">End remote view / feign</button></div><p class="training-note">Pet family abilities and utility effects are training approximations. Multi-Shot and area effects hit the single dummy. Lacerate and Falcon are supplemental data records; live availability is unverified.</p></div>';
app.appendChild(training);
const player={x:0,z:18,yaw:Math.PI,height:0,jumpVelocity:0,horizX:0,horizZ:0,arcDirsSet:false,targeted:true};
let jumpRequested=false,walking=false,modelYaw=Math.PI;
const keys=new Set();
const pressed=new Set();
let bindings=loadBindings(window.localStorage);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#0c1821');
scene.fog=new THREE.FogExp2('#0c1821',0.018);
const camera=new THREE.PerspectiveCamera(45,1,0.1,200);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
$('scene').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xaac8d5,0x26302a,2.0));
const sunlight=new THREE.DirectionalLight(0xffdfaa,2.8);
sunlight.position.set(-13,22,9);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);
sunlight.shadow.camera.left=-35;sunlight.shadow.camera.right=35;sunlight.shadow.camera.top=35;sunlight.shadow.camera.bottom=-35;
scene.add(sunlight);
const mat=(color,roughness=0.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const stone=mat('#273a3a'),rim=mat('#c49459',0.48,0.25),wood=mat('#746049'),cloth=mat('#326359'),leather=mat('#57483b'),metal=mat('#a9b7af',0.4,0.65),glow=new THREE.MeshBasicMaterial({color:'#f1b86b'});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),mat('#25352f'));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(120,120,0x567469,0x3d5d52);grid.position.y=0.015;grid.material.opacity=0.13;grid.material.transparent=true;scene.add(grid);
function ring(radius,color,opacity=.5){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-.045,radius+.045,128),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity}));mesh.rotation.x=-Math.PI/2;mesh.position.y=.035;scene.add(mesh);return mesh}
const rangeMarkers=createRangeMarkers(scene);
for(let i=0;i<20;i++){
 const a=i*Math.PI*2/20,r=43+(i%3)*6;
 const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,.5,8),stone);
 plinth.position.set(Math.cos(a)*r,.25,Math.sin(a)*r);plinth.castShadow=true;scene.add(plinth);
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,1.8,6),rim);p.position.copy(plinth.position);p.position.y=1.3;scene.add(p);
 const light=new THREE.PointLight(0xe8a75f,1.1,8);light.position.copy(p.position);light.position.y=2.3;scene.add(light);
}
const target=new THREE.Group();scene.add(target);
function part(group,geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
part(target,new THREE.CylinderGeometry(.32,.34,.14,12),stone,0,.07,0);
part(target,new THREE.BoxGeometry(.18,.76,.2),wood,-.16,.5,0);
part(target,new THREE.BoxGeometry(.18,.76,.2),wood,.16,.5,0);
part(target,new THREE.CylinderGeometry(.27,.29,.68,10),wood,0,1.22,0);
part(target,new THREE.BoxGeometry(.16,.64,.2),wood,-.4,1.28,0);
part(target,new THREE.BoxGeometry(.16,.64,.2),wood,.4,1.28,0);
part(target,new THREE.CylinderGeometry(.08,.08,.16,8),metal,0,1.62,0);
part(target,new THREE.SphereGeometry(.2,10,8),metal,0,1.82,0);
for(let i=0;i<2;i++)part(target,new THREE.TorusGeometry(.28,.025,6,16),rim,0,1.08+i*.3,0).rotation.x=Math.PI/2;
part(target,new THREE.SphereGeometry(.06,8,8),glow,0,1.83,.2);
const targetLight=new THREE.PointLight(0xf4b264,1.2,5);targetLight.position.set(0,1.85,0);target.add(targetLight);
// Measure the standing model before adding selection and debug geometry.
const targetModelSize=new THREE.Box3().setFromObject(target).getSize(new THREE.Vector3());
const targetSelectionRadius=Math.sqrt(.5*Math.hypot(targetModelSize.x,targetModelSize.z))||1.2;
const selectionRing=new THREE.Mesh(
 new THREE.RingGeometry(Math.max(0,targetSelectionRadius-.08),targetSelectionRadius,128),
 new THREE.MeshBasicMaterial({color:0xed3e3e,side:THREE.DoubleSide,transparent:true,opacity:.86,depthWrite:false})
);
selectionRing.rotation.x=-Math.PI/2;selectionRing.position.y=.055;target.add(selectionRing);
const targetClickArea=new THREE.Mesh(
 new THREE.CylinderGeometry(.65,.65,2.4,12),
 new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
);
targetClickArea.position.y=1.2;target.add(targetClickArea);
const targetRaycaster=new THREE.Raycaster();
const targetPointer=new THREE.Vector2();
function setTargeted(selected){
 if(player.targeted===selected)return;
 player.targeted=selected;selectionRing.visible=selected;
 if(!selected){combat.interrupt();combat.raptorQueued=false}
}
function pickTarget(clientX,clientY){
 const rect=renderer.domElement.getBoundingClientRect();
 targetPointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
 targetRaycaster.setFromCamera(targetPointer,camera);
 return targetRaycaster.intersectObject(target,true).length>0;
}
const hunterVisual=createHunterAvatar();
const {group:avatar,upperBody,legL,legR}=hunterVisual;scene.add(avatar);
const attackMotion={type:null,start:0,id:null};
function animateAttack(dt,moving){
 const age=combat.time-attackMotion.start;
 if(attackMotion.type==='shoot'&&age>.28)attackMotion.type=null;
 if(attackMotion.type==='melee'&&age>.48)attackMotion.type=null;
 const rangedCast=combat.cast&&['AimedShot','MultiShot','SniperShot'].includes(combat.cast.id);
 const autoDraw=combat.autoWindupStart!==null?Math.min(1,(combat.time-combat.autoWindupStart)/.5):0;
 const castDraw=rangedCast?Math.min(1,(combat.time-combat.cast.start)/combat.cast.duration):0;
 hunterVisual.update({time:combat.time,dt,moving,airborne:player.height>0,melee:combat.distance(player)<=combat.rangeFor('RaptorStrike'),aiming:combat.autoWindupStart!==null||!!rangedCast,draw:Math.max(autoDraw,castDraw),releaseAge:attackMotion.type==='shoot'?age:-1,meleeAge:attackMotion.type==='melee'?age:-1,ability:attackMotion.id});
}
const capsuleGeometry=new THREE.CapsuleGeometry(HUMAN_RADIUS,HUMAN_HEIGHT-2*HUMAN_RADIUS,4,12);
const capsuleMaterial=new THREE.MeshBasicMaterial({color:0x6ed5d1,wireframe:true,transparent:true,opacity:.45,depthTest:false});
const targetHitbox=new THREE.Mesh(capsuleGeometry,capsuleMaterial);targetHitbox.position.y=HUMAN_HEIGHT/2;targetHitbox.visible=false;target.add(targetHitbox);
const playerHitbox=new THREE.Mesh(capsuleGeometry,capsuleMaterial);playerHitbox.visible=false;scene.add(playerHitbox);
const projectiles=[];
function disposeProjectile(mesh){mesh.traverse(node=>{if(node.isMesh){node.geometry.dispose();node.material.dispose()}})}
function spawnProjectile(id){if(!['AutoShot','ArcaneShot','AimedShot','MultiShot','SerpentSting','ScorpidSting','SniperShot'].includes(id))return;
 const count=id==='MultiShot'?3:1;
 for(let i=0;i<count;i++){
  const mesh=new THREE.Group(),tint=id==='ArcaneShot'?0x74c9ff:id==='SerpentSting'?0x88dd83:0xded2a6;
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.60,5),new THREE.MeshBasicMaterial({color:tint}));shaft.rotation.x=Math.PI/2;mesh.add(shaft);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.035,.10,4),new THREE.MeshBasicMaterial({color:tint}));tip.rotation.x=Math.PI/2;tip.position.z=.35;mesh.add(tip);
  const feather=new THREE.Mesh(new THREE.BoxGeometry(.06,.008,.10),new THREE.MeshBasicMaterial({color:0x699b87}));feather.position.z=-.25;mesh.add(feather);
  mesh.position.copy(hunterVisual.muzzlePosition());mesh.position.x+=(i-(count-1)/2)*.07;scene.add(mesh);
  const to=new THREE.Vector3((i-(count-1)/2)*.22,1.3,0);mesh.lookAt(to);
  const duration=Math.max(.15,Math.hypot(player.x,player.z)/(SPELLS[id]?.speed||40));
  projectiles.push({mesh,from:mesh.position.clone(),to,start:combat.time,duration});
 }
}

let lastHudRange=18;
const rig=new CameraRig(player.yaw);
const mouse={left:false,right:false};
const gestures=new Map();
const avatarMaterials=[];avatar.traverse(object=>{if(object.isMesh||object.isLine){object.material=object.material.clone();avatarMaterials.push({material:object.material,opacity:object.material.opacity});}});
let lastX=0,lastY=0,autorun=false,toastUntil=0;
function showToast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=combat.time+1.7}
function fire(id){const before=combat.events[0];if(!combat.castSpell(id,player)&&combat.events[0]!==before)showToast(combat.events[0].message)}
const buttons=new Map();
let actionPage='Core';
for(const name of [...new Set(ACTIONS.map(a=>a.category))]){
 const tab=document.createElement('button');tab.textContent=name;tab.onclick=()=>selectPage(name);$('spellTabs').appendChild(tab);
}
function selectPage(name){actionPage=name;for(const a of ACTIONS)buttons.get(a.id).hidden=a.category!==name;for(const b of $('spellTabs').children)b.classList.toggle('active',b.textContent===name)}

for(const action of ACTIONS){const b=document.createElement('button');b.className='action';b.style.setProperty('--tint',action.tint);
 const glyph=action.id==='MultiShot'?'<svg class="multi-shot-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 38 26 17m-8 0h8v8M12 42 33 21m-8 0h8v8M19 46 40 25m-8 0h8v8"/></svg>':action.id==='RapidFire'?'✷':action.id.includes('Sting')?'♜':action.id.includes('Aspect')?'◇':action.id==='HuntersMark'?'◎':'➶';
 b.innerHTML=`<span class="action-key">${bindingLabel(bindings['spell:'+action.id])}</span><span class="action-glyph">${glyph}</span><span class="action-name">${SPELLS[action.id]?.name||action.id}</span><span class="action-sweep"></span><span class="action-cooldown"></span>`;b.dataset.spell=action.id;b.dataset.description=describe(SPELLS[action.id]);b.title=b.dataset.description;b.onclick=()=>fire(action.id);$('actionBar').appendChild(b);buttons.set(action.id,b)}
selectPage('Core');
function setModal(id,open){
 $(id).classList.toggle('hidden',!open);
 if(open){jumpRequested=false;gestures.clear();keys.clear();pressed.clear();mouse.left=false;mouse.right=false;autorun=false;document.exitPointerLock?.()}
}
let captureId=null,pendingBinding=null;
function updateMouseState(){
 mouse.left=held(bindings,'cameraOrbit',pressed);
 mouse.right=held(bindings,'cameraSteer',pressed);
}
function renderHelp(){
 const rows=[
  ['forward','Move forward'],['backward','Move backward'],
  ['turnLeft','Turn left; strafe while steering'],['turnRight','Turn right; strafe while steering'],
  ['strafeLeft','Strafe left'],['strafeRight','Strafe right'],
  ['cameraOrbit','Orbit camera'],['cameraSteer','Turn hunter and camera'],
  ['zoomIn','Zoom in'],['zoomOut','Zoom out'],
  ['autorun','Toggle autorun'],['walk','Toggle walk / run'],['jump','Jump'],
  ['toggleAuto','Toggle Auto Shot'],
 ];
 const host=$('helpGrid');host.replaceChildren();
 for(const [id,description] of rows){
  const key=document.createElement('span');key.textContent=bindingLabel(bindings[id]);
  const value=document.createElement('b');value.textContent=description;
  host.append(key,value);
 }
}
function renderBindings(){
 const host=$('bindingGroups');host.replaceChildren();
 for(const group of BINDING_GROUPS){
  const section=document.createElement('section');section.className='binding-group';
  const title=document.createElement('h3');title.textContent=group.name;section.appendChild(title);
  for(const [id,label] of group.items){
   const row=document.createElement('div');row.className='binding-row';
   const name=document.createElement('span');name.textContent=label;
   const button=document.createElement('button');button.className='binding-key'+(captureId===id?' listening':'');
   button.textContent=captureId===id?'Press input…':bindingLabel(bindings[id]);
   button.onclick=()=>{captureId=id;pendingBinding=null;$('bindingConflict').classList.add('hidden');renderBindings();button.blur()};
   const clear=document.createElement('button');clear.className='binding-clear';clear.textContent='×';clear.title='Clear binding';
   clear.onclick=()=>commitBinding(id,'');
   row.append(name,button,clear);section.appendChild(row);
  }
  host.appendChild(section);
 }
}
function refreshBindingLabels(){
 for(const action of ACTIONS)buttons.get(action.id).querySelector('.action-key').textContent=bindingLabel(bindings['spell:'+action.id]);
 $('guideKeys').textContent=['RaptorStrike','MongooseBite','StriderKick','SerpentSting','ArcaneShot','MultiShot'].map(id=>(SPELLS[id]?.name||id)+': '+bindingLabel(bindings['spell:'+id])).join(' · ');
 $('autoKey').textContent=bindingLabel(bindings.toggleAuto);
 $('controlHint').textContent=`${bindingLabel(bindings.forward)} / ${bindingLabel(bindings.backward)} move · ${bindingLabel(bindings.turnLeft)} / ${bindingLabel(bindings.turnRight)} turn · ${bindingLabel(bindings.strafeLeft)} / ${bindingLabel(bindings.strafeRight)} strafe · ${bindingLabel(bindings.keybinds)} keybinds`;
 renderHelp();renderBindings();
}
function commitBinding(id,chord){
 bindings=rebind(bindings,id,chord).next;
 saveBindings(window.localStorage,bindings);
 captureId=null;pendingBinding=null;$('bindingConflict').classList.add('hidden');
 pressed.clear();keys.clear();updateMouseState();refreshBindingLabels();
}
function captureBinding(chord){
 if(!captureId||!chord)return;
 const id=captureId,conflict=actionForChord(bindings,chord);
 if(conflict&&conflict!==id){
  pendingBinding={id,chord};
  const box=$('bindingConflict');box.replaceChildren();
  const label=document.createElement('span');
  const old=BINDING_GROUPS.flatMap(group=>group.items).find(item=>item[0]===conflict)?.[1]||conflict;
  label.textContent=`${bindingLabel(chord)} is bound to ${old}. Replace it?`;
  const yes=document.createElement('button');yes.textContent='Replace';yes.onclick=()=>commitBinding(id,chord);
  const no=document.createElement('button');no.textContent='Cancel';no.onclick=()=>{pendingBinding=null;box.classList.add('hidden');renderBindings()};
  box.append(label,yes,no);box.classList.remove('hidden');
  captureId=null;renderBindings();
 }else commitBinding(id,chord);
}
function command(id){
 if(id?.startsWith('petspell:')){const spell=id.slice(9);if(!combat.petActive()||!PET_FAMILIES[combat.pet.family].abilities.includes(spell))showToast('Pet cannot use that ability');else if(!combat.petAbility(spell))showToast('Pet ability unavailable: focus, range or cooldown');return}

 if(id?.startsWith('pet:')){combat.petCommand(id.slice(4));return}
 if(id==='training'){$('trainingBtn').click();return}

 if(id?.startsWith('spell:')){fire(id.slice(6));return}
 if(id==='jump'){if(player.height===0&&player.jumpVelocity===0)jumpRequested=true;return}
 if(id==='autorun'){autorun=!autorun;return}
 if(id==='walk'){walking=!walking;showToast(walking?'Walking':'Running');return}
 if(id==='toggleAuto'){$('autoBtn').click();return}
 if(id==='toggleHitboxes'){$('hitboxBtn').click();return}
 if(id==='talents'){$('talentBtn').click();return}
 if(id==='howTo'){$('howToBtn').click();return}
 if(id==='loadSvWeave'){$('svPreset').click();return}
 if(id==='controls'){$('helpBtn').click();return}
 if(id==='keybinds'){$('keybindBtn').click();return}
 if(id==='closePanel'){setModal('talentPanel',false);setModal('helpPanel',false);setModal('keybindPanel',false);setModal('trainingPanel',false);setModal('howToPanel',false);return}
 if(id==='resetEncounter'){$('resetBtn').click();return}
 if(id==='clearTalents'){$('clearTalents').click();return}
 if(id==='zoomIn')rig.zoom(1);
 if(id==='zoomOut')rig.zoom(-1);
}
$('keybindBtn').onclick=()=>{captureId=null;pendingBinding=null;$('bindingConflict').classList.add('hidden');renderBindings();setModal('keybindPanel',true)};
$('keybindClose').onclick=$('keybindDone').onclick=()=>{captureId=null;setModal('keybindPanel',false)};
$('restoreBindings').onclick=()=>{bindings={...DEFAULT_BINDINGS};saveBindings(window.localStorage,bindings);captureId=null;pendingBinding=null;$('bindingConflict').classList.add('hidden');pressed.clear();updateMouseState();refreshBindingLabels()};
$('helpBindings').onclick=()=>{setModal('helpPanel',false);$('keybindBtn').click()};
refreshBindingLabels();
$('talentBtn').onclick=()=>{renderTalents();setModal('talentPanel',true)};
$('talentClose').onclick=()=>setModal('talentPanel',false);
$('howToBtn').onclick=()=>setModal('howToPanel',true);
$('howToClose').onclick=$('howToPlay').onclick=()=>setModal('howToPanel',false);
$('svPreset').onclick=$('guidePreset').onclick=()=>{
 combat.talents={...SV_WEAVE};combat.options.dualWield=false;$('offhandOption').checked=false;
 $('resetBtn').click();player.z=combat.minRangeFor('AutoShot')+.25;lastHudRange=player.z;saveTalents();renderTalents();
 setModal('howToPanel',false);setModal('talentPanel',false);showToast('SV Weave loaded · 0/20/31 · no pet');
};
$('helpBtn').onclick=()=>setModal('helpPanel',true);
$('helpClose').onclick=$('helpPlay').onclick=()=>setModal('helpPanel',false);
$('resetBtn').onclick=()=>{combat.reset();player.x=0;player.z=18;player.yaw=Math.PI;player.height=0;player.jumpVelocity=0;player.horizX=0;player.horizZ=0;player.arcDirsSet=false;setTargeted(true);jumpRequested=false;clearCombatText();rig.reset();modelYaw=Math.PI;walking=false;gestures.clear();autorun=false;attackMotion.type=null;combat.visualEvents.length=0;lastHudRange=18;for(const p of projectiles){scene.remove(p.mesh);disposeProjectile(p.mesh)}projectiles.length=0;showToast('Encounter reset')};
$('autoTimerToggle').onclick=$('autoTrackToggle').onclick=()=>$('autoBtn').click();
$('autoBtn').onclick=()=>{combat.autoShot=!combat.autoShot;showToast('Auto Shot '+(combat.autoShot?'on':'off'))};
$('hitboxBtn').onclick=()=>{const visible=!targetHitbox.visible;targetHitbox.visible=visible;playerHitbox.visible=visible;$('hitboxBtn').textContent=visible?'Hide hitboxes':'Show hitboxes'};
$('clearTalents').onclick=()=>{combat.talents={};saveTalents();renderTalents()};
function saveTalents(){try{localStorage.setItem('hunter-talents-v2',JSON.stringify(combat.talents))}catch{}}
function editTalent(field,delta){
 const next=changeTalent(combat.talents,field,delta);
 if(!next){showToast('Check talent tier, prerequisite and 51 point limit');return}
 combat.talents=next;saveTalents();renderTalents();
}
function renderTalents(){
 $('buildLabel').textContent=isSurvivalWeave(combat.talents)?'SV Weave · 0 / 20 / 31':'Custom build';
 const total=Object.values(combat.talents).reduce((a,b)=>a+b,0);$('talentPoints').textContent=total+' / 51';$('pointsBadge').textContent=total+'/51';
 const host=$('talentTrees');host.replaceChildren();
 for(const tree of TREES){
  const section=document.createElement('section');section.className='tree';
  const heading=document.createElement('h3');heading.textContent=tree.name;section.appendChild(heading);
  const grid=document.createElement('div');grid.className='talent-grid';section.appendChild(grid);
  for(const t of tree.talents){
    const value=combat.rank(t.field),enabled=true;
    const btn=document.createElement('button');btn.className='talent'+(value?' selected':'')+(!enabled?' pending':'');
    btn.style.gridRow=String(t.row+1);btn.style.gridColumn=String(t.col+1);
    btn.innerHTML=`<span class="talent-symbol talent-label">${t.name}</span><span class="talent-rank">${value}/${t.max}</span>`;
    btn.title=t.name+' ('+value+'/'+t.max+')\n'+describe(t.data,{[t.field]:Math.min(t.max,value+1)},t.field)+'\nRank values: '+t.curves.map(c=>c.join(' / ')).join('; ');
    btn.disabled=!enabled;
    btn.onclick=()=>editTalent(t.field,1);
    btn.oncontextmenu=e=>{e.preventDefault();if(value)editTalent(t.field,-1)};
    grid.appendChild(btn);
  }host.appendChild(section);
 }
}
renderTalents();
window.addEventListener('keydown',e=>{
 if(captureId){
  e.preventDefault();e.stopPropagation();
  if(e.code==='Escape'){captureId=null;renderBindings();return}
  if(e.code==='Backspace'){commitBinding(captureId,'');return}
  const chord=eventChord(e);if(chord)captureBinding(chord);
  return;
 }
 if(pendingBinding){if(e.code==='Escape'){$('bindingConflict').classList.add('hidden');pendingBinding=null}e.preventDefault();return}
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
 const chord=eventChord(e),id=actionForChord(bindings,chord);
 if(id||['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
 const panelOpen=['talentPanel','helpPanel','keybindPanel','trainingPanel','howToPanel'].some(name=>!$(name).classList.contains('hidden'));
 if(panelOpen){
  if(id==='closePanel'||e.code==='Escape')command('closePanel');
  else if(id==='clearTalents'&&!$('talentPanel').classList.contains('hidden'))command(id);
  return;
 }
 pressed.add(e.code);updateMouseState();
 if(e.repeat)return;
 if(id==='forward'||id==='backward')autorun=false;
 command(id);
});
window.addEventListener('keyup',e=>{pressed.delete(e.code);updateMouseState()});
window.addEventListener('blur',()=>{gestures.clear();keys.clear();pressed.clear();updateMouseState()});
document.addEventListener('mousedown',e=>{
 if(!captureId||e.target.closest('button'))return;
 e.preventDefault();e.stopPropagation();captureBinding(mouseChord(e));
},true);
document.addEventListener('wheel',e=>{
 if(!captureId)return;
 e.preventDefault();e.stopPropagation();captureBinding(wheelChord(e));
},{capture:true,passive:false});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('mousedown',e=>{
 if(['talentPanel','helpPanel','keybindPanel','trainingPanel','howToPanel'].some(name=>!$(name).classList.contains('hidden')))return;
 if(e.button===0)gestures.set(e.button,new PressGesture(performance.now()/1000,e.clientX,e.clientY));
 pressed.add('Mouse'+e.button);updateMouseState();
 const id=actionForChord(bindings,mouseChord(e));
 if(id==='forward'||id==='backward')autorun=false;
 if(id!=='cameraOrbit'&&id!=='cameraSteer')command(id);
 if(mouse.left&&mouse.right){autorun=false;for(const gesture of gestures.values())gesture.cancelled=true;}
 lastX=e.clientX;lastY=e.clientY;
 if(mouse.left||mouse.right)renderer.domElement.requestPointerLock?.()?.catch(()=>{});
});
window.addEventListener('mouseup',e=>{
 const gesture=gestures.get(e.button);gestures.delete(e.button);
 if(gesture?.release(performance.now()/1000))setTargeted(pickTarget(gesture.x,gesture.y));
 pressed.delete('Mouse'+e.button);updateMouseState();
 if(!mouse.left&&!mouse.right&&document.pointerLockElement===renderer.domElement)document.exitPointerLock();
});
document.addEventListener('pointerlockchange',()=>{
 if(!document.pointerLockElement){
  gestures.clear();
  for(let i=0;i<5;i++)pressed.delete('Mouse'+i);
  updateMouseState();
 }
});
window.addEventListener('mousemove',e=>{
 if(!mouse.left&&!mouse.right)return;
 const locked=document.pointerLockElement===renderer.domElement;
 const dx=locked?e.movementX:e.clientX-lastX;
 const dy=locked?e.movementY:e.clientY-lastY;
 lastX=e.clientX;lastY=e.clientY;
 for(const gesture of gestures.values())gesture.motion(dx,dy);
 rig.drag(dx,dy);
 if(mouse.right)player.yaw=rig.yaw;
});
renderer.domElement.addEventListener('wheel',e=>{
 e.preventDefault();
 const id=actionForChord(bindings,wheelChord(e));
 command(id);
},{passive:false});function resize(){const w=window.innerWidth,h=window.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
window.addEventListener('resize',resize);resize();
const nameplate=$('targetNameplate');
const drawNameplate=createNameplate(nameplate,()=>setTargeted(true));
const plateAnchor=new THREE.Vector3();
let plateObstacles=[];
const floatingTexts=[];
const textAnchor=new THREE.Vector3();
function clearCombatText(){
 for(const item of floatingTexts)item.node.remove();
 floatingTexts.length=0;
 combat.textEvents.length=0;
}
function updateCombatText(){
 const host=$('combatText');
 for(const event of combat.textEvents.splice(0)){
  if(floatingTexts.length>=4)continue;
  const node=document.createElement('span');
  node.className='floating-text '+event.kind+(event.id==='AutoShot'||event.id==='Melee Swing'?' physical':' spell');
  node.textContent=event.text;
  host.appendChild(node);
  floatingTexts.push({node,born:combat.time,kind:event.kind});
 }
 const diagonal=Math.hypot(window.innerWidth,window.innerHeight);
 const layouts=[];
 for(let i=floatingTexts.length-1;i>=0;i--){
  const item=floatingTexts[i],age=(combat.time-item.born)/1.5;
  if(age>=1){item.node.remove();floatingTexts.splice(i,1);continue}
  const rise=item.kind==='crit'?0:2*age;
  textAnchor.set(0,HUMAN_HEIGHT*1.25-1/3+rise,0).project(camera);
  if(textAnchor.z>1||textAnchor.z< -1||Math.abs(textAnchor.x)>1.2||Math.abs(textAnchor.y)>1.2){
   item.node.remove();floatingTexts.splice(i,1);continue;
  }
  const fadeStart=item.kind==='damage'?760/1500:1000/1500;
  const opacity=age<0.1?age:age>fadeStart?(1-age)/(1-fadeStart):1;
  const pop=item.kind==='crit'?(age<.1?.1+19*age:age<.2?2-10*(age-.1):1):1;
  const size=Math.max(1,Math.round((item.kind==='crit'?.0275:.018333)*diagonal*pop));
  item.node.style.fontSize=size+'px';
  item.node.style.opacity=Math.max(0,Math.min(1,opacity));
  const rect=item.node.getBoundingClientRect();
  layouts.push({item,x:(textAnchor.x+1)*.5*window.innerWidth,y:(1-textAnchor.y)*.5*window.innerHeight,width:rect.width,height:rect.height});
 }
 for(const placement of layoutCombatText(layouts,window.innerWidth,window.innerHeight,plateObstacles)){
  placement.item.node.style.left=placement.x+'px';
  placement.item.node.style.top=placement.y+'px';
 }
}
let last=performance.now();
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 const blocked=['talentPanel','helpPanel','keybindPanel','trainingPanel','howToPanel'].some(name=>!$(name).classList.contains('hidden'));
 keys.clear();
 for(const [id,key] of [['forward','w'],['backward','s'],['turnLeft','a'],['turnRight','d'],['strafeLeft','q'],['strafeRight','e']])if(held(bindings,id,pressed))keys.add(key);
 const axes=blocked||combat.health<=0?{forward:0,side:0,turn:0}:movementAxes(keys,mouse,autorun);
 const translating=axes.forward!==0||axes.side!==0;
 if(mouse.right&&!blocked&&combat.health>0)player.yaw=rig.yaw;
 const turn=turnDelta(axes.turn,dt,translating,player.height>0);
 player.yaw+=turn;
 if(!mouse.left&&!mouse.right)rig.carryTurn(turn);
 const remote=combat.auras.eyes&&combat.petActive();
 const controlled=remote?combat.pet:player;
 if(remote){controlled.yaw=player.yaw;controlled.height=0;controlled.jumpVelocity=0;controlled.horizX??=0;controlled.horizZ??=0}
 const {moving}=stepMovement(controlled,axes,dt,jumpRequested&&!blocked&&combat.health>0,remote?1:combat.movementMultiplier(),walking);
 jumpRequested=false;
 modelYaw=bodyHeading(modelYaw,player.yaw,remote?{forward:0,side:0}:axes,player.height>0,mouse.right,dt);
 avatar.position.set(player.x,player.height,player.z);avatar.rotation.y=modelYaw;upperBody.rotation.y=angleDifference(player.yaw,modelYaw);
 playerHitbox.position.set(player.x,player.height+HUMAN_HEIGHT/2,player.z);
 legL.rotation.x=player.height>0?-.35:moving&&!remote?Math.sin(now*(walking?.007:.014))*.5*(axes.forward<0?-1:1):0;legR.rotation.x=-legL.rotation.x;
 rig.update(dt,player.yaw,cameraCommand(keys,mouse,autorun),mouse.left||mouse.right);
 const {eye,look,alpha}=rig.seat(combat.auras.eagleEye?{x:0,z:0,height:6}:controlled,dt,translating);
 avatar.visible=remote||combat.auras.eagleEye||alpha>0;
 for(const {material,opacity} of avatarMaterials){material.opacity=opacity*(remote||combat.auras.eagleEye?1:alpha);material.transparent=material.opacity<1;material.depthWrite=material.opacity===1;}
 camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(look.x,look.y,look.z);camera.updateMatrixWorld();
 if(!blocked)combat.tick(dt,player,!remote&&(moving||player.height>0));
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],t=(combat.time-p.start)/p.duration;p.mesh.position.lerpVectors(p.from,p.to,Math.min(1,t));if(t>=1){scene.remove(p.mesh);disposeProjectile(p.mesh);projectiles.splice(i,1)}}
 const attackEvents=combat.visualEvents.splice(0);
 for(const event of attackEvents){attackMotion.type=event.type;attackMotion.start=combat.time;attackMotion.id=event.id}
 updateCompanions();
 animateAttack(dt,moving&&!remote);
 for(const event of attackEvents)if(event.type==='shoot')spawnProjectile(event.id);
 updateHud();
 updateCombatText();
 renderer.render(scene,camera);
 requestAnimationFrame(frame);
}
function updateHud(){
 $('hunterVitals').textContent='Health '+Math.ceil(combat.health)+' / '+Math.ceil(combat.maxHealth)+' · Mana regen '+(combat.time-combat.lastSpend<5?'casting':'full');
 $('petVitals').textContent=combat.petActive()?PET_FAMILIES[combat.pet.family].name+' · '+Math.ceil(combat.pet.health)+' HP · '+Math.floor(combat.pet.focus)+' focus · '+combat.pet.order:combat.pet?.health<=0?'Pet defeated · use Revive Pet':'No active pet · call one from Pets';
 const visible=combat.targetVisible();target.visible=visible;
 selectionRing.visible=player.targeted&&visible;
 if(combat.trainingOpen){combat.trainingOpen=false;$('trainingBtn').click()}

 $('targetPanel').classList.toggle('hidden',!player.targeted);
 const hp=combat.targetHealth/combat.targetMaxHealth;
 $('healthFill').style.width=hp*100+'%';$('targetPct').textContent=Math.ceil(hp*100)+'%';
 $('targetHp').textContent=Math.ceil(combat.targetHealth).toLocaleString()+' / '+combat.targetMaxHealth.toLocaleString();
 $('manaFill').style.width=combat.mana/combat.maxMana*100+'%';$('manaText').textContent=Math.floor(combat.mana).toLocaleString()+' / '+combat.maxMana.toLocaleString();
 const range=combat.distance(player);$('rangeText').textContent=range.toFixed(1)+' yd center';$('positionText').textContent=range.toFixed(1)+' yd';
 $('timeText').textContent=Math.floor(combat.time/60)+':'+String(Math.floor(combat.time%60)).padStart(2,'0');
 $('damageText').textContent=Math.floor(combat.damage).toLocaleString();$('dpsText').textContent=Math.floor(combat.damage/Math.max(combat.time,1)).toLocaleString();
 $('aspectText').textContent=SPELLS[combat.aspect]?.name||'Aspect of the Hawk';$('rapidText').textContent=combat.auras.rapidFire?'Rapid Fire '+Math.ceil(combat.auras.rapidFire-combat.time)+'s':'';
 $('autoText').textContent=!combat.autoShot?'OFF':range<combat.minRangeFor('AutoShot')?'ON · WAITING FOR RANGE':'ON';
 $('autoBtnLabel').textContent=combat.autoShot?'Stop Auto Shot':'Start Auto Shot';
 $('autoTimerToggle').setAttribute('aria-pressed',String(combat.autoShot));
 $('autoTrackToggle').setAttribute('aria-pressed',String(combat.autoShot));
 $('autoTrackToggle').setAttribute('aria-label',(combat.autoShot?'Stop':'Start')+' Auto Shot');
 $('autoTrackToggle').title=(combat.autoShot?'Stop':'Start')+' Auto Shot · '+bindingLabel(bindings.toggleAuto);
 $('autoTrackLabel').textContent='AUTO '+(combat.autoShot?'ON · STOP':'OFF · START')+' ['+bindingLabel(bindings.toggleAuto)+']';
 $('autoTimerToggle').title=(combat.autoShot?'Stop':'Start')+' Auto Shot · '+bindingLabel(bindings.toggleAuto);
 const auras=targetDebuffs(combat);
 $('targetAuras').textContent=auras.map(a=>a.name+' '+auraTime(a.remaining)).join(' · ');
 plateAnchor.set(0,HUMAN_HEIGHT+.5,0).project(camera);
 const plateVisible=!!visible&&combat.targetHealth>0&&plateAnchor.z>=-1&&plateAnchor.z<=1&&Math.abs(plateAnchor.x)<1&&Math.abs(plateAnchor.y)<1;
 drawNameplate({combat,selected:player.targeted,x:(plateAnchor.x+1)*window.innerWidth/2,y:(1-plateAnchor.y)*window.innerHeight/2,visible:plateVisible,auras});
 plateObstacles=[];
 if(plateVisible){
  const bounds=nameplate.getBoundingClientRect(),icons=nameplate.querySelector('.plate-debuffs').getBoundingClientRect();
  const top=auras.length?Math.min(bounds.top,icons.top):bounds.top;
  plateObstacles.push({x:bounds.left+bounds.width/2,y:bounds.bottom,width:Math.max(bounds.width,icons.width),height:bounds.bottom-top});
 }
 const targetReach=combatReach(combat.options.targetCombatReach);
 rangeMarkers.update({reach:targetReach,meleeMax:combat.rangeFor('RaptorStrike'),rangedMin:combat.minRangeFor('AutoShot'),rangedMax:combat.rangeFor('AutoShot')});
 $('targetRangeNote').textContent='Combat reach: '+targetReach.toFixed(1)+' yd (hunter: 1.5 yd). Melee ≤ '+combat.rangeFor('RaptorStrike').toFixed(1)+' yd; dead zone '+combat.rangeFor('RaptorStrike').toFixed(1)+'–'+combat.minRangeFor('AutoShot').toFixed(1)+' yd; ranged ≥ '+combat.minRangeFor('AutoShot').toFixed(1)+' yd. Red selection ring follows the model footprint; colored zones show attack ranges.';
 $('rangeLegend').textContent='Red: selected target · Green: weave / melee ≤ '+combat.rangeFor('RaptorStrike').toFixed(1)+' yd · Amber: dead zone · Gold: ranged ≥ '+combat.minRangeFor('AutoShot').toFixed(1)+' yd';
 const valid=player.targeted&&range>=combat.minRangeFor('AutoShot')&&range<=combat.rangeFor('AutoShot')&&combat.facing(player)&&combat.targetHealth>0;
 $('reticleText').textContent=!player.targeted?'NO TARGET · CLICK DUMMY':combat.targetHealth<=0?'TARGET DEFEATED':valid?'TARGET LOCKED':range<combat.minRangeFor('AutoShot')?'RANGED DEAD ZONE':range>combat.rangeFor('AutoShot')?'OUT OF RANGE':'TURN TO FACE';
 $('reticleText').classList.toggle('invalid',!valid);
 $('castWrap').classList.toggle('visible',!!combat.cast);
 if(combat.cast){
  const cast=combat.cast,elapsed=Math.max(0,combat.time-cast.start);
  const boundary=100*cast.spellDuration/cast.duration;
  const winding=cast.windupDuration>0&&combat.time>=cast.windupStart;
  $('castLabel').textContent=(SPELLS[cast.id]?.name||cast.id)+' · '+(winding?'BOW WINDUP '+Math.max(0,cast.until-combat.time).toFixed(1)+'s':(cast.channel?'CHANNEL ':'CAST ')+Math.max(0,(cast.channel?cast.until:cast.windupStart)-combat.time).toFixed(1)+'s');
  $('castFill').style.width=(100*Math.min(elapsed,cast.spellDuration)/cast.duration)+'%';
  $('castWindupFill').style.left=boundary+'%';
  $('castWindupFill').style.width=(100*Math.max(0,Math.min(cast.windupDuration,elapsed-cast.spellDuration))/cast.duration)+'%';
  $('castBoundary').style.left=boundary+'%';
  $('castBoundary').hidden=cast.windupDuration===0;
 }
 const auto=combat.autoTimer();
 $('autoBar').style.width=(auto.progress*100)+'%';
 $('autoBar').dataset.phase=auto.phase;
 $('autoBarText').textContent=!combat.autoShot?'OFF':auto.phase==='waiting'?'WAIT':auto.phase==='retry'?'RETRY':auto.phase==='ready'?'READY':auto.remaining.toFixed(1)+'s';
 $('windupTick').style.left=(100*auto.swingDuration/auto.duration)+'%';
 $('multiTick').style.left=Math.max(0,100*(1-1.5/auto.duration))+'%';
 $('multiTick').hidden=auto.phase==='waiting'||!combat.autoShot;
 const stats=combat.weaving.snapshot(combat.time,combat.expectedAutoShotAt);
 const seconds=value=>value===null||value===undefined?'—':value.toFixed(2)+'s';
 $('autoDelay').textContent='+'+stats.liveDelay.toFixed(2);
 $('autoDelay').title='Current overdue time; last shot delay: '+seconds(stats.lastDelay);
 $('autoDelay').classList.toggle('late',stats.liveDelay>0.1);
 $('liveRangedDelay').textContent='+'+seconds(stats.liveDelay);
 $('lastAverageDelay').textContent=seconds(stats.lastDelay)+' / '+seconds(stats.averageDelay);
 $('totalWorstDelay').textContent=seconds(stats.totalDelay)+' / '+seconds(stats.worstDelay);
 $('completedWeaves').textContent=stats.weaves;
 $('weaveAway').textContent=seconds(stats.lastWeave?.away)+' / '+seconds(stats.averageAway);
 $('weaveSwings').textContent=(stats.lastWeave?.swings??'—')+' / '+(stats.averageSwings===null?'—':stats.averageSwings.toFixed(1));
 $('returnToShot').textContent=seconds(stats.lastWeave?.returnToShot);
 $('windupClips').textContent=stats.windupClips;
 $('weaveSession').textContent=stats.active?(stats.active.returned===null?'Inside: '+seconds(stats.active.away):'Back in range · waiting for shot')+' · '+stats.active.swings+' swings':stats.shots+' Auto Shots · reset clears stats';
 const meleeMax=combat.rangeFor('RaptorStrike'),rangedMin=combat.minRangeFor('AutoShot');
 const zone=range<=meleeMax?'MELEE':range<rangedMin?'DEAD ZONE':range<=combat.rangeFor('AutoShot')?'RANGED':'OUT OF RANGE';
 const radial=range-lastHudRange;
 lastHudRange=range;
 const recentHit=combat.previousMelee>0&&combat.time-combat.previousMelee<2;
 const inbound=Math.max(0,range-meleeMax)/7;
 const weaveTravel=inbound+(rangedMin-meleeMax)/7;
 const canWeave=combat.lastAutoShot!==null&&combat.time-combat.lastAutoShot<=0.75&&
   range>=rangedMin&&range<=combat.rangeFor('AutoShot')&&combat.facing(player)&&
   combat.nextMelee<=combat.time+inbound&&combat.time+weaveTravel<combat.nextAuto;
 const cue=zone==='MELEE'?(combat.nextMelee-combat.time<0.5?'STRIKE':'MELEE'):
   zone==='DEAD ZONE'?(recentHit&&radial>0.001?'OUT':radial< -0.001?'IN':'DEAD ZONE'):
   zone==='RANGED'?(recentHit&&radial>0.001?'RELEASE':canWeave?'GO':'WAIT'):'';
 $('weaveZone').textContent=zone;
 $('weaveCue').textContent=cue;
 $('weaveFill').style.width=Math.max(0,Math.min(100,100*(rangedMin-range)/(rangedMin-meleeMax)))+'%';
 $('weaveStrip').dataset.zone=zone.toLowerCase().replaceAll(' ','-');
 $('weaveStrip').dataset.cue=cue.toLowerCase().replaceAll(' ','-');
 $('weaveStrip').classList.toggle('inactive',combat.targetHealth<=0||!player.targeted);
 const windupStart=combat.autoWindupStart;
 const windupEnd=combat.autoWindupEnd;
 const windupDuration=0.5;
 const winding=windupStart!==null;
 $('windupBar').style.width=(winding?Math.max(0,Math.min(100,100*(combat.time-windupStart)/windupDuration)):0)+'%';
 $('windupBarText').textContent=winding?Math.max(0,windupEnd-combat.time).toFixed(1)+'s':'WAITING';
 const meleeDuration=Math.max(0.01,combat.nextMelee-combat.previousMelee);
 $('meleeBar').style.width=Math.max(0,Math.min(100,100*(combat.time-combat.previousMelee)/meleeDuration))+'%';
 $('meleeBarText').textContent=combat.time>=combat.nextMelee?'READY':(combat.nextMelee-combat.time).toFixed(1)+'s'; for(const action of ACTIONS){
  const b=buttons.get(action.id);
  const cd=Math.max(0,(combat.cooldowns[action.id]||0)-combat.time);
  const gcd=!SPELLS[action.id].gcdMs?0:Math.max(0,combat.gcdUntil-combat.time);
  const ownCooldown=cd>gcd;
  const remaining=Math.max(cd,gcd);
  const duration=ownCooldown?(combat.cooldownDurations[action.id]||SPELLS[action.id].cooldownMs/1000):combat.gcdDuration;
  const sweep=remaining>0&&duration>0?Math.min(100,100*remaining/duration):0;
  b.classList.toggle('cooling',remaining>0);
  b.querySelector('.action-sweep').style.setProperty('--sweep',sweep+'%');
  const state=combat.abilityState(action.id,player);
  b.classList.toggle('unavailable',!state.usable);
  b.classList.toggle('dry',state.code==='mana');
  b.classList.toggle('proc-ready',state.usable&&state.procRemaining>0);
  b.classList.toggle('queued',state.queued);
  b.dataset.unavailableReason=state.code;
  b.setAttribute('aria-disabled',String(!state.usable));
  const status=state.queued?'QUEUED · press again to cancel':!state.usable?'Unavailable: '+state.reason:state.procRemaining>0?'READY · proc expires in '+state.procRemaining.toFixed(1)+'s':'Ready';
  b.title=b.dataset.description+'\n\n'+status;
  b.setAttribute('aria-label',SPELLS[action.id].name+' · '+status);
  b.querySelector('.action-cooldown').textContent=cd>0?cd>=10?Math.ceil(cd)+'s':cd.toFixed(1):'';
 }
 $('logRows').innerHTML=combat.events.map(e=>`<div class="log-row ${e.kind}"><time>${e.time.toFixed(1)}</time><span>${e.message}</span></div>`).join('');
 if(combat.time>toastUntil)$('toast').classList.remove('visible');
}

const petModel=new THREE.Group();scene.add(petModel);
part(petModel,new THREE.BoxGeometry(.55,.6,1),leather,0,.65,0);
part(petModel,new THREE.SphereGeometry(.26,8,6),cloth,0,.9,.58);
for(const x of [-.23,.23])for(const z of [-.35,.35])part(petModel,new THREE.BoxGeometry(.12,.45,.13),leather,x,.23,z);
const hawkModels=[0,1].map(()=>{const g=new THREE.Group();part(g,new THREE.SphereGeometry(.16,8,6),leather,0,0,0);part(g,new THREE.BoxGeometry(1.1,.04,.2),cloth,0,0,0);scene.add(g);return g});
const trapMarker=ring(1.2,0x80d7ff,.8);
function updateCompanions(){
 petModel.visible=combat.petActive();
 if(petModel.visible){petModel.position.set(combat.pet.x,0,combat.pet.z);petModel.rotation.y=Math.atan2(-combat.pet.x,-combat.pet.z);petModel.scale.setScalar(combat.auras.bestialWrath?1.3:1)}
 hawkModels.forEach((g,i)=>{g.visible=!!combat.hawks[i];if(g.visible){const a=combat.time*3+i*Math.PI;g.position.set(Math.cos(a)*2,3+Math.sin(a)*.2,Math.sin(a)*2);g.rotation.y=-a}})
 trapMarker.visible=!!combat.traps.length;if(trapMarker.visible)trapMarker.position.set(combat.traps[0].x,.04,combat.traps[0].z);
}
$('trainingBtn').onclick=()=>{
 for(const [id,key] of [['sparringOption','sparring'],['enrageOption','enraged'],['hiddenOption','hidden'],['offhandOption','dualWield'],['regenOption','targetRegen']])$(id).checked=combat.options[key];
 $('targetReachOption').value=combat.options.targetCombatReach;
 $('armorOption').value=combat.options.targetArmor;$('targetTypeOption').value=combat.options.targetType;$('petFamilyOption').value=combat.petFamily;
 renderPetSkills();setModal('trainingPanel',true);
};
$('trainingClose').onclick=()=>setModal('trainingPanel',false);
for(const [id,key] of [['sparringOption','sparring'],['enrageOption','enraged'],['hiddenOption','hidden'],['offhandOption','dualWield'],['regenOption','targetRegen']])$(id).onchange=e=>{combat.options[key]=e.target.checked};
for(const type of ['Humanoid','Beast','Demon','Dragonkin','Elemental','Giant','Undead']){const option=document.createElement('option');option.textContent=type;$('targetTypeOption').appendChild(option)}
$('armorOption').onchange=e=>{combat.options.targetArmor=Math.max(0,Math.min(20000,Number(e.target.value)||0))};
$('targetReachOption').onchange=e=>{const value=Number(e.target.value);combat.options.targetCombatReach=combatReach(value);e.target.value=combat.options.targetCombatReach};
$('targetTypeOption').onchange=e=>{combat.options.targetType=e.target.value};
for(const [id,family] of Object.entries(PET_FAMILIES)){const option=document.createElement('option');option.value=id;option.textContent=family.name;$('petFamilyOption').appendChild(option)}
$('petFamilyOption').onchange=e=>{combat.petFamily=e.target.value;combat.pet=null;renderPetSkills()};
$('petAutoOption').onchange=e=>{if(combat.pet)combat.pet.autocast=e.target.checked};
function renderPetSkills(){
 $('petSkills').replaceChildren();
 for(const id of PET_FAMILIES[combat.petFamily].abilities){const button=document.createElement('button');button.textContent=RECORDS[id].name;button.title=describe(RECORDS[id]);button.onclick=()=>{setModal('trainingPanel',false);if(!combat.petActive())showToast('Call your pet first');else combat.petAbility(id,combat.petDamageMultiplier(),Math.hypot(combat.pet.x,combat.pet.z)<=5)};$('petSkills').appendChild(button)}
}
for(const [id,spell] of [['callPetBtn','CallPet'],['revivePetBtn','RevivePet']])$(id).onclick=()=>{setModal('trainingPanel',false);fire(spell)};
$('petHurtBtn').onclick=()=>{if(combat.pet)combat.pet.health=Math.max(0,combat.pet.health-500)};
$('petStunBtn').onclick=()=>{showToast(combat.applyPetControl(5)?'Pet stunned for 5s':'Pet immune or absent')};
$('petDebuffBtn').onclick=()=>{if(combat.pet){combat.pet.debuff='Poison';combat.pet.nextPoison=combat.time+2}};
$('respawnBtn').onclick=()=>{combat.respawnTarget();setModal('trainingPanel',false)};
$('natureHitBtn').onclick=()=>{combat.receiveNatureDamage(300);showToast('Nature damage applied')};
$('endViewBtn').onclick=()=>{delete combat.auras.eyes;delete combat.auras.eagleEye;delete combat.auras.feign;setModal('trainingPanel',false)};
for(const [id,order] of [['petAttack','attack'],['petFollow','follow'],['petStay','stay']])$(id).onclick=()=>{if(!combat.petCommand(order))showToast('Call your pet first')};
requestAnimationFrame(frame);

export function movementSnapshot() {
 return {player:{...player},modelYaw,walking,autorun,mouse:{...mouse},camera:{yaw:rig.yaw,pitch:rig.pitch,pitchBias:rig.pitchBias,distance:rig.distance,targetDistance:rig.targetDistance,clipped:rig.clipped,eye:camera.position.toArray(),fov:camera.fov},avatarVisible:avatar.visible};
}

export function weavingSnapshot(){return {time:combat.time,rangedMin:combat.minRangeFor('AutoShot'),timer:combat.autoTimer(),stats:combat.weaving.snapshot(combat.time,combat.expectedAutoShotAt)};}

export function rangeSnapshot(){return {selectionRadius:selectionRing.geometry.parameters.outerRadius*target.scale.x,modelFootprint:{width:targetModelSize.x,depth:targetModelSize.z,scale:target.scale.x},selectionVisible:selectionRing.visible&&target.visible,bodyRadius:HUMAN_RADIUS*targetHitbox.scale.x,clickRadius:.65*targetClickArea.scale.x,markers:rangeMarkers.snapshot(),meleeMax:combat.rangeFor('RaptorStrike'),rangedMin:combat.minRangeFor('AutoShot'),rangedMax:combat.rangeFor('AutoShot')};}

export function avatarSnapshot(){return {...hunterVisual.snapshot(),projectiles:projectiles.length};}
