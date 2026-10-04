# Hunter Training Ground

A browser playable Hunter dummy encounter with original procedural geometry. No game art, models, textures, sounds, or UI assets are included.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Run `npm test` for the focused combat checks and `npm run build` for a production bundle.

## Controls

- W / S: forward and backward
- A / D: turn, or strafe while right mouse is held
- Q / E: strafe left and right
- Both mouse buttons: run forward and steer
- Left click dummy: target it; left click empty ground: clear target
- Left drag: orbit camera
- Right drag: aim and turn
- Mouse wheel: zoom
- N: autorun
- Numpad divide: toggle walk / run (rebindable)
- Space: jump
- 1–0, minus, equals: action bar
- T: Auto Shot
- Click Talents to spend points in all three trees; right click to refund. Builds save locally and enforce tier, prerequisite and point limits.

The **Keybinds** button (default **B**) edits movement, camera mouse buttons and wheel directions, every Hunter ability, and encounter/UI commands. Click a row and press the new input; a conflict prompt lets you move a binding from another command. Bindings save in this browser. Each command has one binding; use Restore defaults to reset them. Holding the orbit and steer mouse buttons together still runs forward.
## Sources and current scope

`tools/extract-hunter.py` extracts spell IDs, range, cost, cast time, cooldown, effects, and the three talent tree layouts from a supplied Forever data directory. Regenerate `src/hunter-data.json` after changing Forever's data:

```sh
python3 tools/extract-hunter.py --source "$SIMULATOR_SOURCE"
```

The combat engine has training handlers for 63 Hunter ability records, all 51 talents and 19 pet families. Use the action-bar pages for the expanded spellbook, and **Training** for pet selection, sparring, target creature type, armor, enrage, stealth and health regeneration. Pet attack/follow/stay buttons sit beneath the hunter frame. All Hunter and pet abilities have keybinding entries.

Read [COVERAGE.md](COVERAGE.md) for the complete ability and talent mapping, source evidence, checks and remaining parity limits. The browser remains a training approximation with fixed equipment and a simplified combat table. It does not execute Forever's Go simulator, and its utility, pet, trap and encounter models are not fully verified against the live game. Supplemental spell-store records are labeled in Training settings.

Movement and camera behavior support the flat training arena. See [MOVEMENT.md](MOVEMENT.md) for exact values, input transitions, checks and remaining limits. Ground movement buffs do not change gravity, vertical launch speed or existing airborne momentum.

## Yard scale

One Three.js world unit is one yard; each grid square is one yard. Both hunter and dummy use a 2.0278 yd tall, 0.30555 yd radius human male capsule for the optional hitbox overlay. Combat reach is a separate 1.5 yd per human. Auto Shot starts at 8 yd between body centers. The browser still pads its 35 yd maximum by both combat reaches, making the outer limit 38 yd. Melee stays at the game's 5 yd floor. Toggle **Show hitboxes** in the encounter panel to inspect the two capsules. Forever's non-spatial simulator reads a single scalar distance against its raw spell limits; the browser uses the 8 yd gameplay dead-zone boundary and a target-aware outer range for this 3D encounter.

The HUD shows Auto Shot swing, its 0.5 second windup, and the melee white hit timer. Global cooldown appears as a radial sweep on each locked ability icon; ability-specific cooldowns use the same sweep with a numeric timer. Auto Shot completes the ranged weapon swing before its separate 0.5 second windup; movement cancels an active windup. Multi-Shot uses an original three arrow icon.
## Combat display

The browser HUD has a tall gold Auto Shot swing bar, a thin white melee bar, a windup marker, a Multi-Shot timing marker, an Auto Shot delay readout, and a cast bar shown during casts. The colored weave strip distinguishes melee, dead zone, ranged and out-of-range positions. Its GO/IN/STRIKE/OUT/RELEASE hints use exact 3D distance plus current shot and melee timers; GO estimates the travel needed at the current 7 yd/s run speed. Learned travel timing, shot prediction windows and latency measurements are not implemented.
## Jump and scrolling combat text

Jump movement uses a flat-ground arc: 7.955547 yd/s vertical launch, 19.291105 yd/s² gravity, and closed-form vertical displacement each frame. The hunter keeps the horizontal velocity set at takeoff even when keys are released or facing changes. A jump from rest can take one direction nudge at the lower of 2.5 yd/s and the current run speed; further midair key changes do not steer it. The camera sweeps against the flat floor. Decorative props have no body or camera collision; slopes, swimming, mounts, knockback and fall damage are not represented.

Damage and miss outcomes now appear as world-anchored text above the dummy. The browser uses a four-text cap, 1.5 s lifetime, 2 yd rise for ordinary text, crit pop, and white physical versus gold spell coloring. Text is reprojected as the camera moves. The font rendering and overlap solver are browser approximations.
## Combat text and attack poses

Combat text uses screen-space overlap checks after projecting each number from the dummy. New numbers stay closest to the dummy; concurrent numbers shift sideways enough to avoid covering one another, including during a critical hit's size pop. The hunter raises the bow during the Auto Shot windup and ranged casts, recoils when a shot fires, and uses a simple sword swing for melee white hits, Raptor Strike, and Mongoose Bite. The bow and sword are original procedural geometry; these poses are visual approximations.
## Ranged cast and windup timing

The Auto Shot swing bar marks the full ranged weapon speed first, followed by a separate 0.5 second bow windup. A 3.0 second bow therefore starts windup at 3.0 seconds and releases at 3.5 seconds. The first Auto Shot follows that same sequence. Aimed Shot, Multi-Shot, and Sniper Shot also show their listed cast followed by the final bow windup as two phases in the cast bar. Rapid Fire shortens both phases in the current combat model.
## Target selection

The dummy starts selected. Release a left click on its model or red ground ring to select it; click elsewhere in the 3D scene to clear selection. Camera drags and both-button movement do not change selection, except for short flicks classified as clicks (see MOVEMENT.md). The target frame and red ring appear only while selected. Ranged and melee attacks require a selected target; self abilities remain usable. Clearing the target interrupts a current cast.
## Handoff and checks

- Read [AGENTS.md](AGENTS.md) before editing from another task.
- src/catalog.js contains spell pages, talent gates, data descriptions and build validation.
- src/combat.js contains combat, pet, control, trap and regeneration state.
- src/coverage.test.js covers the expanded ability and talent interactions.
- Run npm test and npm run build after mechanics changes.
- tools/browser-check.mjs verifies the UI using an isolated headless Chrome debugging session. See COVERAGE.md for its setup.

## Action usability

Ability icons turn grey whenever the same combat checks used by casting reject them: range, facing, missing target, unlearned talent, reactive proc, pet requirement, mana, movement, another cast, ability cooldown or GCD. Hover an icon for the current reason. Cooldown sweeps and numbers remain readable.

Mongoose Bite and Counterattack glow only while their proc is active and the ability is otherwise usable. Raptor Strike displays its queued state and can still be cancelled after leaving melee range or losing mana. Cast-time spells and channels require standing still; instant attacks remain usable while moving.

## Weaving stats and Auto Shot restarts

The right-hand **Weaving** tab shows current ranged delay, last/average delay, total/worst delay, completed weaves, last/average time inside ranged distance, main-hand swings per weave, return-to-shot time and interrupted Auto Shot windups. Switch to **Combat log** for individual events. The column scrolls on short screens. Reset encounter clears all measurements.

Delay is actual Auto Shot release minus the expected release scheduled by the previous shot (its hasted weapon swing plus the separate 0.5 s windup), floored at zero. The live value grows while overdue; completed intervals feed total, average and worst. The first shot has no prior interval. Disabling Auto Shot, clearing the target, defeat, or entering a remote/feign view discards the pending interval and unfinished weave. Delays include movement, casting, range/facing loss and the melee reset; they are not exclusively attributed to weaving and can include frame timing granularity.

A weave starts when you cross below 8 yd after firing an Auto Shot. It completes on the next ranged Auto Shot after returning, provided at least one main-hand white or Raptor Strike swing occurred. Swing attempts include misses; offhand, pet and instant melee abilities do not increment this count. Time inside includes the dead zone. Return-to-shot includes any movement or casting after returning and the restarted swing/windup. Multiple excursions before the next shot belong to one cycle.

After a melee swing, Auto Shot shows an empty bar and WAIT until shooting can resume in range while stationary and facing the target. The resumed swing starts at zero and fills through the full weapon swing, then its 0.5 s windup. The old shot timestamp remains available for delay measurements; it is no longer the display's start time. Interrupted windups also reset the displayed swing when movement restarts the weapon timer. Merely crossing the dead zone without a melee swing does not reset the weapon timer.

src/combat.js owns autoSwingStart and autoTimer(); the HUD consumes that phase/progress rather than rebuilding timing. src/weaving.js owns measurements. src/weaving.test.js covers timing and aggregation. tools/weaving-browser-check.mjs drives a real ranged–melee–ranged pass and checks the bar, stats, tab switch and reset through the isolated Chrome session. weavingSnapshot(), exported from main.js, returns copied timer and measurement data for read-only debugging.

## GitHub Pages

The repository remote is git@github.com:neteyesking/huntersim.git. The Pages workflow deploys the built game from the default branch.

1. Push the game source, package-lock.json and .github/workflows/pages.yml to the repository's default branch.
2. In GitHub, open Settings → Pages and choose GitHub Actions as the build source.
3. Push a change or run Deploy Hunter game to GitHub Pages from the Actions tab. The workflow only deploys the repository's default branch.
4. The deploy job reports the published URL; a standard project site is https://neteyesking.github.io/huntersim/.

The workflow installs dependencies, runs tests, builds, and uploads only the generated site. npm run build:pages writes dist-pages/ with relative asset URLs, so the game works beneath the repository path. The regular npm run build writes dist/. The two build outputs are independent.

GitHub Pages serves the game independently of this PC after deployment. Keybinds and talents are stored per browser and site origin. See the [GitHub Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).
## Portable browser checks

Set BROWSER_DEBUG_URL to an existing Chrome debugging endpoint and GAME_URL to the game tab's URL before running a browser check. Pass the screenshot output directory as the first argument. These values are supplied by the environment rather than recorded in the repository.

The optional data exporter requires SIMULATOR_SOURCE to identify the input data directory used by the --source argument above. Building and playing the game use the checked-in catalog and do not require that directory.
