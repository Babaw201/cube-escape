# CORE Environment Implementation Plan

**Goal:** implement issue #22 as a decorative, modular layer across five levels.
**Architecture:** Three.js r128 UMD factory; instanced batches per material; no gameplay RNG.
**Tech Stack:** existing Three.js, node:test, Canvas and Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-core-design.md

**User correction:** author geometry in Python for Blender. Primary source is now
`scripts/blender/build_core.py`; ship editable `core-source.blend`, exported
`core-kit.glb`, and `core-blender-models.js` for instanced game placement. Keep the
procedural module only as the immediate loading/error fallback.

## Global Constraints

No gameplay/difficulty/score/account changes. Preserve T=4, H=2.8, grid/BFS,
dynamic door roots, generation RNG, camera and coop. No new runtime dependency,
dynamic lights or shadows. No production deployment.

## Review Focus

- Dynamic openings reveal wall faces that were initially hidden.
- Low quality and reduced motion remove ambient effects while preserving phase cues.
- Delayed GLB after disposal never resurrects objects or leaks resources.
- Quality changes never restart play or mutate seeded generation.
- Top-down/coop camera sees through ceilings and peripheral reactor does not occupy spawn.

### Task 1: reference corridor and reusable kit

- [ ] Add tests/core-environment.test.cjs for bounds, instancing, deterministic output,
  disposal, low quality, and isolated corridor rendering; run RED.
- [ ] Create core-environment.js: create(THREE) exposes build(options), themes, qualities;
  build returns group, wallMaterial, accentMaterial, ceiling, update, dispose, stats.
- [ ] Capture reference corridor before/after using the actual Three.js geometry.
- [ ] Run targeted tests and commit corridor implementation before five-level integration.

### Task 2: progressive five-sector integration

- [ ] Hook index.html build0/animate/disposeTree without changing generation logic.
- [ ] Add dynamic door detail under existing door roots; build all possible exposed faces.
- [ ] Add distinct sectors, perimeter equipment, floor platform, wave/Titan indicators.
- [ ] Add graphics-settings.js/menu.js quality UI with storage/reduced-motion support.
- [ ] Compare gameplay fingerprints with original snapshot for all levels/seeds/coop.
- [ ] Run targeted tests and commit integration.

### Task 3: optional assets and evidence

- [ ] Add bounded optional GLB slot loader with procedural fallback and disposal tests.
- [ ] Add browser tests: accessibility, quality, five levels, draw calls, restart memory,
  door collision, load failure, render screenshots/metrics on fixed seed.
- [ ] Run npm test and npm run test:browser; record real results and environment limits.
- [ ] Review the whole change, commit, push feature branch through GitHub connector,
  open PR linked to #22, inspect CI. Do not merge or deploy.
