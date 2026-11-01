// Limbyrinth survival drone steering.
// Original integration for Limbyrinth; informed by the inertial pursuit used by
// Gal Lind's Sky Combat (MIT). See THIRD_PARTY_NOTICES.md for attribution.
// Keep this module independent of THREE so the same movement can be unit-tested.
(function (root) {
  'use strict';

  function step(position, motion, direction, speed, delta, canMove, responsiveness = 7) {
    const dt = Math.min(0.05, Math.max(0, Number(delta) || 0));
    if (!dt) return { vx: motion.vx || 0, vz: motion.vz || 0 };

    const length = Math.hypot(direction.x || 0, direction.z || 0);
    const dx = length > 1e-5 ? direction.x / length : 0;
    const dz = length > 1e-5 ? direction.z / length : 0;
    const limit = Math.max(0, Number(speed) || 0);
    // Frame-rate independent approach to the desired velocity.
    const blend = 1 - Math.exp(-Math.max(0, responsiveness) * dt);
    motion.vx = (motion.vx || 0) + (dx * limit - (motion.vx || 0)) * blend;
    motion.vz = (motion.vz || 0) + (dz * limit - (motion.vz || 0)) * blend;
    const actual = Math.hypot(motion.vx, motion.vz);
    if (actual > limit && actual > 0) {
      motion.vx *= limit / actual;
      motion.vz *= limit / actual;
    }

    // Resolve each axis separately so normal drones can slide along walls.
    const nx = position.x + motion.vx * dt;
    if (canMove(nx, position.z)) position.x = nx;
    else motion.vx = 0;
    const nz = position.z + motion.vz * dt;
    if (canMove(position.x, nz)) position.z = nz;
    else motion.vz = 0;
    return { vx: motion.vx, vz: motion.vz };
  }

  root.LimbyrinthDroneAI = Object.freeze({ step });
})(typeof window !== 'undefined' ? window : globalThis);
