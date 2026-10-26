/* Blender visuals for Three.js r128. Gameplay continues to own the rig roots. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.LimbyrinthRobotModels = factory(root.THREE);
})(typeof window !== 'undefined' ? window : globalThis, function createRobotModels(THREE, options = {}) {
  const definitions = {
    rspectre: {file: 'spectre.glb', floor: .25},
    rsovereign: {file: 'souverain.glb', floor: .06}
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
      return true;
    });
  }

  function update(rig, time, moving, dash) {
    if (rig.modelSource !== 'glb') return false;
    const state = instances.get(rig.group);
    if (!state || state.disposed) return true;
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

  function release(tree) {
    tree.traverse(object => {
      const state = instances.get(object);
      if (state) {state.disposed = true;instances.delete(object);}
    });
  }
  // Templates are bounded to two robots and shared for the page lifetime.
  return {attach, update, release, isShared: resource => shared.has(resource)};
});
