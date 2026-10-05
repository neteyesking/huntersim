# Hunter Training Ground agent guide

This repository contains the playable Three.js Hunter dummy encounter. Make browser game changes here. The combat catalog is derived from Forever simulator data.

## Work locally

Use Node.js 22 or newer. Run npm install and npm run dev from the repository root. Verify with npm test and npm run build. Use npm run build:pages for the separate Pages output.

The browser files are src/main.js (scene, input, HUD and render loop), src/movement.js (movement and camera), src/combat.js (encounter mechanics and event output), src/scale.js (yards, capsules and attack range), src/bindings.js (keybinds), src/style.css (HUD), and src/hunter-data.json (extracted Forever data). Tests are adjacent to source files. tools/extract-hunter.py regenerates hunter data from Forever. Read README.md for current scope and known approximations.

## Gameplay behavior

Read MOVEMENT.md for movement constants, camera transitions, jump momentum and current limitations. Combat text supports four concurrent texts per unit, a 1.5 s lifetime, white physical damage, gold spell damage, a critical size pop, and upward motion for ordinary numbers and misses.

Use the exported Hunter spell and talent data for combat changes. The browser's combat model is a playable approximation, not a direct execution of Forever's Go simulator. Keep that distinction explicit in docs and UI. Use original geometry and UI; no WoW assets.

## Editing workflow

Check the current game file and documented behavior first. Make the change in the game, add focused tests where mechanics can regress, run tests and build, then verify the running page. When the dev server is already running, let Vite reload; verify that the page reflects the latest files. Update README.md when scope or controls change. Future chats should read this file before editing.
## Complete Hunter catalog

Read COVERAGE.md before changing an ability or talent. It maps all 51 talents and groups all 60 exported ability records, and lists effects still limited by the training environment. src/catalog.js owns action pages, talent gates, description rendering and talent prerequisite validation. src/combat.js owns pet lifecycle/abilities, traps, defensive sparring, target state and the combat timers. Keybinds are derived from the catalog; add abilities there so every input remains bindable.

The expanded regression suite is src/coverage.test.js. Its all-ability execution pass catches missing handlers but does not establish numeric live-game parity. Keep focused outcome tests for changed mechanics. Supplemental spell-store records and approximations must remain identified in COVERAGE.md.

Prefer atomic file replacement and verify the running page after edits. Keep existing release servers running unless a task explicitly requires restarting them.

Action-bar availability must come from Combat.abilityState(), which canCast() also uses. Keep the HUD and execution checks together there; do not duplicate range or proc rules in main.js. src/availability.test.js checks the transitions, and tools/browser-check.mjs checks icon states after walking into melee.

Read MOVEMENT.md before changing physics, camera, or input handling. src/movement.js owns the numeric rules; src/main.js owns browser input and rendering. tools/movement-browser-check.mjs tests the integration through real key/mouse input. The exported movementSnapshot() returns copied state for browser debugging; it must not become a mutation API.

Auto Shot display uses Combat.autoTimer() and autoSwingStart. Do not use lastAutoShot as the bar start after melee; it remains the timestamp for interval measurements. src/weaving.js tracks release delays and completed melee weaves. Keep measurement updates in combat, not the render loop. See README.md for metric definitions and tools/weaving-browser-check.mjs for the input-driven check.

Keep documentation and test utilities portable. Do not commit machine-specific paths, private network addresses, or temporary share URLs. Browser checks receive BROWSER_DEBUG_URL and GAME_URL through their environment; the data exporter receives its input directory through --source.

Auto Shot swing, windup and release run independently of spell casts and channels. Do not gate ranged autos on Combat.cast or reuse a spell windup for the Auto Shot display. Movement during windup still cancels it; target, range and facing checks remain active.

Target nameplate rendering and debuff snapshots live in src/nameplate.js. Read existing combat expiry timestamps; do not maintain separate aura timers in the HUD. main.js projects the overhead anchor each frame and passes the plate bounds to combat-text-layout.js to keep damage numbers clear.

SV Weave talents and saved-build fallback are in src/presets.js; src/weave-guide.js owns the How to content. Keep the talent string aligned with Forever's SurvivalWeaveTalents and distinguish its APL from manual movement and queued Raptor Strike in this game. Preserve valid saved builds when changing defaults.

Production caching is handled by vite.config.js and the self-contained tools/release-loader.js embedded in built HTML. Emit release.json with every build and publish it alongside assets and HTML. Keep hashed assets and a unique release ID; do not replace the inline loader with a bundle that stale HTML might be unable to fetch.

Combat reach and body radius are separate. The grounded 1.12 range model in scale.js uses a 1.5 yd hunter reach and configurable targetCombatReach (default 1.5): melee max(5, both reaches + 4/3), nonzero ranged minimum plus both reaches, ranged maximum plus both reaches and range bonuses. No moving-target leeway applies to a stationary dummy. The red selection ring follows the original model's standing horizontal bounds: sqrt(0.5 * hypot(width, depth)), then model scale. Measure bounds before adding rings, click volumes or debug overlays; never resize the selection ring from combat reach. Keep body overlays and click volumes independent of combat reach. src/range-markers.js draws the melee/dead-zone bands and ranged boundaries from Combat methods. rangeSnapshot() is read-only; tools/hitbox-browser-check.mjs verifies geometry and ability states. Read README.md for evidence and the remaining vertical/server tolerances. Auto Shot uses the current Forever timing: first windup on activation, windup included in subsequent hasted weapon periods, 0.5 s movement retries and automatic resume on ranged re-entry after melee. Start that reset once even while moving; stopping must not restart it.

Combat accepts rangedWeaponSpeed in its second constructor argument (default 2.8 s); timer and weapon damage read this value. src/weaving.test.js verifies a 3.0 s weapon as 2.5 s before windup plus 0.5 s windup. The entire Auto Shot bar is a Start/Stop button showing the configured key; keep it synchronized with the encounter button and bow toggle. Automatic ranged resume after melee is an intentional training convenience, not a claim that the 1.12 input flow switches attacks by itself.

src/hunter-avatar.js owns the generic human mesh and procedural limb/weapon poses. Feed it combat timers and visual events from main.js; never make animations authoritative for damage or swing timing. Arrows launch from the bow and Multi-Shot draws three; dispose each projectile mesh on impact/reset. avatarSnapshot() is read-only and tools/avatar-browser-check.mjs verifies actual draw/release and melee-weave transitions. Browser debug imports must use the page's main-module script URL including its Vite query to avoid a second game instance.

Melee animation has raise, cut and recovery phases in hunter-avatar.js, sharing MELEE_ANIMATION_DURATION with main.js. Keep separate ranged-release and melee-event state so simultaneous events cannot erase a sword swing. The browser animation check samples actual blade-tip motion for white hits and Raptor Strike; an animation label alone does not verify a visible swing.
