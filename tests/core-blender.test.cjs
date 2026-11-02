const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const THREE=require('../vendor/three.min.js');
global.THREE=THREE;require('../vendor/GLTFLoader.js');require('../vendor/BufferGeometryUtils.js');
const create=require('../core-blender-models.js');
const createCore=require('../core-environment.js');
const bytes=fs.readFileSync(path.join(__dirname,'../assets/models/core/core-kit.glb'));
const response=()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)});
const grid=()=>['11111','10001','10001','10001','11111'].map(r=>[...r].map(Number));

test('Python-authored GLB is autonomous, contains named modules and ships editable source',()=>{
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.match(json.asset.generator,/Blender/);assert.ok(bytes.length<1024*1024);
  assert.ok(json.buffers.every(b=>!b.uri));assert.equal(json.images?.length||0,0);assert.equal(json.cameras?.length||0,0);
  for(const name of['CORE_BODY','CORE_FACE_HIGH','CORE_FACE_LOW','CORE_CEILING','CORE_DOOR','CORE_REACTOR'])assert.ok(json.nodes.some(n=>n.name===name),name);
  assert.equal(fs.readFileSync(path.join(__dirname,'../assets/models/core/core-source.blend')).subarray(0,4).toString('hex'),'28b52ffd','Blender 4.3 Zstandard-compressed editable source');
});

test('real Blender modules load once, instance across sectors, and keep camera/doors safe',async()=>{
  let requests=0;const models=create(THREE,{fetch:async()=>{requests++;return response();}}),kit=createCore(THREE);
  for(let level=0;level<5;level++){
    const e=kit.build({grid:grid(),level}),door=new THREE.Group(),old=e.decorateDoor(door);
    assert.equal(await models.attach(e,{grid:grid(),level,theme:kit.themes[level],doors:[door]}),true);
    assert.equal(e.source,'blender');assert.equal(old.visible,false);assert.ok(e.stats.drawCalls<80);
    e.update(1,{firstPerson:true});assert.equal(e.ceiling.visible,true);
    e.update(2,{firstPerson:false});assert.equal(e.ceiling.visible,false);
    const matrix=new THREE.Matrix4(),bounds=new THREE.Box3();
    e.group.traverse(o=>{if(!o.isInstancedMesh||o.name!=='CORE / Blender solid')return;
      for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,matrix);bounds.copy(o.geometry.boundingBox).applyMatrix4(matrix);
        const center=bounds.getCenter(new THREE.Vector3()),x=Math.floor(center.x/4+2.5),z=Math.floor(center.z/4+2.5);
        assert.equal(grid()[z]?.[x],1,JSON.stringify(bounds));
        assert.ok(bounds.min.x>=(x-2)*4-2-.002&&bounds.max.x<=(x-2)*4+2+.002,JSON.stringify(bounds));
        assert.ok(bounds.min.z>=(z-2)*4-2-.002&&bounds.max.z<=(z-2)*4+2+.002,JSON.stringify(bounds));
      }
    });
    e.dispose();assert.equal(door.children.length,0);
  }
  assert.equal(requests,1);
});

test('failed or late Blender load retains fallback and cannot revive a disposed world',async()=>{
  const kit=createCore(THREE),e=kit.build({grid:grid()});
  assert.equal(await create(THREE,{fetch:async()=>({ok:false})}).attach(e,{grid:grid(),theme:kit.themes[0]}),false);
  assert.equal(e.source,'procedural');
  let finish;const delayed=create(THREE,{fetch:()=>new Promise(resolve=>finish=resolve)});
  const task=delayed.attach(e,{grid:grid(),theme:kit.themes[0]});e.dispose();finish(response());assert.equal(await task,false);
});

test('Blender door relief replaces its opaque legacy shell and restores it on release',async()=>{
  const kit=createCore(THREE),e=kit.build({grid:grid()}),door=new THREE.Group();
  const shell=new THREE.Mesh(new THREE.BoxGeometry(4,2.8,4),new THREE.MeshStandardMaterial());shell.position.y=1.4;door.add(shell);
  e.decorateDoor(door);
  await create(THREE,{fetch:async()=>response()}).attach(e,{grid:grid(),level:0,theme:kit.themes[0],doors:[door]});
  assert.equal(shell.visible,false);
  e.dispose();assert.equal(shell.visible,true);shell.geometry.dispose();shell.material.dispose();
});

test('Blender visuals preserve the original full-game fingerprints after async attachment',async()=>{
  const {runtime}=require('./runtime.cjs'),crypto=require('node:crypto');
  const models=create(THREE,{fetch:async()=>response()});
  const game=runtime({}, {LimbyrinthCoreBlender:models});
  const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/core-gameplay-before.json')));
  const fingerprint=`JSON.stringify({grid,dyn:dyn.map(d=>[d.i,d.j,d.closed]),crystals:crystals.map(c=>c.mesh.position.toArray()),
    foes:foes.map(f=>[f.g.position.toArray(),f.hp,f.kind,f.spd]),pads:pulsePads.map(p=>[p.x,p.z]),players:players.map(a=>a.g.position.toArray()),
    stations:survivalStations.map(s=>s.g?.position?.toArray()),timeLeft,swapT,wave})`;
  for(const key of Object.keys(expected)){
    const [count,level,seed]=key.split('/');game.run(`nP=${count};net=null;start(${level},${seed})`);
    assert.equal(await game.runAsync('coreEnvironment.ready'),true);
    const actual=crypto.createHash('sha256').update(game.run(fingerprint)).digest('hex');assert.equal(actual,expected[key],key);
  }
});
