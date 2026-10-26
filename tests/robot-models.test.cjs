const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const validator=require('gltf-validator');
const THREE=require('../vendor/three.min.js');
global.THREE=THREE;
require('../vendor/GLTFLoader.js');
require('../vendor/BufferGeometryUtils.js');
const {runtime}=require('./runtime.cjs');
const modulePath=path.join(__dirname,'../robot-models.js');
const createModels=fs.existsSync(modulePath)?require(modulePath):()=>null;
const bytes=id=>fs.readFileSync(path.join(__dirname,'../assets/models/'+id+'.glb'));
const response=id=>{const b=bytes(id);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};};
function setup(fetch=async url=>response(String(url).includes('spectre')?'spectre':'souverain'),options={}){
  const models=createModels(THREE,{fetch,...options});
  return {models,game:runtime({}, {LimbyrinthRobotModels:models})};
}

test('GLB Blender : une scène isolée, autonome et valide',async()=>{
  for(const [id,root,count] of [['spectre','SPECTRE__VAGUE_50_ROOT',49],['souverain','SOUVERAIN__VAGUE_100_ROOT',99]]){
    const b=bytes(id),g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
    const result=await validator.validateBytes(new Uint8Array(b),{uri:id+'.glb'});
    assert.equal(result.issues.numErrors,0);assert.equal(result.issues.numWarnings,0);
    assert.equal(g.scenes.length,1);assert.equal(g.scenes[0].nodes.length,1);
    assert.equal(g.nodes[g.scenes[0].nodes[0]].name,root);assert.equal(g.meshes.length,count);
    assert.equal(g.cameras?.length||0,0);assert.equal(g.images?.length||0,0);
    assert.ok(g.buffers.every(b=>!b.uri));assert.equal(g.animations?.length||0,0);
    const visited=new Set();function visit(i){visited.add(i);for(const c of g.nodes[i].children||[])visit(c);}visit(g.scenes[0].nodes[0]);
    assert.equal(visited.size,g.nodes.length,'no hidden unreferenced objects');
  }
});

test('les vrais modèles remplacent les visuels sans changer le robot ni ses effets',async()=>{
  const {game}=setup();
  for(const id of ['rspectre','rsovereign']){
    game.run(`globalThis.rig=creerRobot(3,7,true,'${id}');globalThis.originalRobot=rig.robot;
      globalThis.effect=new THREE.Group();effect.name='gameplay-effect';rig.robot.add(effect);
      rig.robot.rotation.y=1.2;rig.robot.visible=false;`);
    assert.equal(await game.runAsync('rig.modelReady'),true);
    const result=game.run(`(()=>{animerRobot(rig,1,true,true);rig.group.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(rig.model);let meshes=0,triangles=0,maxEmission=0;
      rig.model.traverse(m=>{if(m.isMesh){meshes++;triangles+=m.geometry.index.count/3;maxEmission=Math.max(maxEmission,m.material.emissiveIntensity);}});
      return {source:rig.modelSource,same:rig.robot===originalRobot,effect:effect.parent===rig.robot,
        position:rig.group.position.toArray(),yaw:rig.robot.rotation.y,visible:rig.robot.visible,skin:rig.skinId,
        meshes,triangles,maxEmission,repere:rig.repere.parent===rig.group};})()`);
    assert.equal(result.source,'glb');assert.equal(result.same,true);assert.equal(result.effect,true);
    assert.deepEqual(result.position,[3,0,7]);assert.equal(result.yaw,1.2);assert.equal(result.visible,false);
    assert.equal(result.skin,id);assert.equal(result.repere,true);
    assert.equal(result.triangles,id==='rspectre'?8588:9596);assert.ok(result.meshes<=(id==='rspectre'?12:50),JSON.stringify(result));
    assert.ok(result.maxEmission>1,'Blender emissive strength is preserved');
    const bounds=game.run(`(()=>{rig.group.position.set(0,0,0);rig.robot.rotation.y=0;animerRobot(rig,0,false,false);
      rig.group.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(rig.model);return {size:b.getSize(new THREE.Vector3()).toArray(),center:b.getCenter(new THREE.Vector3()).toArray(),minY:b.min.y};})()`);
    assert.ok(bounds.size[0]<=1.61&&bounds.size[2]<=1.61,JSON.stringify(bounds));
    assert.ok(bounds.minY>=.04,JSON.stringify(bounds));assert.ok(Math.abs(bounds.center[0])<.001&&Math.abs(bounds.center[2])<.001);
  }
});

test('deux instances partagent le téléchargement mais conservent leurs animations et ressources',async()=>{
  let requests=0;const {game}=setup(async()=>{requests++;return response('spectre');});
  game.run("globalThis.a=creerRobot(0,0,false,'rspectre');globalThis.b=creerRobot(0,0,true,'rspectre');void 0;");
  await game.runAsync('Promise.all([a.modelReady,b.modelReady])');assert.equal(requests,1);
  const result=game.run(`(()=>{const one=a.model.getObjectByName('ANIM_Orbital_ring_A'),two=b.model.getObjectByName('ANIM_Orbital_ring_A');
    animerRobot(a,2,true,false);const independent=!one.quaternion.equals(two.quaternion);
    globalThis.disposed=0;b.model.traverse(m=>{if(m.isMesh)m.geometry.addEventListener('dispose',()=>disposed++);});
    disposeTree(a.group);return {independent,disposed,bSource:b.modelSource};})()`);
  assert.equal(result.independent,true);assert.equal(result.disposed,0);assert.equal(result.bSource,'glb');
});

test('échec réseau et GLB invalide : le repli reste animé et jouable',async()=>{
  for(const fetch of [async()=>{throw Error('offline');},async()=>({ok:false,status:404}),async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(12)})]){
    const {game}=setup(fetch);
    game.run("save.robot='rspectre';start(4,123);globalThis.rig=players[0].rig;void 0;");
    assert.equal(await game.runAsync('rig.modelReady'),false);
    const result=game.run("(()=>{animerRobot(rig,2,true,false);shots=[];fire(players[0],1,0);return {source:rig.modelSource,count:shots.length,pass:shots[0].wallPass,ulti:useUltimate(players[0]),inv:players[0].inv};})()");
    assert.equal(result.source,'procedural');assert.equal(result.count,1);assert.equal(result.pass,true);assert.equal(result.ulti,true);assert.ok(result.inv>=5);
  }
});

test('destruction pendant le chargement : aucun modèle attaché tardivement',async()=>{
  let resolve;const {game}=setup(()=>new Promise(r=>resolve=r));
  game.run("globalThis.rig=creerRobot(0,0,false,'rsovereign');disposeTree(rig.group);");
  resolve(response('souverain'));assert.equal(await game.runAsync('rig.modelReady'),false);
  assert.equal(game.run('!!rig.model'),false);
});

test('chargement bloqué : délai borné et nouvel essai après échec',async()=>{
  let requests=0;const {game}=setup(async()=>++requests===1?new Promise(()=>{}):response('spectre'),{timeoutMs:20,retryMs:0});
  game.run("globalThis.a=creerRobot(0,0,false,'rspectre');void 0;");assert.equal(await game.runAsync('a.modelReady'),false);
  game.run("globalThis.b=creerRobot(0,0,false,'rspectre');void 0;");assert.equal(await game.runAsync('b.modelReady'),true);assert.equal(requests,2);
});

test('kits et synchronisation inchangés avec GLB effectivement chargés',async()=>{
  const {game}=setup();game.run("save.robot='rspectre';nP=2;net='host';remoteRobotId='rsovereign';start(4,123);");
  assert.deepEqual(await game.runAsync('Promise.all(players.map(p=>p.rig.modelReady))'),[true,true]);
  const result=game.run(`players.map(a=>{shots=[];fire(a,0,1);const basic={count:shots.length,pass:!!shots[0].wallPass,pierce:shots[0].pierce};useUltimate(a);
    return {skin:a.rig.skinId,source:a.rig.modelSource,basic,cooldown:a.ultCd,inv:a.inv,shield:a.shield||0};})`);
  assert.equal(result[0].basic.count,1);assert.equal(result[0].basic.pass,true);assert.equal(result[0].cooldown,26);assert.ok(result[0].inv>=5);
  assert.equal(result[1].basic.count,2);assert.ok(result[1].basic.pierce>0);assert.equal(result[1].cooldown,32);assert.ok(result[1].shield>=2);
});
