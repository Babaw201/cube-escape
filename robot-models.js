/* Blender visuals for Three.js r128. Gameplay continues to own the rig roots. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.LimbyrinthRobotModels = factory(root.THREE);
})(typeof window !== 'undefined' ? window : globalThis, function createRobotModels(THREE, options = {}) {
  const definitions = {
    rspectre: {file: 'spectre.glb', floor: .25},
    rsovereign: {file: 'souverain.glb', floor: .06},
    rvortex: {file: 'vortex.glb', floor: .34, vortex: true}
  };
  const fetchModel = options.fetch || (typeof fetch === 'function' && fetch.bind(globalThis));
  const baseURL = options.baseURL || 'assets/models/';
  const timeoutMs = options.timeoutMs ?? 8000;
  const retryMs = options.retryMs ?? 30000;
  const cache = new Map(), shared = new WeakSet(), instances = new WeakMap();
  const axisY = new THREE.Vector3(0, 1, 0), spin = new THREE.Quaternion();

  function makeLoader() {
    const loader = new THREE.GLTFLoader();
    // Blender 5 exports this extension; r128 predates its built-in support.
    loader.register(parser => ({
      name: 'KHR_materials_emissive_strength',
      extendMaterialParams(index, params) {
        const extension = parser.json.materials[index].extensions?.KHR_materials_emissive_strength;
        if (extension) params.emissiveIntensity = extension.emissiveStrength;
      }
    }));
    return loader;
  }

  function prepare(gltf, definition) {
    if(definition.vortex)return prepareVortex(gltf,definition);
    if (!gltf.scene || gltf.scenes.length !== 1) throw Error('Expected one robot scene');
    const source = gltf.scene;
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 0)) throw Error('Empty robot');
    const template = new THREE.Group();
    template.name = 'BlenderRobot';
    // Fit the widest horizontal dimension into the existing corridor footprint.
    const scale = 1.6 / Math.max(size.x, size.z);
    template.scale.setScalar(scale);
    template.position.set(-center.x * scale, definition.floor - .75 - bounds.min.y * scale, -center.z * scale);
    const sections = new Map(), sourceGeometries = new Set();
    source.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (mesh.isSkinnedMesh || Array.isArray(mesh.material)) throw Error('Unsupported robot mesh');
      sourceGeometries.add(mesh.geometry);
      const leg = mesh.name.match(/^Leg_(-?1)-([0-2])_/);
      const sectionName = mesh.name.startsWith('ANIM_') ? mesh.name : leg ? `Leg_${leg[1]}-${leg[2]}` : 'Hull';
      if (!sections.has(sectionName)) sections.set(sectionName, []);
      sections.get(sectionName).push(mesh);
    });
    if (!sections.size) throw Error('Robot has no meshes');
    for (const [name, meshes] of sections) {
      const group = new THREE.Group();group.name = name;
      if (name.startsWith('ANIM_')) {
        // Preserve the original ring/crown pivot and its orientation.
        meshes[0].matrixWorld.decompose(group.position, group.quaternion, group.scale);
      } else if (name.startsWith('Leg_')) {
        const upper = meshes.find(m => m.name.endsWith('_upper_armor')) || meshes[0];
        upper.getWorldPosition(group.position);
      }
      group.updateMatrix();
      const inverse = group.matrix.clone().invert();
      const byMaterial = new Map();
      for (const mesh of meshes) {
        const geometry = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        // These exports contain unused UVs, no textures. Keep normals and indices.
        for (const attribute of Object.keys(geometry.attributes)) {
          if (attribute !== 'position' && attribute !== 'normal') geometry.deleteAttribute(attribute);
        }
        if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
        byMaterial.get(mesh.material).push(geometry);
      }
      for (const [material, geometries] of byMaterial) {
        const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, false);
        geometries.forEach(g => g.dispose());
        if (!geometry) throw Error('Unable to batch robot geometry');
        geometry.computeBoundingBox();geometry.computeBoundingSphere();
        shared.add(geometry);shared.add(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `${name}_${material.name}`;
        mesh.castShadow = false;mesh.receiveShadow = false;
        group.add(mesh);
      }
      group.userData.basePosition = group.position.toArray();
      group.userData.baseQuaternion = group.quaternion.toArray();
      template.add(group);
    }
    sourceGeometries.forEach(geometry => geometry.dispose());
    return template;
  }

  function prepareVortex(gltf,definition){
    if(!gltf.scene||gltf.scenes.length!==1)throw Error('Expected one VORTEX scene');
    const source=gltf.scene;source.updateMatrixWorld(true);
    const core=source.getObjectByName('VORTEX_Core');
    if(!core)throw Error('Missing reactor pivot');
    const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0))throw Error('Empty VORTEX');
    const template=new THREE.Group();template.name='BlenderVortex';template.userData.vortex=true;
    template.userData.center=core.getWorldPosition(new THREE.Vector3()).toArray();
    // Reserve a small margin for rotating nested gimbals and the floating arms.
    const scale=1.56/Math.max(size.x,size.z);template.scale.setScalar(scale);
    template.position.set(-center.x*scale,definition.floor-.75-bounds.min.y*scale,-center.z*scale);
    const sections=new Map(),originalGeometries=new Set();
    source.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(mesh.isSkinnedMesh||Array.isArray(mesh.material))throw Error('Unsupported VORTEX mesh');
      originalGeometries.add(mesh.geometry);
      // Blender Python creates parent pivots: preserve their transforms, rather
      // than treating every armor plate as an independent animated object.
      let pivot=mesh;
      while(pivot&&pivot!==source&&!/^VORTEX_(Arm_[0-2]|Core|Ring_[01])$/.test(pivot.name))pivot=pivot.parent;
      const name=pivot&&pivot!==source?pivot.name:'Hull';
      if(!sections.has(name))sections.set(name,{pivot:name==='Hull'?null:pivot,meshes:[]});
      sections.get(name).meshes.push(mesh);
    });
    for(const name of ['VORTEX_Arm_0','VORTEX_Arm_1','VORTEX_Arm_2','VORTEX_Core','VORTEX_Ring_0','VORTEX_Ring_1'])if(!sections.has(name))throw Error('Missing VORTEX part '+name);
    for(const [name,section] of sections){
      const group=new THREE.Group();group.name=name;
      if(section.pivot)section.pivot.matrixWorld.decompose(group.position,group.quaternion,group.scale);
      group.updateMatrix();const inverse=group.matrix.clone().invert(),byMaterial=new Map();
      for(const mesh of section.meshes){
        const geometry=mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        for(const attribute of Object.keys(geometry.attributes))if(attribute!=='position'&&attribute!=='normal')geometry.deleteAttribute(attribute);
        if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);byMaterial.get(mesh.material).push(geometry);
      }
      for(const [material,geometries] of byMaterial){
        const geometry=THREE.BufferGeometryUtils.mergeBufferGeometries(geometries,false);geometries.forEach(g=>g.dispose());
        if(!geometry)throw Error('Unable to batch VORTEX geometry');
        geometry.computeBoundingBox();geometry.computeBoundingSphere();shared.add(geometry);shared.add(material);
        const mesh=new THREE.Mesh(geometry,material);mesh.name=name+'_'+material.name;group.add(mesh);
      }
      group.userData.basePosition=group.position.toArray();group.userData.baseQuaternion=group.quaternion.toArray();group.userData.baseScale=group.scale.toArray();
      if(name.startsWith('VORTEX_Ring_')){
        // Blender's glTF coordinate conversion gives the torus a local Y normal.
        const axis=new THREE.Vector3(0,1,0).applyQuaternion(section.meshes[0].getWorldQuaternion(new THREE.Quaternion()));
        group.userData.spinAxis=axis.toArray();
      }
      template.add(group);
    }
    originalGeometries.forEach(g=>g.dispose());return template;
  }

  function load(id) {
    const prior = cache.get(id);
    if (prior && (!prior.failedAt || Date.now() - prior.failedAt < retryMs)) return prior.promise;
    const entry = {failedAt: 0, promise: null};
    entry.promise = (async () => {
      let timer;
      const controller = new AbortController();
      try {
        if (!fetchModel || !THREE.GLTFLoader || !THREE.BufferGeometryUtils) throw Error('Loader unavailable');
        const request = (async () => {
          const response = await fetchModel(baseURL + definitions[id].file, {signal: controller.signal});
          if (!response.ok) throw Error(`Robot HTTP ${response.status}`);
          return response.arrayBuffer();
        })();
        const data = await Promise.race([request, new Promise((_, reject) => {
          timer = setTimeout(() => {controller.abort();reject(Error('Robot loading timed out'));}, timeoutMs);
        })]);
        const gltf = await new Promise((resolve, reject) => makeLoader().parse(data, baseURL, resolve, reject));
        return prepare(gltf, definitions[id]);
      } catch (error) {
        entry.failedAt = Date.now();
        // Loading a cosmetic must never interrupt a match or create an unhandled rejection.
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    cache.set(id, entry);
    return entry.promise;
  }

  function attach(rig, dispose) {
    if (!definitions[rig.skinId]) return;
    rig.modelSource = 'procedural';
    const state = {disposed: false};
    instances.set(rig.group, state);
    // Capture only the fallback visuals; gameplay adds glow/effects later.
    const fallback = [...rig.robot.children];
    rig.modelReady = load(rig.skinId).then(template => {
      if (!template || state.disposed) return false;
      const model = template.clone(true);
      rig.robot.add(model);
      for (const child of fallback) {rig.robot.remove(child);dispose(child);}
      rig.model = model;rig.modelSource = 'glb';
      rig.thrusters = [];rig.pieds = [];rig.legs = [];rig.rings = [];
      state.parts = model.children;
      if(model.userData.vortex){
        state.parts=[...model.children];state.center=new THREE.Vector3().fromArray(model.userData.center);
        state.ringAxes=new Map(state.parts.filter(p=>p.userData.spinAxis).map(p=>[p.name,new THREE.Vector3().fromArray(p.userData.spinAxis)]));
        state.modelPosition=model.position.clone();state.phase=0;state.lastTime=null;
        rig.visualRoot=model;rig.arms=[0,1,2].map(i=>model.getObjectByName('VORTEX_Arm_'+i));
        state.coreMaterials=[];
        model.getObjectByName('VORTEX_Core').traverse(mesh=>{
          if(!mesh.isMesh)return;
          mesh.material=mesh.material.clone();state.coreMaterials.push({material:mesh.material,intensity:mesh.material.emissiveIntensity});
          if(mesh.material.name==='Vortex_CorePlasma')rig.core=mesh;
        });
        const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]);
        rig.links=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:0xb865ff,transparent:true,opacity:.4,depthWrite:false}));model.add(rig.links);
      }
      return true;
    });
  }

  function update(rig, time, moving, dash) {
    if (rig.modelSource !== 'glb') return false;
    const state = instances.get(rig.group);
    if (!state || state.disposed) return true;
    if(rig.skinId==='rvortex'){updateVortex(rig,state,time,moving,dash);return true;}
    for (const part of state.parts) {
      part.position.fromArray(part.userData.basePosition);
      part.quaternion.fromArray(part.userData.baseQuaternion);
      if (part.name.startsWith('ANIM_')) {
        const direction = part.name.endsWith('_B') ? -1 : 1;
        spin.setFromAxisAngle(axisY, time * direction * (dash ? 1.8 : .7));
        part.quaternion.premultiply(spin);
      } else if (moving && part.name.startsWith('Leg_')) {
        const [, side, index] = part.name.match(/^Leg_(-?1)-(\d)$/);
        const stride = Math.sin(time * (dash ? 20 : 12) + Number(index) * 2 + (side === '-1' ? Math.PI : 0));
        part.position.y += Math.max(0, stride) * .08;
        part.rotation.z += stride * .06;
      }
    }
    return true;
  }

  function updateVortex(rig,state,time,moving,dash){
    const dt=state.lastTime===null?0:Math.min(.1,Math.max(0,time-state.lastTime));state.lastTime=time;
    state.phase+=dt*(dash?1.05:moving?.55:.2);
    const deployed=Math.min(1,Math.max(0,rig.ultimate||0)*3),center=state.center;
    rig.model.position.copy(state.modelPosition);rig.model.position.y+=Math.sin(time*2.2)*.025;
    rig.model.rotation.set(moving?(dash?.2:.12):Math.sin(time*.8)*.02,0,moving?-.07:Math.sin(time*.65)*.015);
    for(const part of state.parts){
      part.position.fromArray(part.userData.basePosition);part.quaternion.fromArray(part.userData.baseQuaternion);part.scale.fromArray(part.userData.baseScale);
      if(part.name.startsWith('VORTEX_Arm_')){
        const i=Number(part.name.slice(-1));spin.setFromAxisAngle(axisY,state.phase);
        part.position.sub(center);part.position.x*=1+deployed*.18;part.position.z*=1+deployed*.18;
        part.position.applyQuaternion(spin).add(center);part.position.y+=Math.sin(time*(moving?4:1.8)+i*2)*.025+deployed*.045;
        part.quaternion.premultiply(spin);
      }else if(part.name.startsWith('VORTEX_Ring_')){
        const axis=state.ringAxes.get(part.name);
        spin.setFromAxisAngle(axis,time*(part.name.endsWith('0')?1:-1)*(dash?2.3:moving?1.25:.55));part.quaternion.premultiply(spin);
      }else if(part.name==='VORTEX_Core'){
        spin.setFromAxisAngle(axisY,time*.5);part.quaternion.premultiply(spin);part.scale.multiplyScalar(1+deployed*.06+Math.sin(time*5)*.012);
      }
    }
    for(const core of state.coreMaterials)core.material.emissiveIntensity=core.intensity*(1+deployed*.75+Math.sin(time*5)*.04);
    const points=rig.links.geometry.attributes.position;
    rig.arms.forEach((arm,i)=>points.setXYZ(i,arm.position.x,arm.position.y,arm.position.z));points.needsUpdate=true;rig.links.geometry.computeBoundingSphere();rig.links.material.opacity=.28+deployed*.35;
  }

  function release(tree) {
    tree.traverse(object => {
      const state = instances.get(object);
      if (state) {state.disposed = true;instances.delete(object);}
    });
  }
  // Templates are bounded to three robots and shared for the page lifetime.
  return {attach, update, release, isShared: resource => shared.has(resource)};
});
