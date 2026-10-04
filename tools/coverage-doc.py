import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'src/hunter-data.json').read_text())
behaviors={
'deadlyAspects':'White-hit proc chance; Hawk ranged haste and Beast melee haste.',
'enduranceTraining':'Pet maximum health and incoming physical mitigation.',
'focusedFire':'Hunter and pet damage while a living pet is active.',
'improvedAspectOfTheMonkey':'Hunter dodge and half of the aspect dodge bonus for the pet.',
'pathfinding':'Cheetah and Pack run speed; jump momentum stays locked at takeoff.',
'improvedRevivePet':'Revive cast time, mana cost and health restored.',
'bestialSwiftness':'Pet approach and follow speed.',
'unleashedFury':'Tamed pet, Summon Hawk impact and guardian damage.',
'improvedMendPet':'Mend mana discount and poison removal rolls each tick.',
'ferocity':'Pet, guardian and Summon Hawk critical chance.',
'summonHawk':'Unlocks the shot and two timed hawk guardians.',
'spiritBond':'Health regeneration for hunter and active pet at the ranked interval.',
'intimidation':'Unlocks the next landed pet attack critical, threat and stun effect.',
'bestialDiscipline':'Pet focus regeneration and hunter mana regeneration while casting.',
'frenzy':'Pet critical hits can grant the timed attack-speed buff.',
'bestialWrath':'Unlocks pet damage, size and control immunity.',
'hawkEye':'Ranged shot range; does not extend melee or Hunter’s Mark.',
'improvedConcussiveShot':'Concussive Shot stun chance.',
'lethalAttacks':'Hunter critical chance.',
'improvedStings':'Serpent damage, Scorpid duration and Viper cooldown.',
'efficiency':'Shot, Sting and melee ability costs.',
'carefulAim':'Intellect contributes to melee and ranged attack power.',
'rapidKilling':'Rapid Fire cooldown and the next-shot bonus after defeating the target.',
'improvedArcaneShot':'Arcane cooldown and its shared lockout with Summon Hawk.',
'loneWolf':'Hunter damage while no living pet is active.',
'trueshotAura':'Unlocks the ranged attack power aura.',
'mortalShots':'Ranged critical damage bonus.',
'improvedSerpentSting':'Serpent periodic damage bonus.',
'rapidRecuperation':'Mana regeneration after Serpent application or consuming Rapid Killing.',
'barrage':'Aimed Shot, Multi-Shot and Volley damage.',
'scatterShot':'Unlocks weapon damage and damage-breakable disorient; stops Auto Shot.',
'rangedWeaponSpecialization':'Ranged weapon damage.',
'sniperShot':'Unlocks long cast and three range-buff charges; misses retain charges.',
'improvedTracking':'Hunter damage against the selected tracked creature type.',
'deflection':'Parry chance against sparring attacks.',
'entrapment':'Root duration when a trap triggers.',
'savageStrikes':'Melee special critical chance.',
'survivalist':'Hunter maximum health.',
'improvedWingClip':'Wing Clip root chance.',
'cleverTraps':'Control trap duration and damaging trap damage.',
'surefooted':'Hit chance and reduced incoming daze duration.',
'deterrence':'Unlocks timed dodge and parry.',
'survivalTactics':'Trap and Feign Death success chance.',
'predatorsEdge':'Melee critical damage and optional offhand damage.',
'counterattack':'Unlocks a parry-gated weapon strike and root.',
'resourcefulness':'Melee/trap mana discount and critical-hit mana regeneration proc.',
'exposePrey':'Landed attacks against a marked target can enable Mongoose Bite.',
'survivalistsDiscipline':'Trap and Deterrence cooldown reduction.',
'striderKick':'Unlocks weapon damage and a short movement-speed increase.',
'lightningReflexes':'Agility multiplier feeding attack power and critical chance.',
'laceratingStrikes':'Mongoose Bite applies a bleed based on the damage it dealt.',
}
assert set(behaviors)=={t['field'] for tree in data['talents'] for t in tree['talents']}
text="""# Hunter gameplay coverage

## Scope and evidence

The browser has handlers for 60 Hunter ability records (59 spell buttons plus Auto Shot), all 51 talents, and 19 pet families. This is playable training coverage. Exact live-game parity has not been established.

The data exporter reads a supplied Forever spell store, generated Hunter spell ranks, talent trees, talent rank curves, and pet families. Effects that Forever intentionally skips for its damage simulation are implemented here from their data and descriptions.

src/catalog.js owns categories, talent gates, descriptions, and talent validation. src/combat.js owns mechanics. src/main.js owns controls, geometry and HUD. src/coverage.test.js exercises all Hunter handlers and meaningful interactions. No game media assets are used.

## Ability coverage

| Abilities | Training behavior |
| --- | --- |
| Auto Shot, Arcane Shot, Aimed Shot, Multi-Shot | Ranged attacks, projectile travel, dead zone, facing, cast interruption, weapon windup and shared cooldowns. Multi-Shot has one available target. |
| Serpent Sting, Scorpid Sting, Viper Sting | One Sting slot; damage ticks, incoming hit reduction or target mana drain. Final ticks occur at expiration. |
| Hunter’s Mark, Rapid Fire, Sniper Shot | Mark attack power, both attack-speed bonuses, cast haste and charged ranged reach. |
| Raptor Strike, Mongoose Bite, Wing Clip, Counterattack, Strider Kick | Queued replacement swing, reactive strike, slow/root, parry-gated attack and movement buff. |
| Summon Hawk | Direct hit, shared Arcane cooldown and up to two temporary attacking guardians. |
| Concussive Shot, Scatter Shot, Scare Beast | Slow, disorient and Beast-only fear. Fear/disorient prevent dummy sparring and break on damage. The stationary dummy does not run away. |
| Distracting Shot, Disengage, Tranquilizing Shot | Threat gain, threat reduction and removal of the training target’s enrage. Disengage has no leap. |
| Volley | Interruptible channel with damage each second. |
| Immolation, Explosive, Freezing and Frost Traps | Placement at the hunter, two-second arming, proximity trigger, shared cooldown, damage/periodic damage or control. |
| Deterrence, Feign Death | Avoidance buff; resisted or successful threat reset and attack suppression. Movement or another spell ends feigning. |
| Hawk, Beast, Monkey, Cheetah, Pack and Wild Aspects | Exclusive aspects: attack power, dodge, movement/daze, Nature mitigation. Pack affects this solo hunter. |
| Trueshot Aura | Ranged attack power buff. No other party members exist. |
| Call, Dismiss, Revive, Mend and Feed Pet | Pet lifecycle, interrupted casts/channels, health, focus, healing, poison cleanse and happiness recovery. Food is unlimited in training. |
| Intimidation, Bestial Wrath | Pet critical/stun/threat effect and damage/control immunity. |
| Tame Beast | Beast-only channel creates the selected training pet. There is no tameable world population or pet stable. |
| Beast Training | Opens pet family, ability and autocast controls. Training-point purchases are outside the current equipment model. |
| Eyes of the Beast, Eagle Eye | Pet movement control and remote camera view. End the view in Training settings. Eagle Eye looks at the training target area. |
| Beast Lore | Reports training Beast health, armor and diet. |
| Flare, Enchanted Flare | Reveals the stealthed training dummy. The arena has no magical darkness or separate invisible units. |
| Track Beasts, Demons, Dragonkin, Elementals, Giants, Humanoids and Undead | Exclusive tracked type, used by Improved Tracking. |
| Track Hidden | Reveals the training target. There is no minimap population. |
| Lacerate, Aspect of the Falcon | Supplemental spell-store records with bleed or combined aspect effects. Their current live availability is unverified. |

Every Hunter ability above has a keybinding entry. Pet attack/follow/stay and family abilities, including Growl and Cower, also have binding entries.

## Talent coverage

Rank curves are read directly: for example, Barrage is 3/7/10, Ferocity is 2/4/6/8/10, and Efficiency is 3/6/9/12/15. The interface enforces lower-tier spending, prerequisites, maximum ranks and the 51-point budget. Refunds cannot invalidate a dependent talent.

"""
for tree in data['talents']:
 text+='### '+tree['name']+'\n\n| Talent | Applied behavior |\n| --- | --- |\n'
 for t in tree['talents']:text+='| '+t['name']+' | '+behaviors[t['field']]+' |\n'
 text+='\n'
text+="""## Training controls

Use the action-bar pages to find every spell. Use **Training** to select target type, enrage, stealth, armor and health regeneration; enable sparring; choose a pet; wound, poison or stun it; apply Nature damage; restore the target; or end a remote view. Restore target preserves hunter cooldowns and procs, allowing Rapid Killing practice after a kill.

Sparring attacks every two seconds while the hunter is in melee range or an attacking pet has higher threat. It provides a controlled way to test dodge, parry, threat, Scorpid Sting and defensive talents. It is a simple encounter model.

## Verification

- npm test: combat, movement, camera and weaving tests, including an execution pass over all 60 Hunter abilities and damage checks for all 19 pet families.
- npm run build: production bundle.
- tools/browser-check.mjs: headless Chrome CDP check of action pages, 51 talent entries, talent persistence, training settings, pet call/order, keybinds and runtime exceptions. It expects BROWSER_DEBUG_URL and GAME_URL to identify an isolated Chrome profile with the game open. Run with Node 22 and a screenshot output directory.
- These checks verify the browser implementation; they are not a numeric comparison against a running game or the entire Go simulator.

## Remaining parity limits

- Fixed training weapons, stats, base mana assumptions and 22 mana/second baseline. No gear import, ammunition inventory, full spell/physical attack tables, weapon skill, glancing blows, block, partial resists or racial mechanics.
- Spell rank base values are extracted; general level scaling from each effect’s PPL field is not evaluated. Unknown spell-mask exceptions still need systematic comparison.
- Outgoing spell outcomes and damage are generally resolved at impact. Snapshot timing is simplified; Serpent reads current attack power at each tick. Lacerating Strikes uses the landed bite damage.
- Pet health/armor inheritance, Nature resistance, threat switching, utility ranges, trap arming/proximity and control duration behavior are training models. Full pet training passives, loyalty, happiness decay, resistances, pathfinding, crowd-control diminishing returns and immunity categories are incomplete.
- Pet control immunity has a generic stun test. Improved Mend Pet removes the training poison; the full dispel taxonomy is absent. Lava Breath exposes a cast-slow aura but the dummy has no spell rotation. Roots and slows show their state; the target stays stationary.
- Frost Trap is represented by a timed target slow. Ground fields, area targeting, multiple units, party distribution and creature AI are not fully represented.
- The supplemental records listed above should not be treated as proof that a live Hunter can learn them.
- Forever itself marks Serpent’s attack power coefficient, Sniper charge spending and Lacerating Strikes interpretation as needing in-game verification.
- The user-requested Auto Shot cycle is the complete weapon swing followed by a separate 0.5-second windup. Preserve this behavior unless intentionally revisiting that requirement.
- Flat-ground movement and camera remain the documented training approximation. Terrain, camera collision, slopes, swimming and line of sight remain outside this arena.

## Next work for another chat

Read AGENTS.md, this document and the relevant Forever spell implementation first. Work in **HunterSimGame**, regardless of the initial working directory. Extend the existing handler and focused tests together. Do not make an unimplemented effect appear selectable without a corresponding state or gameplay effect. Preserve source uncertainty in the coverage notes.
"""
(root/'COVERAGE.md').write_text(text)
