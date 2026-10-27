# VORTEX

Seventh robot, an experimental gravity controller built by CORE. Unlock it by **reaching wave 20 in level 5**; the reward is saved immediately and recovered from existing level-5 survival history. Spectre and Souverain remain at waves 50 and 100.

## Controls and balance

- **IMPLOSION:** one violet sphere every 0.5 s, speed 19 units/s, lifetime 1.5 s, one hit of damage, 50% movement slow for 1.2 s. Stops at walls. Existing level-4 tracker stun rules still apply.
- **SINGULARITÉ:** U / local player 2: I / touch: ULTI. Place a field 1.35 units ahead, falling back to the player position when the placement path is obstructed. Radius 5.5 units, lifetime 3 s, six one-damage ticks at 0.5 s intervals, cooldown 28 s. No invulnerability or shield.
- Pull speed is 4.2 units/s; Titans receive 28% of that pull. Targets require unobstructed sight. Movement is swept in steps of at most 0.12 units using the current collision grid, with a larger Titan clearance. Closed/dynamic walls block attraction and damage.

## Rendering and future GLB

`vortex.js` owns the procedural visual factory, animation and reusable projectile/effect pools. It uses the vendored Three.js r128. Fixed armor parts are batched by material; each arm keeps an independent pivot. Instances share hull geometry and materials while the core emission and energy links stay independent. There are no new lights or runtime dependencies. A singularity uses 24 point sprites, and at most 12 closing/impact pulses are active. Rebuilds release active objects to the pools before world disposal.

`rig.group` remains the gameplay/collision root, `rig.robot` owns aiming/visibility, and **`rig.visualRoot` is the replaceable visual subtree**. A later Blender import can replace `visualRoot` without touching player state, attacks, saves or packets. Keep the model within the existing two-unit footprint, center it around the current core, expose three arm pivots and a core material, and adapt `animate` to those named parts. Do not replace `group`, `robot` or `repere`; keep any shared GLB resources registered with the existing `LimbyrinthRobotModels` disposal system.

## Network

The existing host validates input, life, pause and cooldown. Guests send only the existing `u`/`f` intentions; they never apply gravity damage or displacement. Snapshots append a gravity flag to projectiles, slow duration to drones, and the `gv` list `[id, owner, x, z, remaining]`. Stable IDs reconcile visuals without restarting them. Impact waves use the existing event queue. Missing `gv` means no active field, so legacy snapshots remain readable.

## Validation

Run `npm test` and `npm run test:browser`. VORTEX tests cover rig budgets and sharing, animation independence, pool recycling, swept collision, damage/slow, duration/expiry, Titans, unlock persistence, valid history, both local players and host/guest authority. Browser tests cover the locked/unlocked shop, preview and gameplay WebGL, keyboard and touch; they write desktop/mobile screenshots to `artifacts/vortex-*.png`, uploaded by CI.
