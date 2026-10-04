# Movement and camera reference

The game uses original Three.js geometry. Its movement equations and camera controls are described below. One world unit is one yard. This document describes the implemented flat-ground subset, not full world-physics parity.

## Movement rules

| Behavior | Browser behavior |
| --- | --- |
| Ground speed | Run 7 yd/s, backpedal 4.5 yd/s, walk 2.5 yd/s; normalized diagonals |
| Keyboard turn | 180 degrees/s standing; 135 degrees/s translating or airborne |
| Jump and fall | Launch 7.955547 yd/s, gravity 19.291105 yd/s², terminal fall 60.148003 yd/s; exact displacement through the terminal-speed crossing |
| Air movement | Horizontal takeoff velocity remains fixed. A standing jump gets one direction nudge at min(walk, live run speed) |
| Mouse look and click | 0.003 radians per pixel on each axis; pitch limited to ±89 degrees; orbit starts on press; steering aligns facing every frame |
| Smart follow | Input-word changes arm a cosine yaw return; duration abs(offset)/180 degrees/s, clamped to 0.1–2 s. Idle/stop cancel. Held look owns the camera. An equivalent in-flight transition is not restarted |
| Zoom | 15 yd initial/default maximum, 0 yd minimum, 1 yd wheel steps, 8.33 yd/s glide |
| Framing | 45 degree vertical FOV, 0.1 yd near clip, human pivot 1.9002692 yd above feet |
| Camera floor collision | Analytic 0.3 yd sphere sweep from human head to desired seat against y=0; snap inward and return outward at 1-exp(-6*dt) |
| Smart pivot | Stationary, clipped, upward view: vertical drag biases view without rotating the arm; returns with cosine easing at 90 degrees/s when released |
| First-person fade | Cosine opacity across 1.8315 yd after near clip; hidden at distance-minus-near ≤0.00278 yd. View direction remains defined at zero zoom |
| Body heading | Strafe heading ±90 degrees or ±45 diagonally, mirrored backward; offset easing at 17.26/s. Standing steer allows 90 degrees of twist; release catches up at 8× turn rate |

The browser faces +Z at yaw zero. Browser pitch is positive downward. Preserve these conventions when changing formulas.

## Input behavior

- A/D turn; while right mouse is held they strafe. Q/E always strafe.
- Left mouse orbits independently. Right mouse aligns hunter facing even if no mouse-motion event arrives.
- Both buttons run forward and steer. Entering that chord cancels autorun and pending clicks. Releasing one continues the remaining button's operation.
- W/S keydown cancels autorun. Jumping and losing focus do not cancel autorun. Losing focus clears held keys and mouse buttons.
- Target selection occurs on release. A press counts as a click if it lasted less than 0.2 s, or less than 0.8 s with less than 2.25 degrees yaw travel and 2 degrees pitch travel. Travel accumulates before pitch clamping. A very short flick therefore remains a click by design.
- Numpad divide toggles walking; Keybinds can change it. The other bindings continue to use their saved values.
- Camera follow responds to raw input edges, including W+S together, rather than polling whether the character moved. Releasing orbit while moving starts a return; releasing while idle leaves the view in place.
- First-person zoom fades the procedural hunter. Camera direction is calculated independently of the pivot, including when collision shortens the arm.

## Integration and limits

src/movement.js owns the equations, follow state, click classification and body heading. src/main.js handles input ownership, selection, pointer lock, camera projection, procedural pose and opacity. src/bindings.js owns bindable controls.

The arena is an infinite flat y=0 movement surface with a finite visual ground mesh. Decorative perimeter posts and plinths remain noncolliding. There are no slopes, steps, terrain seams, walls, ceilings, liquids, moving platforms, mounts, knockback, feather fall or fall damage. These need a world collision model with capsule, slide and step handling. Camera floor clipping is exact for the plane; arbitrary geometry sweeps are not implemented.

The fixed human body uses the requested 2.0277777 yd height and 0.30555 yd radius. Body turns, leg swings and upper-body aim use original procedural geometry. Remote pet views retain the simplified human camera framing. Terrain tilt and head bob are absent. Camera follow uses the default Smart style; settings for other styles and server-driven tracking/fear are absent. The browser retains a 50 ms frame-delta cap. Pointer lock is subject to browser focus and permission rules.

## Checks and browser debugging

Run npm test and npm run build from the game directory. src/movement.test.js checks numeric speeds, normalized diagonals, air momentum, terminal falls, follow transitions, click thresholds, body yaw, floor clipping, smart pivot and zero-distance view.

With BROWSER_DEBUG_URL and GAME_URL set for an isolated Chrome debugging session, run tools/movement-browser-check.mjs with a screenshot output directory as its argument. It sends real keyboard/mouse input and checks jumping, walking, orbit selection, right-press steering, right+D strafing, target clearing, first person and runtime errors. tools/browser-check.mjs covers the broader combat UI.

For read-only browser inspection, import('/src/main.js').then(m => m.movementSnapshot()) returns copied player, camera and input state. Do not drive movement by mutating internal state in browser tests.