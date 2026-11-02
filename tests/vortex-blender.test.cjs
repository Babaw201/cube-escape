const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const THREE=require('../vendor/three.min.js');
global.THREE=THREE;require('../vendor/GLTFLoader.js');require('../vendor/BufferGeometryUtils.js');
const {runtime}=require('./runtime.cjs');
const createModels=require('../robot-models.js');
const file=path.join(__dirname,'../assets/models/vortex.glb');
const response=()=>{const b=fs.readFileSync(file);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};};
function setup(fetch=async()=>response()){
  const models=createModels(THREE,{fetch});return {models,game:runtime({}, {LimbyrinthRobotModels:models})};
}

test('VORTEX Blender/Python : export autonome, vrai modèle détaillé et budget',()=>{
  const b=fs.readFileSync(file);assert.equal(b.toString('utf8',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);
  const g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.match(g.asset.generator,/Blender/);
  assert.equal(g.scenes.length,1);assert.equal(g.scenes[0].nodes.length,1);
  assert.equal(g.nodes[g.scenes[0].nodes[0]].name,'VORTEX_ROOT');
  for(const name of ['VORTEX_Arm_0','VORTEX_Arm_1','VORTEX_Arm_2','VORTEX_Core','VORTEX_Ring_0','VORTEX_Ring_1'])assert.ok(g.nodes.some(n=>n.name===name),name);
  const tris=g.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+g.accessors[p.indices].count/3,0);
  assert.ok(tris>4000&&tris<=14000,'triangles: '+tris);assert.ok(g.materials.length<=8);
  assert.ok(g.buffers.every(b=>!b.uri));assert.equal(g.images?.length||0,0);assert.equal(g.cameras?.length||0,0);
  assert.equal(g.extensionsUsed?.includes('KHR_lights_punctual')||false,false);
  assert.ok(fs.statSync(path.join(__dirname,'../assets/models/vortex.blend')).size>10000);
  const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/models/vortex.audit.json'),'utf8'));
  assert.equal(audit.triangles,tris);assert.equal(audit.sha256,crypto.createHash('sha256').update(b).digest('hex'));
  assert.match(fs.readFileSync(path.join(__dirname,'../scripts/build_vortex.py'),'utf8'),/bpy\.ops\.export_scene\.gltf/);
});

test('VORTEX GLB : racines de jeu préservées, silhouette et véritables animations indépendantes',async()=>{
  let requests=0;const {game}=setup(async()=>{requests++;return response();});
  game.run("globalThis.a=creerRobot(3,7,false,'rvortex');globalThis.b=creerRobot(0,0,true,'rvortex');globalThis.root=a.robot;globalThis.extraEffect=new THREE.Group();a.robot.add(extraEffect);void 0;");
  assert.deepEqual(await game.runAsync('Promise.all([a.modelReady,b.modelReady])'),[true,true]);assert.equal(requests,1);
  const d=game.run(`(()=>{a.group.position.set(0,0,0);animerRobot(a,0,false,false);a.group.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(a.model),before=b.arms[0].position.clone(),ring=a.model.getObjectByName('VORTEX_Ring_0');
    const rotation=ring.quaternion.clone(),coreBefore=b.core.material.emissiveIntensity;
    a.ultimate=3;animerRobot(a,1,true,true);
    let meshes=0,triangles=0;a.model.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;}});
    return {source:a.modelSource,same:a.robot===root,fx:extraEffect.parent===a.robot,arms:a.arms.length,bounds:box.getSize(new THREE.Vector3()).toArray(),minY:box.min.y,
      independent:b.arms[0].position.equals(before),coreIndependent:b.core.material.emissiveIntensity===coreBefore,bright:a.core.material.emissiveIntensity>coreBefore,
      ringMoved:!ring.quaternion.equals(rotation),ringPlanePreserved:new THREE.Vector3(0,0,1).applyQuaternion(ring.quaternion.clone().multiply(rotation.clone().invert())).distanceTo(new THREE.Vector3(0,0,1))<1e-6,
      tilt:Math.abs(a.model.rotation.x),meshes,triangles};})()`);
  assert.equal(d.source,'glb');assert.equal(d.same,true);assert.equal(d.fx,true);assert.equal(d.arms,3);
  assert.ok(d.bounds[0]<=1.61&&d.bounds[2]<=1.61,JSON.stringify(d));assert.ok(d.minY>=.27);
  assert.equal(d.independent,true);assert.equal(d.coreIndependent,true);assert.equal(d.bright,true);assert.equal(d.ringMoved,true);assert.equal(d.ringPlanePreserved,true);assert.ok(d.tilt>.05);
  assert.ok(d.meshes<=40);assert.ok(d.triangles<=14000);
  const resources=game.run("(()=>{let disposed=0;b.model.traverse(m=>{if(m.isMesh)m.geometry.addEventListener('dispose',()=>disposed++);});disposeTree(a.group);animerRobot(b,2,true,false);return disposed;})()");assert.equal(resources,0);
});

test('VORTEX GLB : jeu coop chargé, attaques conservées et repli hors ligne',async()=>{
  const {game}=setup();game.run("save.robot='rvortex';net='host';remoteRobotId='rvortex';nP=2;start(4,123)");
  assert.deepEqual(await game.runAsync('Promise.all(players.map(p=>p.rig.modelReady))'),[true,true]);
  const d=game.run("players.map(p=>{fire(p,1,0);useUltimate(p);animerRobot(p.rig,2,true,false);return {source:p.rig.modelSource,cd:p.ultCd,arms:p.rig.arms.length};})");
  assert.ok(d.every(r=>r.source==='glb'&&r.cd===28&&r.arms===3));assert.equal(game.run('singularities.length'),2);
  const offline=setup(async()=>{throw Error('offline');}).game;
  offline.run("save.robot='rvortex';start(4,123);globalThis.rig=players[0].rig;void 0");
  assert.equal(await offline.runAsync('rig.modelReady'),false);assert.equal(offline.run("(()=>{animerRobot(rig,1,true,true);return useUltimate(players[0])})()"),true);
});
