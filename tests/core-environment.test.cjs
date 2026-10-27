const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js');
const createCore=require('../core-environment.js');
const kit=createCore(THREE);
const grid=()=>['11111','10001','10001','10001','11111'].map(r=>[...r].map(Number));
const build=(options={})=>kit.build({grid:grid(),level:0,seed:123,...options});

test('reference corridor: instanced physical layers, no lights, deterministic geometry',()=>{
  const a=build(),b=build();let lights=0,standard=0,instances=0;
  a.group.traverse(o=>{if(o.isLight)lights++;if(o.isInstancedMesh){instances+=o.count;if(o.material.isMeshStandardMaterial)standard++;}});
  assert.equal(lights,0);assert.ok(standard>=5);assert.ok(instances>400);
  assert.deepEqual(a.stats,b.stats);assert.ok(a.stats.drawCalls<=24);
  const matrices=e=>e.group.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array));
  assert.deepEqual(matrices(a),matrices(b));a.dispose();b.dispose();
});

test('walls/equipment remain inside solid cells; floor stays flush; roofs are camera-safe',()=>{
  const g=grid(),e=build({grid:g});
  assert.deepEqual(g,grid());assert.equal(e.ceiling.visible,false);
  const matrix=new THREE.Matrix4(),bounds=new THREE.Box3();
  e.group.traverse(o=>{if(!o.isInstancedMesh||o.userData.zone!=='solid')return;
    for(let i=0;i<o.count;i++){
      o.getMatrixAt(i,matrix);bounds.copy(o.geometry.boundingBox||new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position)).applyMatrix4(matrix);
      const center=bounds.getCenter(new THREE.Vector3()),x=Math.floor(center.x/4+2.5),z=Math.floor(center.z/4+2.5);
      assert.equal(g[z]?.[x],1,JSON.stringify(center));
      assert.ok(bounds.min.x>=(x-2)*4-2-.001&&bounds.max.x<=(x-2)*4+2+.001);
      assert.ok(bounds.min.z>=(z-2)*4-2-.001&&bounds.max.z<=(z-2)*4+2+.001);
    }
  });
  e.update(1,{firstPerson:true});assert.equal(e.ceiling.visible,true);
  e.update(2,{firstPerson:false});assert.equal(e.ceiling.visible,false);e.dispose();
});

test('dynamic cells are reserved, exposed neighbors rendered for both door states',()=>{
  const g=grid();g[1][2]=1;
  const closed=build({grid:g,dynamicCells:[[2,1]]});g[1][2]=0;
  const opened=build({grid:g,dynamicCells:[[2,1]]});
  assert.deepEqual(closed.stats,opened.stats);
  const door=new THREE.Group(),detail=closed.decorateDoor(door);
  assert.equal(detail.parent,door);door.scale.y=.001;assert.equal(detail.parent.scale.y,.001);
  closed.dispose();assert.equal(door.children.length,0);opened.dispose();
});

test('five themes, quality budgets and reduced motion preserve structural surfaces',()=>{
  assert.equal(kit.themes.length,5);assert.equal(new Set(kit.themes.map(t=>t.accent)).size,5);
  const high=build({quality:'high'}),low=build({quality:'low'}),still=build({quality:'high',reducedMotion:true});
  assert.ok(low.stats.instances<high.stats.instances);
  assert.equal(low.effects.visible,false);assert.equal(still.effects.visible,false);
  assert.equal(low.stats.dynamicLights,0);assert.ok(high.stats.drawCalls<=24);
  for(const e of [high,low,still])e.dispose();
});

test('resource disposal is unique, idempotent, and detaches all owned groups',()=>{
  const e=build(),parent=new THREE.Group();parent.add(e.group);const resources=new Set();
  e.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));
  e.dispose();e.dispose();assert.equal(parent.children.length,0);assert.equal(disposed,resources.size);
});

test('visual detail does not consume gameplay RNG',()=>{
  const original=Math.random;Math.random=()=>{throw Error('gameplay RNG consumed');};
  try{const e=build({level:4});e.update(1,{wave:5});e.dispose();}finally{Math.random=original;}
});

test('optional GLB: missing/invalid/unsafe slot keeps procedural fallback',async()=>{
  const create=createCore(THREE,{fetch:async()=>({ok:false})}),e=create.build({grid:grid()});
  const count=e.group.children.length;
  assert.equal(await e.loadAsset({url:'assets/models/core/machine.glb',cell:[0,2]}),false);
  assert.equal(await e.loadAsset({url:'https://other.test/machine.glb',cell:[0,2]}),false);
  assert.equal(await e.loadAsset({url:'assets/models/core/machine.glb',cell:[2,2]}),false);
  assert.equal(e.group.children.length,count);e.dispose();
});

test('optional GLB: real Blender geometry is bounded and released with its environment',async()=>{
  global.THREE=THREE;require('../vendor/GLTFLoader.js');
  const bytes=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/models/spectre.glb'));
  const e=createCore(THREE,{fetch:async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})}).build({grid:grid()});
  assert.equal(await e.loadAsset({url:'assets/models/core/machine.glb',cell:[0,2]}),true);
  const model=e.group.getObjectByName('CORE / Blender equipment');model.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(model);assert.ok(b.max.x<=-6.19&&b.min.x>=-9.81,JSON.stringify(b));
  let disposed=0;model.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed++);});
  e.dispose();assert.ok(disposed>0);
});

test('optional GLB: timeout/disposal settles pending work without resurrecting scenery',async()=>{
  let answer;const e=createCore(THREE,{assetTimeoutMs:10,fetch:()=>new Promise(r=>answer=r)}).build({grid:grid()});
  const task=e.loadAsset({url:'assets/models/core/machine.glb',cell:[0,2]});
  assert.equal(await task,false);e.dispose();answer({ok:false});
  const f=createCore(THREE,{fetch:()=>new Promise(()=>{})}).build({grid:grid()});
  const pending=f.loadAsset({url:'assets/models/core/machine.glb',cell:[0,2]});f.dispose();assert.equal(await pending,false);
});

test('energy-sector scenery reserves the original central reactor cell',()=>{
  const g=grid();g[2][2]=1;const e=build({grid:g,level:2});
  const box=new THREE.Box3(),matrix=new THREE.Matrix4();
  e.group.traverse(o=>{if(!o.isInstancedMesh||o.userData.zone!=='solid')return;
    for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);box.copy(o.geometry.boundingBox).applyMatrix4(matrix);
      assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).x)>2||Math.abs(box.getCenter(new THREE.Vector3()).z)>2);
    }
  });e.dispose();
});

test('purchased environment palettes still recolor the new wall and lamp materials',()=>{
  const e=build({themeOverride:{panel:0x14301f,accent:0x3dff7a}});
  assert.equal(e.wallMaterial.color.getHex(),0x14301f);assert.equal(e.accentMaterial.color.getHex(),0x3dff7a);e.dispose();
});
