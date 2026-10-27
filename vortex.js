/* VORTEX visuals and collision helpers. Three.js r128, no runtime dependencies. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LimbyrinthVortex=factory(root.THREE);
})(typeof window!=='undefined'?window:globalThis,function(THREE){
  'use strict';
  const PURPLE=0xb865ff,CYAN=0x66efff;
  const shared=new WeakSet(),effects=new Set(),shots=new Set();
  const effectPools={pulse:[],singularity:[]},shotPool=[];
  let template=null,effectCount=0,shotCount=0;
  const metal=(color)=>new THREE.MeshStandardMaterial({color,metalness:.78,roughness:.32});
  const basic=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1});
  const sphereGeo=new THREE.IcosahedronGeometry(.22,1);
  shared.add(sphereGeo);

  // Batch fixed parts by material; moving arms remain independent pivots.
  function batch(group){
    group.updateMatrixWorld(true);
    const materials=new Map();
    for(const mesh of [...group.children]){
      if(!mesh.isMesh)continue;
      mesh.updateMatrix();
      const geo=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);
      if(!materials.has(mesh.material))materials.set(mesh.material,[]);
      materials.get(mesh.material).push(geo);
      group.remove(mesh);mesh.geometry.dispose();
    }
    for(const [material,geos] of materials){
      const count=geos.reduce((sum,g)=>sum+g.attributes.position.count,0);
      const positions=new Float32Array(count*3),normals=new Float32Array(count*3);
      let offset=0;
      for(const geo of geos){positions.set(geo.attributes.position.array,offset);normals.set(geo.attributes.normal.array,offset);offset+=geo.attributes.position.array.length;geo.dispose();}
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
      geometry.computeBoundingSphere();shared.add(geometry);shared.add(material);
      group.add(new THREE.Mesh(geometry,material));
    }
  }
  function mesh(parent,geo,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m;
  }
  function plate(parent,mat,points,depth,x,y,z,rz=0){
    const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();
    return mesh(parent,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:1,steps:1}),mat,x,y,z-depth/2,0,0,rz);
  }
  function makeTemplate(){
    const root=new THREE.Group();root.name='VORTEX_Visual';root.position.y=.28;
    const black=metal(0x141720),steel=metal(0x35404b),gold=metal(0xbf9650);
    const cyan=basic(CYAN),violet=basic(PURPLE);
    const hull=new THREE.Group();hull.name='VORTEX_Hull';root.add(hull);
    // Offset keel and two swept wings: deliberate asymmetric triangular silhouette.
    plate(hull,black,[[-.32,-.2],[.35,-.2],[.08,.6]],.32,0,.03,-.1,.12);
    plate(hull,steel,[[-.23,-.22],[.15,-.28],[.33,.3],[-.15,.4]],.075,.06,.08,.085,-.14);
    plate(hull,black,[[-.38,-.12],[.16,-.17],[.06,.23]],.24,-.23,-.09,-.035,.34);
    plate(hull,gold,[[-.19,0],[.2,0],[.03,.032]],.018,.02,.48,.08,.12);
    // Inlaid technical engraving, not a cloud of decorative blocks.
    for(let i=0;i<3;i++)mesh(hull,new THREE.BoxGeometry(.11-i*.02,.012,.012),i===0?cyan:gold,.12+i*.025,.2+i*.065,.142,0,0,-.26);
    mesh(hull,new THREE.CylinderGeometry(.105,.15,.2,8),steel,0,-.24,0);
    mesh(hull,new THREE.CylinderGeometry(.065,.09,.08,8),violet,0,-.36,0);
    batch(hull);
    const core=mesh(root,new THREE.IcosahedronGeometry(.25,2),new THREE.MeshStandardMaterial({color:0xdba9ff,emissive:PURPLE,emissiveIntensity:2,metalness:.25,roughness:.18}),0,.14,.15);
    core.name='VORTEX_Core';shared.add(core.geometry);
    const halo=mesh(root,new THREE.TorusGeometry(.34,.025,6,40),cyan,0,.14,.15,.3,.12);halo.name='VORTEX_Halo';shared.add(halo.geometry);shared.add(cyan);
    const orbit=new THREE.Group();orbit.name='VORTEX_Orbit';root.add(orbit);
    for(let i=0;i<3;i++){
      const arm=new THREE.Group();arm.name='VORTEX_Arm_'+i;orbit.add(arm);
      // Local +X points away from the core. Three different calibrated armatures.
      mesh(arm,new THREE.CylinderGeometry(.095,.095,.16,10),steel,0,0,0,0,0,Math.PI/2);
      plate(arm,black,[[-.08,-.12],[.2,-.095],[.31,.02],[.04,.15]],.18,.02,0,0);
      plate(arm,steel,[[-.04,-.07],[.18,-.055],[.23,.02],[.03,.1]],.025,.02,0,.11);
      mesh(arm,new THREE.TorusGeometry(.102,.018,5,14),gold,-.065,0,0,0,Math.PI/2);
      mesh(arm,new THREE.CylinderGeometry(.045,.045,.18,8),violet,.16,0,0,0,0,Math.PI/2);
      for(const side of [-1,1]){
        mesh(arm,new THREE.BoxGeometry(.2,.045,.045),steel,.25,side*.09,0,0,0,-side*.2);
        mesh(arm,new THREE.ConeGeometry(.03,.12,5),gold,.34,side*.057,0,0,0,Math.PI/2);
      }
      mesh(arm,new THREE.BoxGeometry(.09,.018,.015),cyan,.1,.06,.125);
      batch(arm);
      shared.add(black);shared.add(steel);shared.add(gold);shared.add(violet);
    }
    const links=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:PURPLE,transparent:true,opacity:.6,depthWrite:false}));
    links.name='VORTEX_Links';root.add(links);
    return root;
  }
  function create(x,z,player2=false){
    if(!template)template=makeTemplate();
    const group=new THREE.Group();group.position.set(x,0,z);
    const robot=new THREE.Group();robot.position.y=.75;group.add(robot);
    // A future GLB replaces only this root, never player/collision/network state.
    const visualRoot=template.clone(true);robot.add(visualRoot);
    const core=visualRoot.getObjectByName('VORTEX_Core');core.material=core.material.clone();
    const links=visualRoot.getObjectByName('VORTEX_Links');links.geometry=links.geometry.clone();links.material=links.material.clone();
    const repere=mesh(group,new THREE.RingGeometry(.68,.73,player2?3:4),basic(player2?0xffd27a:CYAN,.65),0,.035,0,-Math.PI/2,0,Math.PI/4);
    const rig={group,robot,visualRoot,core,links,orbit:visualRoot.getObjectByName('VORTEX_Orbit'),halo:visualRoot.getObjectByName('VORTEX_Halo'),arms:[0,1,2].map(i=>visualRoot.getObjectByName('VORTEX_Arm_'+i)),repere,pieds:[],thrusters:[],shape:'vortex',skinId:'rvortex',ultimate:0};
    animate(rig,0,false,false);return rig;
  }
  function animate(rig,time,moving,dash){
    const deployed=Math.min(1,Math.max(0,rig.ultimate||0)*3),speed=dash?2.7:moving?1.3:.32;
    rig.visualRoot.position.y=.28+Math.sin(time*2.2)*.045;
    rig.visualRoot.rotation.x=moving?dash?.25:.14:Math.sin(time)*.025;
    rig.visualRoot.rotation.z=moving?-.08:Math.sin(time*.7)*.035;
    // Absolute-time motion avoids frame-rate dependent drift and preview leaks.
    rig.orbit.rotation.y=time*.32+Math.sin(time*speed)* (moving?.26:.045);
    rig.halo.rotation.z=time*(dash?3:moving?1.7:.65);rig.halo.rotation.x=.3+Math.sin(time)*.16;
    rig.core.rotation.y=time*.8;rig.core.material.emissiveIntensity=2+deployed*2.6+Math.sin(time*5)*.2;
    rig.core.scale.setScalar(1+deployed*.18+Math.sin(time*4)*.025);
    const points=rig.links.geometry.attributes.position;
    rig.arms.forEach((arm,i)=>{
      const angle=i*Math.PI*2/3+[.1,-.08,.16][i],radius=[.49,.55,.46][i]+deployed*.18;
      arm.position.set(Math.cos(angle)*radius,[.24,-.06,.04][i]+Math.sin(time*(moving?5:1.8)+i*2)*.04,Math.sin(angle)*radius);
      arm.rotation.set(Math.sin(time*speed+i)*.09,-angle,deployed*.24);
      points.setXYZ(i,arm.position.x,arm.position.y,arm.position.z);
    });
    rig.links.rotation.y=rig.orbit.rotation.y;points.needsUpdate=true;rig.links.geometry.computeBoundingSphere();
    rig.links.material.opacity=.45+deployed*.4;
  }

  function clearPath(a,b,blocked,radius=0){
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
    for(let i=0;i<=count;i++)if(blocked(a.x+(b.x-a.x)*i/count,a.z+(b.z-a.z)*i/count,radius))return false;
    return true;
  }
  function pullEnemy(pos,center,dt,kind,blocked){
    if(!clearPath(pos,center,blocked))return;
    const dx=center.x-pos.x,dz=center.z-pos.z,d=Math.hypot(dx,dz);
    if(d<.04)return;
    const travel=Math.min(d-.04,Math.max(0,dt)*4.2*(kind===3?.28:1));
    const steps=Math.max(1,Math.ceil(travel/.12)),radius=kind===3?.65:.4;
    for(let i=0;i<steps;i++){
      const x=pos.x+dx/d*travel/steps,z=pos.z+dz/d*travel/steps;
      if(!blocked(x,pos.z,radius))pos.x=x;
      if(!blocked(pos.x,z,radius))pos.z=z;
    }
  }

  function acquireShot(){
    let shot=shotPool.pop();
    if(!shot){
      shot=new THREE.Mesh(sphereGeo,basic(PURPLE));
      const aura=mesh(shot,new THREE.SphereGeometry(.29,10,6),basic(PURPLE,.19));
      const ring=mesh(shot,new THREE.TorusGeometry(.27,.018,4,16),basic(CYAN),0,0,0,Math.PI/2);
      shot.traverse(m=>{if(m.geometry)shared.add(m.geometry);if(m.material)shared.add(m.material);});shotCount++;
    }
    shot.visible=true;shot.scale.setScalar(1);shots.add(shot);return shot;
  }
  function releaseShot(shot){if(!shots.delete(shot))return;if(shot.parent)shot.parent.remove(shot);shotPool.push(shot);}
  function acquireEffect(kind){
    let group=effectPools[kind].pop();
    if(!group){
      group=new THREE.Group();group.userData.kind=kind;effectCount++;
      const ring=mesh(group,new THREE.TorusGeometry(1,.025,5,48),basic(kind==='pulse'?CYAN:PURPLE,.75),0,.12,0,Math.PI/2);ring.name='boundary';
      if(kind==='singularity'){
        mesh(group,new THREE.SphereGeometry(.4,16,10),basic(0x070410),0,.85,0).name='void';
        mesh(group,new THREE.SphereGeometry(.5,14,8),basic(PURPLE,.24),0,.85,0).name='aura';
        mesh(group,new THREE.TorusGeometry(.78,.09,6,40),basic(PURPLE,.85),0,.85,0,1.1,.25).name='disk';
        mesh(group,new THREE.TorusGeometry(.92,.025,4,40),basic(CYAN,.8),0,.85,0,.8,-.3).name='orbit';
        const coords=new Float32Array(24*3);
        for(let i=0;i<24;i++){const a=i*Math.PI/12,r=.9+i%4*.35;coords[i*3]=Math.cos(a)*r;coords[i*3+1]=.3+i%3*.2;coords[i*3+2]=Math.sin(a)*r;}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(coords,3));
        const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:PURPLE,size:.07,transparent:true,opacity:.8,depthWrite:false}));points.name='dust';group.add(points);
      }
      group.traverse(m=>{if(m.geometry)shared.add(m.geometry);if(m.material)shared.add(m.material);});
    }
    group.visible=true;group.scale.setScalar(1);group.rotation.set(0,0,0);effects.add(group);return group;
  }
  function animateEffect(group,age,duration,maxRadius=5.5){
    const kind=group.userData.kind,progress=Math.min(1,Math.max(0,age/duration)),boundary=group.getObjectByName('boundary');
    if(kind==='pulse'){
      boundary.scale.setScalar(.15+progress*maxRadius);boundary.material.opacity=(1-progress)*.8;
    }else{
      const open=Math.min(1,age*5,(duration-age)*5);group.scale.setScalar(Math.max(.01,open));
      boundary.scale.setScalar(maxRadius);boundary.material.opacity=.13+Math.sin(age*6)*.04;
      group.getObjectByName('disk').rotation.z=age*3;
      group.getObjectByName('orbit').rotation.y=age*-2;
      group.getObjectByName('dust').rotation.y=age*2.4;
      group.getObjectByName('aura').scale.setScalar(1+Math.sin(age*9)*.08);
    }
  }
  function releaseEffect(group){if(!effects.delete(group))return;if(group.parent)group.parent.remove(group);effectPools[group.userData.kind].push(group);}
  function reset(){for(const e of [...effects])releaseEffect(e);for(const s of [...shots])releaseShot(s);}
  return {create,animate,clearPath,pullEnemy,acquireShot,releaseShot,acquireEffect,animateEffect,releaseEffect,reset,isShared:r=>shared.has(r),stats:()=>({effects:effectCount,shots:shotCount,activeEffects:effects.size,activeShots:shots.size})};
});
