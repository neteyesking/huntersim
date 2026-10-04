const PI = Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const RUN_SPEED = 7;
export const BACK_SPEED = 4.5;
export const WALK_SPEED = 2.5;
export const TURN_RATE = PI;
export const JUMP_SPEED = 7.955547;
export const GRAVITY = 19.291105;
export const TERMINAL_VELOCITY = 60.148003;
export const AIR_NUDGE_SPEED = WALK_SPEED;
export const CAMERA_DISTANCE = 15;
export const CAMERA_LIMIT = 15;
export const CAMERA_PIVOT = 1.9002692;
export const CAMERA_PITCH = 10 * PI / 180;
export const MOUSE_RATE = 0.003;

export function movementAxes(keys, mouse, autorun) {
  const forward = Math.sign(Number(keys.has('w')) + Number(mouse.left && mouse.right) + Number(autorun) - Number(keys.has('s')));
  const side = Math.sign(Number(keys.has('e')) - Number(keys.has('q')) + (mouse.right ? Number(keys.has('d')) - Number(keys.has('a')) : 0));
  const turn = mouse.right ? 0 : Number(keys.has('a')) - Number(keys.has('d'));
  return {forward, side, turn};
}

export function cameraCommand(keys, mouse, autorun) {
  let word = Number(mouse.right) | (Number(mouse.left) << 1) | (Number(autorun) << 12);
  for (const [key, bit] of [['w',0x10],['s',0x20],['q',0x40],['e',0x80],['a',0x100],['d',0x200]]) {
    if (keys.has(key)) word |= bit;
  }
  return word;
}

export function moveDelta(yaw, forward, side, dt, walking = false) {
  const length = Math.hypot(forward, side) || 1;
  const speed = walking ? WALK_SPEED : forward < 0 ? BACK_SPEED : RUN_SPEED;
  return {
    x: (Math.sin(yaw) * forward - Math.cos(yaw) * side) / length * speed * dt,
    z: (Math.cos(yaw) * forward + Math.sin(yaw) * side) / length * speed * dt,
  };
}

export function fallStep(velocity, dt) {
  const end = velocity - GRAVITY * dt;
  if (end >= -TERMINAL_VELOCITY) return {velocity:end, distance:(velocity + end) * .5 * dt};
  if (velocity <= -TERMINAL_VELOCITY) return {velocity:-TERMINAL_VELOCITY, distance:-TERMINAL_VELOCITY * dt};
  const crossing = (velocity + TERMINAL_VELOCITY) / GRAVITY;
  return {velocity:-TERMINAL_VELOCITY, distance:(velocity - TERMINAL_VELOCITY) * .5 * crossing - TERMINAL_VELOCITY * (dt - crossing)};
}

export function stepMovement(player, axes, dt, jumpRequested = false, speedMultiplier = 1, walking = false) {
  const grounded = player.height <= 0 && player.jumpVelocity <= 0;
  const input = moveDelta(player.yaw, axes.forward, axes.side, 1, walking);
  const pressing = axes.forward !== 0 || axes.side !== 0;
  if (grounded) {
    player.horizX = input.x * speedMultiplier;
    player.horizZ = input.z * speedMultiplier;
    if (jumpRequested) {
      player.jumpVelocity = JUMP_SPEED;
      player.arcDirsSet = pressing;
    }
  } else if (pressing && !player.arcDirsSet) {
    const length = Math.hypot(input.x, input.z);
    const nudge = Math.min(WALK_SPEED, RUN_SPEED * speedMultiplier);
    player.horizX = length ? input.x / length * nudge : 0;
    player.horizZ = length ? input.z / length * nudge : 0;
    player.arcDirsSet = true;
  }
  const dx = player.horizX * dt, dz = player.horizZ * dt;
  player.x += dx;
  player.z += dz;
  if (!grounded || jumpRequested) {
    const fall = fallStep(player.jumpVelocity, dt);
    player.height += fall.distance;
    player.jumpVelocity = fall.velocity;
    if (player.height <= 0) {
      player.height = 0;
      player.jumpVelocity = 0;
      player.arcDirsSet = false;
    }
  }
  return {dx, dz, moving: Math.abs(dx) + Math.abs(dz) > 1e-6};
}
export function turnDelta(turn, dt, translating, airborne) {
  return turn * TURN_RATE * (translating || airborne ? 0.75 : 1) * dt;
}
export function angleDifference(to, from) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function bodyHeading(modelYaw, faceYaw, axes, airborne, steering, dt) {
  if (axes.side) {
    const offset = -axes.side * (axes.forward ? PI / 4 : PI / 2) * (axes.forward < 0 ? -1 : 1);
    const current = angleDifference(modelYaw, faceYaw);
    return faceYaw + current + (offset - current) * (1 - Math.exp(-17.26 * dt));
  }
  if (axes.forward || airborne) return faceYaw;
  const delta = angleDifference(faceYaw, modelYaw);
  const step = Math.max(Math.abs(delta) - PI / 2, 0) + (steering ? 0 : dt * TURN_RATE * 8);
  return modelYaw + Math.sign(delta) * Math.min(step, Math.abs(delta));
}

export class PressGesture {
  constructor(time, x, y) { Object.assign(this, {time, x, y, yaw:0, pitch:0, cancelled:false}); }
  motion(dx, dy) { this.yaw += Math.abs(dx * MOUSE_RATE); this.pitch += Math.abs(dy * MOUSE_RATE); }
  release(time) {
    const elapsed = time - this.time;
    return !this.cancelled && (elapsed < .2 || (elapsed < .8 && this.yaw < 2.25 * PI / 180 && this.pitch < 2 * PI / 180));
  }
}

export function selfFade(distance, near = .1) {
  const d = distance - near;
  return d <= .00278 ? 0 : d >= 1.8315 ? 1 : .5 * (1 - Math.cos(PI * d / 1.8315));
}

export class CameraRig {
  constructor(yaw = PI) { this.reset(yaw); }
  reset(yaw = PI) {
    Object.assign(this, {yaw, pitch:CAMERA_PITCH, distance:CAMERA_DISTANCE, targetDistance:CAMERA_DISTANCE,
      follow:null, lastCommand:null, collisionDistance:CAMERA_DISTANCE, clipped:false,
      pitchBias:0, biasReturn:null, translating:false});
  }
  releaseBias() {
    if (!this.biasReturn && Math.abs(this.pitchBias) >= .001) this.biasReturn = {from:this.pitchBias, elapsed:0, duration:Math.abs(this.pitchBias) / (PI / 2)};
  }
  drag(dx, dy) {
    const yawDelta = -dx * MOUSE_RATE, pitchDelta = dy * MOUSE_RATE;
    this.yaw += yawDelta;
    const gate = !this.translating && this.pitch <= 0 && this.clipped;
    const displaced = !this.biasReturn && Math.abs(this.pitchBias) >= .001;
    let integrate = true;
    if (displaced || (gate && Math.abs(pitchDelta) > 0 && Math.abs(yawDelta) < .05)) {
      this.pitchBias += pitchDelta;
      if (this.pitch < 0) this.pitchBias = Math.max(this.pitchBias, -89 * PI / 180 - this.pitch);
      this.biasReturn = null;
      if (this.pitchBias <= 0 && this.pitch < 0) integrate = false;
    }
    if (integrate) {
      this.releaseBias();
      this.pitch = clamp(this.pitch + pitchDelta, -89 * PI / 180, 89 * PI / 180);
    }
    this.follow = null;
  }
  zoom(notches) { this.targetDistance = clamp(this.targetDistance - notches, 0, CAMERA_LIMIT); }
  carryTurn(delta) { this.yaw += delta; }
  update(dt, faceYaw, command, lookHeld) {
    this.distance += clamp(this.targetDistance - this.distance, -8.33 * dt, 8.33 * dt);
    const previous = this.lastCommand;
    this.lastCommand = command;
    if (lookHeld) { this.follow = null; return; }
    if (previous !== null && previous !== command) {
      const active = (command & 0x13f0) !== 0 || (command & 3) === 3;
      if (!active) this.follow = null;
      else if (!this.follow) {
        const offset = angleDifference(this.yaw, faceYaw);
        if (Math.abs(offset) >= .001) this.follow = {offset, elapsed:0, duration:clamp(Math.abs(offset) / PI, .1, 2)};
      }
    }
    if (!this.follow) return;
    this.follow.elapsed += dt;
    const t = Math.min(1, this.follow.elapsed / this.follow.duration);
    this.yaw = faceYaw + this.follow.offset * (1 + Math.cos(PI * t)) / 2;
    if (t === 1) this.follow = null;
  }
  seat(player, dt = 0, translating = false) {
    this.translating = translating;
    const pivot = {x:player.x, y:player.height + CAMERA_PIVOT, z:player.z};
    const forward = {x:Math.sin(this.yaw) * Math.cos(this.pitch), y:-Math.sin(this.pitch), z:Math.cos(this.yaw) * Math.cos(this.pitch)};
    const head = {...pivot, y:player.height + 2.0277777 - .30555};
    const boom = {x:-forward.x * this.distance, y:pivot.y - head.y - forward.y * this.distance, z:-forward.z * this.distance};
    const length = Math.hypot(boom.x, boom.y, boom.z);
    // The flat arena's floor is a plane; a 0.3 yd sphere touches it at eye.y = 0.3.
    this.clipped = head.y + boom.y < .3;
    const open = this.clipped ? length * clamp((head.y - .3) / -boom.y, 0, 1) : length;
    this.collisionDistance = open < this.collisionDistance || dt === 0 ? open : this.collisionDistance + (open - this.collisionDistance) * (1 - Math.exp(-6 * dt));
    const fraction = length ? clamp(this.collisionDistance / length, 0, 1) : 0;
    const eye = {x:head.x + boom.x * fraction, y:head.y + boom.y * fraction, z:head.z + boom.z * fraction};
    const viewPitch = this.pitch + this.pitchBias;
    const look = {x:eye.x + Math.sin(this.yaw)*Math.cos(viewPitch), y:eye.y - Math.sin(viewPitch), z:eye.z + Math.cos(this.yaw)*Math.cos(viewPitch)};
    if (!translating && this.pitch <= 0 && this.clipped) this.biasReturn = null;
    else this.releaseBias();
    if (this.biasReturn) {
      this.biasReturn.elapsed += dt;
      const t = Math.min(1, this.biasReturn.elapsed / this.biasReturn.duration);
      this.pitchBias = this.biasReturn.from * (1 + Math.cos(PI*t)) / 2;
      if (t === 1) this.biasReturn = null;
    }
    return {pivot, eye, look, alpha:selfFade(Math.hypot(eye.x-pivot.x, eye.y-pivot.y, eye.z-pivot.z))};
  }
}