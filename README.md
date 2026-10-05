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

The combat engine has training handlers for 60 Hunter ability records, all 51 talents and 19 pet families. Use the action-bar pages for the expanded spellbook, and **Training** for pet selection, sparring, target creature type, armor, enrage, stealth and health regeneration. Pet attack/follow/stay buttons sit beneath the hunter frame. All Hunter and pet abilities have keybinding entries.

Read [COVERAGE.md](COVERAGE.md) for the complete ability and talent mapping, source evidence, checks and remaining parity limits. The browser remains a training approximation with fixed equipment and a simplified combat table. It does not execute Forever's Go simulator, and its utility, pet, trap and encounter models are not fully verified against the live game. Supplemental spell-store records are labeled in Training settings.

Movement and camera behavior support the flat training arena. See [MOVEMENT.md](MOVEMENT.md) for exact values, input transitions, checks and remaining limits. Ground movement buffs do not change gravity, vertical launch speed or existing airborne momentum.

## Yard scale

One Three.js world unit is one yard; each grid square is one yard. The original hunter and dummy bodies have a 2.0278 yd height and 0.30555 yd radius human capsule overlay. Body radius and **combat reach** are separate values. Training exposes **Target combat reach (yd)**, default 1.5 yd; the hunter also has 1.5 yd combat reach.

Grounded range checks use the stationary 1.12 range equations, measured center to center:

- Melee maximum: `max(5, hunter reach + target reach + 4/3)`.
- Nonzero ranged minimum: `spell minimum + hunter reach + target reach`.
- Ranged maximum: `spell maximum + hunter reach + target reach + flat range bonus`.
- A spell with a zero minimum keeps that zero minimum.

For the default human reaches this gives melee up to 5 yd, a 5–11 yd dead zone, and Auto Shot from 11 to 38 yd before talents. A target reach of 5 yd gives melee up to 7.833 yd and Auto Shot from 14.5 to 41.5 yd. The melee floor means that shrinking a target does not reduce melee reach below 5 yd. Moving alone toward a stationary dummy grants no leeway; the reference's movement bonus requires both units to qualify.

Green ground shading marks the melee/weave area, amber marks the dead zone, gold marks the ranged minimum, and blue marks the ranged maximum. Labels, marker geometry, ability availability and swing checks read the same combat boundaries and update with combat reach, talents and range buffs. The red selection ring follows the original model's standing footprint: local radius `sqrt(0.5 * hypot(width, depth))`, multiplied by model scale. Bounds are measured before selection and debug geometry are added. This follows the 1.12 footprint sizing rule using our own procedural geometry. Combat reach changes the colored range zones; it does not resize the selection ring, body overlay or model. src/range-markers.js owns the ground visuals; rangeSnapshot() exposes copied geometry and combat boundaries for tools/hitbox-browser-check.mjs.

The range equations were checked against the 1.12 `GetMinMaxRange` implementation (0x6e3480), its `IsTargetInRange` checks and default unit combat reach. Server validation is separate: [VMaNGOS spell validation](https://github.com/vmangos/core/blob/development/src/game/Spells/Spell.cpp) and [melee reach checks](https://github.com/vmangos/core/blob/development/src/game/Objects/Unit.cpp) also use combat reach, with server-specific tolerances and vertical rules. This is evidence from an emulator, not proof of Forever's live server behavior. This arena uses horizontal distances on its flat ground; vertical range and server lag tolerances are not simulated. Forever's non-spatial simulator compares a single scalar distance to raw spell limits; imported spell rows remain unchanged.

The HUD shows Auto Shot swing, its 0.5 second windup, and the melee white hit timer. Global cooldown appears as a radial sweep on each locked ability icon; ability-specific cooldowns use the same sweep with a numeric timer. Auto Shot includes its fixed 0.5 second windup within the ranged weapon cycle; movement cancels an active windup and schedules a 0.5 second retry. Multi-Shot uses an original three arrow icon.
## Combat display

The browser HUD has a tall gold Auto Shot swing bar, a thin white melee bar, a windup marker, a Multi-Shot timing marker, an Auto Shot delay readout, and a cast bar shown during casts. The colored weave strip distinguishes melee, dead zone, ranged and out-of-range positions. Its GO/IN/STRIKE/OUT/RELEASE hints use exact 3D distance plus current shot and melee timers; GO estimates the travel needed at the current 7 yd/s run speed. Learned travel timing, shot prediction windows and latency measurements are not implemented.
## Jump and scrolling combat text

Jump movement uses a flat-ground arc: 7.955547 yd/s vertical launch, 19.291105 yd/s² gravity, and closed-form vertical displacement each frame. The hunter keeps the horizontal velocity set at takeoff even when keys are released or facing changes. A jump from rest can take one direction nudge at the lower of 2.5 yd/s and the current run speed; further midair key changes do not steer it. The camera sweeps against the flat floor. Decorative props have no body or camera collision; slopes, swimming, mounts, knockback and fall damage are not represented.

Damage and miss outcomes now appear as world-anchored text above the dummy. The browser uses a four-text cap, 1.5 s lifetime, 2 yd rise for ordinary text, crit pop, and white physical versus gold spell coloring. Text is reprojected as the camera moves. The font rendering and overlap solver are browser approximations.
## Combat text and attack poses

Combat text uses screen-space overlap checks after projecting each number from the dummy. New numbers stay closest to the dummy; concurrent numbers shift sideways enough to avoid covering one another, including during a critical hit's size pop. The original generic human has a face, hair, tunic, boots, quiver, and articulated shoulders, elbows, hips and knees. The bow hand and drawing hand follow a two-segment arm pose. Auto Shot draws the bowstring and nocked arrow during its actual windup; ranged casts also draw the bow. Release recoils the drawing hand and launches an arrow from the bow, with three arrows for Multi-Shot. Melee white hits and melee abilities trigger a sword follow-through; Raptor Strike has a stronger slash and gold trail. The bow is carried on the back in melee, and the sword rests at the hip during ranged attacks. These original procedural poses are visual approximations driven by combat events; they do not determine hit timing or damage.
## Ranged cast and windup timing

The first Auto Shot opens with a 0.5 second windup. Later cycles include that windup within the hasted weapon speed: a 3.0 second bow begins its next windup 2.5 seconds after release and fires at 3.0 seconds. The training bow uses 2.8 seconds before haste. Aimed Shot, Multi-Shot and Sniper Shot retain their separate spell-cast and bow-windup phases; this Auto Shot correction does not change their cast times.

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

Delay is actual Auto Shot release minus the expected release scheduled by the previous shot (its hasted weapon period, which includes the 0.5 s windup), floored at zero. The live value grows while overdue; completed intervals feed total, average and worst. The first shot has no prior interval. Disabling Auto Shot, clearing the target, defeat, or entering a remote/feign view discards the pending interval and unfinished weave. Delays include movement, range/facing loss and the melee reset; they are not exclusively attributed to weaving and can include frame timing granularity.

A weave starts when you cross below the current ranged minimum after firing an Auto Shot. It completes on the next ranged Auto Shot after returning, provided at least one main-hand white or Raptor Strike swing occurred. Swing attempts include misses; offhand, pet and instant melee abilities do not increment this count. Time inside includes the dead zone. Return-to-shot includes any movement after returning and the restarted swing/windup. Multiple excursions before the next shot belong to one cycle.

After a melee swing, Auto Shot shows an empty bar and WAIT until the hunter returns to legal ranged distance facing the target. The resumed swing starts once on crossing back into range, even while moving. Stopping does not reset it again. Its last 0.5 seconds are the windup; a ready shot waits for stationary movement checks before winding up. The old shot timestamp remains available for delay measurements. Merely crossing the dead zone without a melee swing does not reset the weapon timer. Auto Shot stays enabled and resumes automatically; the clickable Auto Shot timer (Start/Stop and its current key shown on the bar), encounter button, bow button and configured key can explicitly turn it off or on.

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

## Auto Shot during casts

Auto Shot has its own swing and 0.5 s windup. It can start, continue and release while another spell is casting or channeling, including Aimed Shot, Multi-Shot and Volley. Starting a spell during its windup does not interrupt or postpone it. The Auto Shot windup row always shows that independent timer; the spell cast bar shows the spell's own phases.

Movement during the Auto Shot windup cancels it and schedules a retry 0.5 seconds later. While moving, a ready shot retries every 0.5 seconds; the first eligible check begins a fresh windup. Movement before the shot is ready does not reset the swing clock. Target, range and facing requirements and explicit Auto Shot stop effects still apply. Spell casting alone adds no ranged delay or interrupted-windup count.

## Target nameplate

The overhead nameplate follows the dummy in the world and shows health, level and selection highlighting. Click its health bar to target the dummy. Original CSS borders and symbols use no game assets. Debuff icons show Hunter's Mark, the active Sting, damage-over-time effects and control effects with remaining time and stack counts where available. Timers read the encounter state and clear on expiry, replacement, target restoration or reset. The plate hides for a defeated, hidden or off-screen target. Combat text avoids the nameplate and debuff row.

Run tools/nameplate-browser-check.mjs with BROWSER_DEBUG_URL, GAME_URL and a screenshot output directory to check aura timers, replacement, movement anchoring and click targeting.

## SV Weave preset and guide

New or invalid talent storage starts with Forever's SV Weave talents: 0/20/31, encoded as -00530501114-550200030050220151. Existing valid saved builds, including an intentionally empty build, remain available. Talents and How to both offer Load SV Weave & reset: this applies the build, saves it, resets the encounter, dismisses the pet, removes the offhand and places the hunter 0.25 yd beyond the current ranged minimum. Weapons remain the training equipment.

Open How to (F2 by default) for setup, the melee swing window, spell priority, windup rules and weaving metrics. Both opening the guide and loading the preset are rebindable. The guide displays current ability keybinds.

The preset and priority are based on Forever's SurvivalWeaveTalents and Melee Weave priority list: Hawk, no pet for Lone Wolf, Hunter's Mark upkeep, melee windows, Mongoose Bite when available, Strider Kick, missing Serpent Sting, Arcane Shot, then Multi-Shot if cast plus travel fits before the next weave. Aimed Shot and Summon Hawk are disabled in this preset. Raptor Strike is an automatic swing replacement in the simulator; the player queues it manually in this game. The simulator's movement guard uses a ready-on-arrival melee swing and at least one second until the next ranged auto, with its source 5 yd melee and 8 yd ranged boundaries. The practice arena adds both combat reaches to the nominal ranged minimum, so allow more travel time than the source preset. The arena restarts the hasted ranged period on re-entry after melee, with the windup included.

## Release caching

Every production build has a unique release ID. Pages uses commit SHA, workflow run and attempt; local builds use a timestamp and random suffix. Vite still fingerprints JS and CSS contents. The production HTML embeds a small loader that fetches release.json with a unique query and cache: no-store, then loads that release's JS and CSS with a version query. Cached HTML from releases with this loader can load the newest assets without relying on its old bundle filenames.

Open visible tabs check for updates each minute and on focus. Update & reload preserves the URL's other parameters and fragment, and loads the current version; the encounter resets, while saved talents and keybinds remain in browser storage. Offline version checks fall back to the HTML's own release; asset failures get one recovery reload per release per tab, then a manual retry message. This controls browser requests, not GitHub Pages' CDN headers. A page opened before this loader was added needs one refresh to acquire it. Development continues to use Vite's live reload.

Cache verification: build two directories with different HUNTER_RELEASE_ID values, then run tools/release-browser-check.mjs with both directory paths and BROWSER_DEBUG_URL. It serves deliberately stale HTML against the second build's assets and checks version queries, update detection and retained storage. The temporary fixture binds to the debug endpoint hostname unless RELEASE_TEST_HOST is set.

The 3.0 s Auto Shot regression checks use an explicit weapon speed: 2.5 s until windup, then 0.5 s until release, both for repeated shots and manual re-enable after melee. The equipped training bow remains 2.8 s. Auto-resume after a melee weave is a training convenience selected for this arena. In the 1.12 input flow, starting melee cancels the ranged auto-repeat and starting Auto Shot ends the melee attack. Individual shot releases arrive from the server; local input and animation code alone do not establish server-side swing timing. The melee reset used here follows current Forever simulator behavior.

## Human model and animation checks

src/hunter-avatar.js owns the original model, limb posing, bowstring, carried weapons and sword trail. main.js feeds it combat windup/cast progress and shoot/melee events, and launches visual arrows. Keep Auto Shot release and melee contact tied to combat events; do not infer attacks from animation completion. Movement and collision use the existing player state. Model height stays 2.0277777 yd.

Run tools/avatar-browser-check.mjs with BROWSER_DEBUG_URL, a development GAME_URL and a screenshot output directory. It observes bow draw, released projectiles, queued Raptor Strike, melee readiness and the return to ranged through real movement inputs. avatarSnapshot() returns copied pose and geometry values for inspection. Import the page's actual main-module script URL when inspecting a Vite session, including its update query, to avoid creating a second game instance.
