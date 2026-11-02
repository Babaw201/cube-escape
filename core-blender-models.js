/* Load the Python-authored Blender kit. JavaScript only places exported modules. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LimbyrinthCoreBlender=factory(root.THREE);
})(typeof window!=='undefined'?window:globalThis,function createBlenderKit(THREE,options={}){
  const fetchKit=options.fetch||(typeof fetch==='function'&&fetch.bind(globalThis));
  let cached=null,inflight=null,retryAt=0;
  const names=['CORE_BODY','CORE_FACE_HIGH','CORE_FACE_LOW','CORE_FACE_DAMAGED','CORE_FLOOR_HIGH','CORE_FLOOR_LOW','CORE_CEILING',
    'CORE_TERMINAL','CORE_PIPES','CORE_ENERGY','CORE_MACHINE','CORE_DOOR','CORE_REACTOR','CORE_DEPLOYMENT','CORE_PLATFORM'];
  function resources(root){
    const result=new Set();root.traverse(o=>{if(o.geometry)result.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)result.add(m);});return result;
  }
  function prepare(gltf){
    const kit=new Map(),original=resources(gltf.scene),created=new Set();
    try{
      gltf.scene.updateMatrixWorld(true);
      for(const name of names){
        const root=gltf.scene.getObjectByName(name);if(!root)throw Error('Missing Blender module '+name);
        const byMaterial=new Map(),inverse=root.matrixWorld.clone().invert();
        root.traverse(o=>{
          if(!o.isMesh)return;
          if(o.isSkinnedMesh||Array.isArray(o.material))throw Error('Unsupported CORE primitive');
          const geometry=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
          for(const a of Object.keys(geometry.attributes))if(!['position','normal'].includes(a))geometry.deleteAttribute(a);
          const flat=geometry.index?geometry.toNonIndexed():geometry;if(flat!==geometry)geometry.dispose();
          const mat=o.material.name.replace(/\.\d+$/,'');
          if(!byMaterial.has(mat))byMaterial.set(mat,[]);byMaterial.get(mat).push(flat);
        });
        const sections=[];
        for(const [material,geometries]of byMaterial){
          const geometry=THREE.BufferGeometryUtils.mergeBufferGeometries(geometries,false);
          geometries.forEach(g=>g.dispose());if(!geometry)throw Error('CORE merge failed');
          created.add(geometry);geometry.computeBoundingBox();sections.push({material,geometry});
        }
        if(!sections.length)throw Error('Empty CORE module');kit.set(name,sections);
      }
      return kit;
    }catch(error){created.forEach(g=>g.dispose());throw error;}
    finally{original.forEach(r=>r.dispose());}
  }
  async function load(){
    if(cached)return cached;if(inflight)return inflight;
    if(!fetchKit||!THREE.GLTFLoader||!THREE.BufferGeometryUtils||Date.now()<retryAt)return null;
    inflight=(async()=>{
      const controller=new AbortController();let timer;
      try{
        const task=(async()=>{
          const response=await fetchKit('assets/models/core/core-kit.glb',{signal:controller.signal});if(!response.ok)throw Error('CORE kit unavailable');
          const bytes=await response.arrayBuffer();if(bytes.byteLength>3*1024*1024)throw Error('CORE kit too large');
          return new Promise((resolve,reject)=>{
            const loader=new THREE.GLTFLoader();
            loader.register(parser=>({name:'KHR_materials_emissive_strength',extendMaterialParams(index,params){
              const ext=parser.json.materials[index].extensions?.KHR_materials_emissive_strength;if(ext)params.emissiveIntensity=ext.emissiveStrength;
            }}));loader.parse(bytes,'',resolve,reject);
          });
        })();
        let expired=false;
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();reject(Error('CORE kit timeout'));},options.timeoutMs??8000);});
        task.then(gltf=>{if(expired)resources(gltf.scene).forEach(r=>r.dispose());},()=>{});
        const gltf=await Promise.race([task,timeout]);cached=prepare(gltf);return cached;
      }catch(_){retryAt=Date.now()+(options.retryMs??30000);return null;}
      finally{clearTimeout(timer);inflight=null;}
    })();return inflight;
  }
  function instantiate(kit,{grid,dynamicCells=[],level=0,quality='medium',theme,doors=[]}){
    const n=grid.length,T=4,H=2.8,at=i=>(i-n/2+.5)*T,low=quality==='low',high=quality==='high';
    const reserved=new Set(dynamicCells.map(c=>c.join(','))),solid=(x,z)=>grid[z]?.[x]===1&&!reserved.has(x+','+z)&&!(level===2&&x===Math.floor(n/2)&&z===Math.floor(n/2));
    const group=new THREE.Group();group.name='CORE / Python Blender kit';
    const ceiling=new THREE.Group();ceiling.name='CORE / Blender cutaway ceiling';ceiling.visible=false;group.add(ceiling);
    const attachments=[],legacyDoorShells=[],materials={},meshes=[],batches=new Map();
    const palette={SHELL:theme.shell,PANEL:theme.panel,EDGE:theme.edge,DARK:0x131f27,FLOOR:theme.floor,ACCENT:theme.accent,SCREEN:0x174454,WARNING:0xd5ad56,WEAR:theme.wear,SIGNAL:theme.accent};
    for(const [key,color]of Object.entries(palette))materials['CORE_'+key]=new THREE.MeshStandardMaterial({color,roughness:['EDGE','ACCENT','SCREEN'].includes(key)?.42:.72,
      metalness:['SHELL','EDGE'].includes(key)?.75:.45,emissive:['ACCENT','SIGNAL','SCREEN'].includes(key)?color:0,emissiveIntensity:key==='ACCENT'?.65:.35});
    materials.CORE_ACCENT.userData.coreAccent=true;
    function place(name,x,z,yaw=0,zone='solid',parent=group){
      for(const section of kit.get(name)){
        const key=name+'|'+section.material+'|'+zone;
        if(!batches.has(key))batches.set(key,{...section,parent,zone,items:[]});
        batches.get(key).items.push([x,z,yaw]);
      }
    }
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const cx=at(x),cz=at(z),variant=(x*31+z*17)%7;
      if(solid(x,z)){
        place('CORE_BODY',cx,cz);
        for(const [dx,dz,yaw]of[[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
          const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=n||nz>=n||solid(nx,nz))continue;
          place(level===3&&high?'CORE_FACE_DAMAGED':high?'CORE_FACE_HIGH':'CORE_FACE_LOW',cx,cz,yaw);
          if(!low&&variant===0)place('CORE_TERMINAL',cx,cz,yaw);
          if(!low&&level===1)place('CORE_PIPES',cx,cz,yaw);
          if(level===2)place('CORE_ENERGY',cx,cz,yaw);
        }
        if(!low&&(x===0||z===0||x===n-1||z===n-1)&&variant===0)place('CORE_MACHINE',cx,cz);
      }else{
        place(high||!low&&variant===0?'CORE_FLOOR_HIGH':'CORE_FLOOR_LOW',cx,cz,0,'floor');
        place('CORE_CEILING',cx,cz,0,'roof',ceiling);
      }
    }
    if(level===4&&n===15){
      place('CORE_REACTOR',0,at(0));place('CORE_PLATFORM',0,0,0,'floor');
      for(const [x,z]of[[0,4],[14,4],[0,10],[14,10]])place('CORE_DEPLOYMENT',at(x),at(z));
    }
    const dummy=new THREE.Object3D();
    function flush(batch,parent=batch.parent){
      const mesh=new THREE.InstancedMesh(batch.geometry,materials[batch.material],batch.items.length);
      mesh.name='CORE / Blender '+batch.zone;mesh.userData.zone=batch.zone;mesh.frustumCulled=false;
      batch.items.forEach(([x,z,yaw],i)=>{dummy.position.set(x,0,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);meshes.push(mesh);
    }
    for(const batch of batches.values())flush(batch);
    for(const door of doors){
      const shell=door.children[0];if(shell?.isMesh){legacyDoorShells.push([shell,shell.visible]);shell.visible=false;}
      const root=new THREE.Group();root.name='CORE / Blender security door';door.add(root);attachments.push(root);
      for(const section of kit.get('CORE_DOOR'))flush({...section,zone:'door',items:[[0,0,0],[0,0,Math.PI/2]]},root);
    }
    const stats={source:'blender',sector:theme.name,quality,drawCalls:meshes.length,instances:meshes.reduce((s,m)=>s+m.count,0),
      triangles:meshes.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0),dynamicLights:0};
    return {group,ceiling,stats,wallMaterial:materials.CORE_PANEL,accentMaterial:materials.CORE_ACCENT,
      update(time,{firstPerson=false,wave=0,phase=0}={}){
        ceiling.visible=firstPerson;const color=level===4&&wave>0&&wave%5===0?0xff708e:level===3?[0x61eaff,0xff78de,0xffc86b][phase%3]:theme.accent;
        materials.CORE_SIGNAL.color.setHex(color);materials.CORE_SIGNAL.emissive.setHex(color);
      },
      dispose(){group.parent?.remove(group);attachments.forEach(o=>o.parent?.remove(o));legacyDoorShells.forEach(([shell,visible])=>shell.visible=visible);meshes.forEach(m=>m.dispose());Object.values(materials).forEach(m=>m.dispose());}
    };
  }
  async function attach(environment,config){
    const kit=await load();if(!kit||environment.isDisposed())return false;
    const visual=instantiate(kit,config);environment.setVisual(visual);return true;
  }
  return {attach,load};
});
