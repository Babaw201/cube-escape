const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runtime } = require('./runtime.cjs');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../drone-ai.js'), 'utf8'), context);
const { step } = context.LimbyrinthDroneAI;

test('inertial steering accelerates smoothly, obeys speed limit and slows down', () => {
  const p = { x: 0, z: 0 }, motion = { vx: 0, vz: 0 };
  const free = () => true;
  const first = step(p, motion, { x: 1, z: 0 }, 5, 0.05, free);
  assert.ok(first.vx > 0 && first.vx < 5);
  for (let i = 0; i < 200; i++) step(p, motion, { x: 1, z: 0 }, 5, 0.05, free);
  assert.ok(Math.hypot(motion.vx, motion.vz) <= 5.00001);
  const before = motion.vx;
  step(p, motion, { x: 0, z: 0 }, 5, 0.05, free);
  assert.ok(motion.vx < before);
});

test('steering honors collision callback and does not leave its permitted area', () => {
  const p = { x: 0.8, z: 0 }, motion = { vx: 0, vz: 0 };
  for (let i = 0; i < 60; i++) {
    step(p, motion, { x: 1, z: 0 }, 12, 0.05, (x, z) => x <= 1 && Math.abs(z) < 1);
  }
  assert.ok(p.x <= 1);
  assert.ok(p.x >= 0.8);
});

test('survival: Sprinter crosses an internal wall, regular drone keeps collision', () => {
  const game = runtime();
  const r = game.run(`(() => {
    start(4, 123); wave = 3;
    players[0].g.position.set(0, 0, -16);
    const ghost = makeSwarmFoe(200, 0, -4, 1, wave);
    const normal = makeSwarmFoe(201, 4, -4, 0, wave);
    let normalInWall = false;
    let ghostInWall = false;
    for (let i = 0; i < 70; i++) {
      swarmAI(ghost, .05);
      swarmAI(normal, .05);
      const g = [fromW(ghost.g.position.x), fromW(ghost.g.position.z)];
      const n = [fromW(normal.g.position.x), fromW(normal.g.position.z)];
      ghostInWall ||= !!grid[g[1]]?.[g[0]];
      normalInWall ||= !!grid[n[1]]?.[n[0]];
    }
    return {ghostInWall, normalInWall, ghostZ:ghost.g.position.z, ghostHasHalo:ghost.g.children.some(x=>x.type==='Mesh' && x.geometry?.type==='TorusGeometry')};
  })()`);
  assert.equal(r.ghostInWall, true, 'Sprinter should cross a middle wall');
  assert.equal(r.normalInWall, false, 'regular drones must not enter walls');
  assert.ok(r.ghostZ < -9, 'Sprinter should advance toward the player');
  assert.equal(r.ghostHasHalo, true, 'Sprinter should be recognizable');
});

test('survival: phasing never crosses the outside border', () => {
  const game = runtime();
  const r = game.run(`(() => {
    start(4, 123); wave = 3;
    players[0].g.position.set(45, 0, 0);
    const f = makeSwarmFoe(202, 25, 0, 1, wave);
    for(let i=0;i<70;i++)swarmAI(f,.05);
    return { x:f.g.position.x, limit:toW(N-2)+T/2-0.4 };
  })()`);
  assert.ok(r.x <= r.limit + 0.00001);
});
