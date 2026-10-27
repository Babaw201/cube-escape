# VORTEX — Python / Blender visual upgrade

**Goal:** Replace the procedural VORTEX visual with a substantially more polished model authored by a reproducible Blender Python script, integrated into the existing playable seventh robot and PR #23.
**Spec:** The original VORTEX brief plus the user's request to make it in Python and make it beautiful. Gameplay remains in the existing browser engine; Python authors the actual 3D asset.
**Approach:** Use installed Blender 4.3, export a self-contained glTF 2.0 GLB, preserve the existing immediate procedural fallback and extend the established cached robot loader. No Python runtime or new dependency is needed in the browser.

## Deliverables and checks

- [x] Author `scripts/build_vortex.py`: intentional asymmetric triangular hull, three independently named floating arm assemblies, violet reactor and cyan rings, beveled black/anthracite armor, restrained gold trims and technical detailing. Export `assets/models/vortex.glb`, editable `vortex.blend`, metadata and a studio beauty render. Export no studio objects, lights, camera or external textures in the GLB. Target <= 14,000 triangles and <= 40 batched draw calls.
- [x] Add real-GLB tests first, then extend `robot-models.js` and VORTEX creation to load, batch, fit, animate and safely dispose the Blender asset. Preserve arm pivots, individual core emission, movement lean, deployment and energy links; shared cached resources survive disposal of another rig. Missing/offline models retain the existing animated fallback.
- [x] Inspect the actual Blender render and verify a floating corridor-sized silhouette, independent simultaneous rigs, unchanged abilities/rewards and all six existing robots locally. Add actual loaded VORTEX browser coverage for desktop/mobile previews and matches; full validation follows in CI.
- [ ] Run full project test suites via CI, update PR #23 and provide the Python source plus a visual preview.

## Progress

- Existing PR #23 is open and unmerged; upstream main remains c8dd992. Continue the same dedicated branch and PR.
- Blender 4.3.2 is installed. Existing r128 GLTFLoader, geometry batching, asynchronous cache/fallback and disposal system will be reused. Existing gameplay, saves and host authority remain the integration contract.
- The actual Blender export has 13,932 triangles, seven materials, 30 batched meshes, no external textures or scene lights. The 1280×1280 CPU studio render was generated and inspected.
- All three new integration tests pass against the actual GLB, as do 34 existing game tests and eight existing VORTEX gameplay tests. Independent review found an incorrect ring normal after Blender's coordinate conversion; the plane-preservation regression failed first and passes after the fix. No other important review findings remain.
