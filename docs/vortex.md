# VORTEX

Seventh robot, an experimental gravity controller built by CORE. Unlock it by **reaching wave 20 in level 5**; the reward is saved immediately and recovered from existing level-5 survival history. Spectre and Souverain remain at waves 50 and 100.

## Controls and balance

- **IMPLOSION:** one violet sphere every 0.5 s, speed 19 units/s, lifetime 1.5 s, one hit of damage, 50% movement slow for 1.2 s. Stops at walls. Existing level-4 tracker stun rules still apply.
- **SINGULARITÉ:** U / local player 2: I / touch: ULTI. Place a field 1.35 units ahead, falling back to the player position when the placement path is obstructed. Radius 5.5 units, lifetime 3 s, six one-damage ticks at 0.5 s intervals, cooldown 28 s. No invulnerability or shield.
- Pull speed is 4.2 units/s; Titans receive 28% of that pull. Targets require unobstructed sight. Movement is swept in steps of at most 0.12 units using the current collision grid, with a larger Titan clearance. Closed/dynamic walls block attraction and damage.

## Rendering and future GLB

**The main VORTEX model is now authored in Python with Blender**, using `scripts/build_vortex.py`. The self-contained `assets/models/vortex.glb` is loaded by the existing Three.js r128 robot loader; `assets/models/vortex.blend` is the editable source with its render studio. See [Python build and model details](vortex-blender.md).

`robot-models.js` preserves the three Blender arm pivots, reactor and gimbals, batches static armor by material, and shares geometry/materials across players and the shop. Reactor emission and the energy links remain independent per instance. Idle orbit, movement lean and ultimate deployment reuse the existing animation state. `rig.group` remains the gameplay/collision root, `rig.robot` owns aiming/visibility, and `rig.visualRoot` is the replaceable visual subtree.

`vortex.js` still owns the immediate procedural fallback and reusable projectile/effect pools. A missing, blocked or invalid GLB keeps the animated fallback fully playable. The upgraded model adds no lights or runtime dependencies. A singularity uses 24 point sprites, and at most 12 closing/impact pulses are active. Rebuilds release active objects to the pools before world disposal.

## Network

The existing host validates input, life, pause and cooldown. Guests send only the existing `u`/`f` intentions; they never apply gravity damage or displacement. Snapshots append a gravity flag to projectiles, slow duration to drones, and the `gv` list `[id, owner, x, z, remaining]`. Stable IDs reconcile visuals without restarting them. Impact waves use the existing event queue. Missing `gv` means no active field, so legacy snapshots remain readable.

## Validation

Run `npm test` and `npm run test:browser`. VORTEX tests cover rig budgets and sharing, animation independence, pool recycling, swept collision, damage/slow, duration/expiry, Titans, unlock persistence, valid history, both local players and host/guest authority. Browser tests cover the locked/unlocked shop, preview and gameplay WebGL, keyboard and touch; they write desktop/mobile screenshots to `artifacts/vortex-*.png`, uploaded by CI.
