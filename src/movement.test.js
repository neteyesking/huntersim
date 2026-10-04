import test from 'node:test';
import assert from 'node:assert/strict';
import {movementAxes, moveDelta, turnDelta, CameraRig, CAMERA_DISTANCE, CAMERA_PITCH, JUMP_SPEED, GRAVITY, AIR_NUDGE_SPEED, stepMovement, cameraCommand, bodyHeading, PressGesture, fallStep, TERMINAL_VELOCITY, selfFade} from './movement.js';

const keys = (...held) => new Set(held);
test('A/D turn by default, but strafe while right mouse is held', () => {
  assert.deepEqual(movementAxes(keys('d'), {left:false,right:false}, false), {forward:0,side:0,turn:-1});
  assert.deepEqual(movementAxes(keys('d'), {left:false,right:true}, false), {forward:0,side:1,turn:0});
  assert.ok(moveDelta(Math.PI,0,1,1).x > 0);
});
test('both mouse buttons run forward, Q/E strafe, S backpedals', () => {
  assert.equal(movementAxes(keys(),{left:true,right:true},false).forward,1);
  assert.equal(movementAxes(keys('q'),{left:false,right:false},false).side,-1);
  assert.equal(moveDelta(Math.PI,-1,0,1).z,4.5);
});
test('keyboard turn rate slows during movement', () => {
  assert.ok(Math.abs(turnDelta(-1,1,true,false)) < Math.abs(turnDelta(-1,1,false,false)));
});
test('left drag orbits independently, right drag can hand yaw to the body', () => {
  const rig=new CameraRig();
  rig.drag(100,30);
  assert.ok(rig.yaw < Math.PI);
  assert.ok(rig.pitch > CAMERA_PITCH);
  const before=rig.yaw;
  rig.update(0.1,Math.PI,false,false);
  assert.equal(rig.yaw,before);
});
test('camera seats behind the head pivot and wheel zoom glides', () => {
  const rig=new CameraRig();
  const seat=rig.seat({x:0,z:0,height:0});
  assert.ok(seat.eye.z > 0);
  assert.ok(seat.eye.y > seat.pivot.y);
  assert.equal(rig.distance,CAMERA_DISTANCE);
  rig.zoom(1);
  rig.update(0.1,Math.PI,false,false);
  assert.ok(rig.distance < CAMERA_DISTANCE);
  assert.ok(rig.distance > CAMERA_DISTANCE-1);
  assert.ok(JUMP_SPEED>7 && GRAVITY>19);
});

test('moving jump keeps its takeoff momentum despite releasing or changing keys', () => {
  const p={x:0,z:0,yaw:0,height:0,jumpVelocity:0,horizX:0,horizZ:0,arcDirsSet:false};
  stepMovement(p,{forward:1,side:0},.02,true);
  const z=p.z;
  stepMovement(p,{forward:0,side:1},.1);
  assert.equal(p.x,0);
  assert.ok(p.z>z);
  assert.ok(Math.abs(p.horizZ-7)<1e-9);
});

test('standing jump accepts one walk-speed air nudge and ignores later steering', () => {
  const p={x:0,z:0,yaw:0,height:0,jumpVelocity:0,horizX:0,horizZ:0,arcDirsSet:false};
  stepMovement(p,{forward:0,side:0},.02,true);
  stepMovement(p,{forward:0,side:1},.02);
  assert.ok(Math.abs(p.horizX+AIR_NUDGE_SPEED)<1e-9);
  stepMovement(p,{forward:1,side:0},.02);
  assert.ok(Math.abs(p.horizX+AIR_NUDGE_SPEED)<1e-9);
  assert.equal(p.horizZ,0);
});

test('jump arc uses configured launch speed and closed-form gravity', () => {
  const p={x:0,z:0,yaw:0,height:0,jumpVelocity:0,horizX:0,horizZ:0,arcDirsSet:false};
  const dt=.1;
  stepMovement(p,{forward:0,side:0},dt,true);
  assert.ok(Math.abs(p.height-(JUMP_SPEED*dt-.5*GRAVITY*dt*dt))<1e-9);
  assert.ok(Math.abs(p.jumpVelocity-(JUMP_SPEED-GRAVITY*dt))<1e-9);
});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const still={forward:0,side:0};
test('diagonal movement normalizes speed and walking uses 2.5 yards per second',()=>{
 close(Math.hypot(...Object.values(moveDelta(0,1,1,1))),7);
 close(Math.hypot(...Object.values(moveDelta(0,-1,1,1))),4.5);
 close(Math.hypot(...Object.values(moveDelta(0,-1,1,1,true))),2.5);
});
test('terminal fall integrates the frame that crosses the cap exactly',()=>{
 const whole=fallStep(-60,.1), first=fallStep(-60,.05), second=fallStep(first.velocity,.05);
 close(whole.velocity,-TERMINAL_VELOCITY);
 close(whole.distance,first.distance+second.distance);
 close(fallStep(-70,.1).distance,-TERMINAL_VELOCITY*.1);
});
test('slow effects cap the one standing-jump air nudge at live run speed',()=>{
 const p={x:0,z:0,yaw:0,height:0,jumpVelocity:0};
 stepMovement(p,still,.02,true,.2);
 stepMovement(p,{forward:1,side:0},.02,false,.2);
 close(p.horizZ,1.4);
});
test('smart camera follows input edges, freezes on stop, and stays idle after orbit',()=>{
 const rig=new CameraRig(0);
 rig.update(0,0,0,false);
 rig.drag(-200,0);
 rig.update(.1,0,0,false);close(rig.yaw,.6);
 rig.update(.05,0,0x10,false);assert.ok(rig.yaw<.6);
 const mid=rig.yaw;
 rig.update(.1,0,0,false);close(rig.yaw,mid);
 rig.update(.3,0,0,false);close(rig.yaw,mid);
 rig.update(.5,0,0x10,false);close(rig.yaw,0);
 rig.yaw=.2;
 rig.update(.5,0,0x10,false);close(rig.yaw,.2);
});
test('releasing orbit while running arms follow; additional movement does not restart it',()=>{
 const rig=new CameraRig(0);
 rig.update(0,0,0x12,true);rig.drag(-300,0);
 rig.update(.05,0,0x10,false);
 const elapsed=rig.follow.elapsed;
 rig.update(.05,0,0x90,false);close(rig.follow.elapsed,elapsed+.05);
 rig.update(1,0,0x90,false);close(rig.yaw,0);
 assert.equal(cameraCommand(keys('w','s'),{left:false,right:false},false),0x30);
});
test('click release uses time and angular travel thresholds',()=>{
 const quick=new PressGesture(0,10,20);quick.motion(100,100);assert.equal(quick.release(.19),true);
 const drag=new PressGesture(0,10,20);drag.motion(20,0);assert.equal(drag.release(.3),false);
 const click=new PressGesture(0,10,20);click.motion(1,1);assert.equal(click.release(.79),true);
 assert.equal(click.release(.8),false);click.cancelled=true;assert.equal(click.release(.1),false);
});
test('body steering holds a 90 degree limit, catches up on release, and strafes through front',()=>{
 close(bodyHeading(0,1,still,false,true,.1),0);
 close(bodyHeading(0,2,still,false,true,.1),2-Math.PI/2);
 close(bodyHeading(0,1,still,false,false,.1),1);
 const yaw=bodyHeading(Math.PI/2,0,{forward:0,side:1},false,false,1/60);
 assert.ok(yaw<Math.PI/2&&yaw>0);
 close(bodyHeading(0,1,still,true,true,.1),1);
});
test('floor camera collision snaps inward, eases outward, and preserves view direction',()=>{
 const rig=new CameraRig(0),p={x:0,z:0,height:0};rig.pitch=-.8;
 const clipped=rig.seat(p,1/60);close(clipped.eye.y,.3);assert.ok(clipped.look.y>clipped.eye.y);
 const distance=rig.collisionDistance;rig.pitch=.2;rig.seat(p,1/60);
 assert.ok(rig.collisionDistance>distance&&rig.collisionDistance<rig.distance);
});
test('first person has a finite forward view and hides the hunter',()=>{
 const rig=new CameraRig(0);rig.distance=0;
 const seat=rig.seat({x:0,z:0,height:0});
 close(seat.alpha,0);close(Math.hypot(seat.look.x-seat.eye.x,seat.look.y-seat.eye.y,seat.look.z-seat.eye.z),1);
 close(selfFade(.1+1.8315/2),.5);
});
test('smart pivot rotates the view while the clipped arm stays still, then eases home',()=>{
 const rig=new CameraRig(0),p={x:0,z:0,height:0};rig.pitch=-.3;
 rig.seat(p,.02);const pitch=rig.pitch;
 rig.drag(0,-20);close(rig.pitch,pitch);assert.ok(rig.pitchBias<0);
 rig.seat(p,.02);const bias=rig.pitchBias;
 rig.seat(p,.01,true);assert.ok(rig.pitchBias>bias);
 rig.seat(p,1,true);close(rig.pitchBias,0);
});
