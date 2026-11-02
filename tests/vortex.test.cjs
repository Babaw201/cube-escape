const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js');

test('VORTEX : silhouette flottante, trois bras indépendants, budget et ressources partagées',()=>{
  const vortex=require('../vortex.js')(THREE);
  const a=vortex.create(3,7,false),b=vortex.create(0,0,true);
  assert.equal(a.skinId,'rvortex');assert.equal(a.shape,'vortex');
  assert.equal(a.arms.length,3);assert.equal(a.pieds.length,0);
  assert.deepEqual(a.group.position.toArray(),[3,0,7]);
  assert.equal(a.visualRoot.parent,a.robot);
  a.group.position.set(0,0,0);a.group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(a.visualRoot),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x<2&&size.z<2,JSON.stringify(size));assert.ok(bounds.min.y>.25);
  let meshes=0,triangles=0,lights=0;
  a.visualRoot.traverse(m=>{if(m.isLight)lights++;if(m.isMesh){meshes++;triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;}});
  assert.ok(meshes<=40,'draw calls: '+meshes);assert.ok(triangles<7000,'triangles: '+triangles);assert.equal(lights,0);
  assert.notEqual(a.core.material,b.core.material);
  assert.equal(a.arms[0].children[0].geometry,b.arms[0].children[0].geometry);
  assert.ok(vortex.isShared(a.arms[0].children[0].geometry));
  vortex.animate(a,1,false,false);const idle=a.orbit.rotation.y;
  const other=b.arms[0].position.clone();
  vortex.animate(a,2,true,true);
  assert.notEqual(a.orbit.rotation.y,idle);assert.ok(Math.abs(a.visualRoot.rotation.x)>.05);
  assert.ok(b.arms[0].position.equals(other),'independent animation');
  a.ultimate=3;vortex.animate(a,2,true,false);
  assert.ok(a.arms[0].position.length()>b.arms[0].position.length());
  assert.ok(a.core.material.emissiveIntensity>b.core.material.emissiveIntensity);
});

test('VORTEX : attraction bornée, Titan résistant, visibilité et collision balayée',()=>{
  const v=require('../vortex.js')(THREE),center={x:0,z:0};
  const normal={x:4,z:0},titan={x:4,z:0};
  v.pullEnemy(normal,center,.5,0,()=>false);v.pullEnemy(titan,center,.5,3,()=>false);
  assert.ok(normal.x<4&&normal.x>=0);assert.ok(titan.x>normal.x&&titan.x<4);
  const wall=(x,z,r=0)=>Math.abs(x-2)<=.25+r&&Math.abs(z)<4+r;
  assert.equal(v.clearPath({x:4,z:0},center,wall),false);
  const blocked={x:4,z:0};v.pullEnemy(blocked,center,3,0,wall);assert.equal(blocked.x,4);
  const near={x:.01,z:0};v.pullEnemy(near,center,30,0,()=>false);assert.ok(near.x>=0);
  assert.ok(Number.isFinite(near.x));
  const corner=(x,z,r=0)=>x>=1-r&&x<=2+r&&z>=1-r&&z<=2+r;
  const grazing={x:0,z:.65};v.pullEnemy(grazing,{x:3,z:.65},1,0,corner);
  assert.ok(grazing.x<.6);assert.equal(corner(grazing.x,grazing.z,.4),false);
});

test('VORTEX : effets et projectiles recyclés, sans lumière et sans fuite à la réinitialisation',()=>{
  const v=require('../vortex.js')(THREE),world=new THREE.Group();
  const effect=v.acquireEffect('singularity');world.add(effect);
  v.animateEffect(effect,1,3);assert.ok(effect.visible);
  v.releaseEffect(effect);assert.equal(effect.parent,null);
  assert.equal(v.acquireEffect('singularity'),effect);
  const shot=v.acquireShot();world.add(shot);v.releaseShot(shot);
  assert.equal(v.acquireShot(),shot);
  v.reset();assert.equal(world.children.length,0);
  for(let i=0;i<100;i++){const p=v.acquireEffect('pulse');v.releaseEffect(p);}
  assert.ok(v.stats().effects<=3);assert.ok(v.stats().shots<=1);
});
