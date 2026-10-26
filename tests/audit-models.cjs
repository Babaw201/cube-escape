const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const validator=require('gltf-validator');
const THREE=require('../vendor/three.min.js');
global.THREE=THREE;require('../vendor/GLTFLoader.js');
(async()=>{
  const audit={format:'glTF 2.0',threeRevision:THREE.REVISION,models:{}};
  for(const id of ['spectre','souverain']){
    const bytes=fs.readFileSync(path.join(__dirname,'../assets/models/'+id+'.glb'));
    const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    const result=await validator.validateBytes(new Uint8Array(bytes),{uri:id+'.glb'});
    const gltf=await new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'',resolve,reject));
    const bounds=new THREE.Box3().setFromObject(gltf.scene);let triangles=0,vertices=0;
    gltf.scene.traverse(mesh=>{if(mesh.isMesh){triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;vertices+=mesh.geometry.attributes.position.count;}});
    audit.models[id]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),generator:json.asset.generator,
      scenes:json.scenes.length,root:json.nodes[json.scenes[0].nodes[0]].name,nodes:json.nodes.length,meshes:json.meshes.length,
      vertices,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},
      images:json.images?.length||0,textures:json.textures?.length||0,cameras:json.cameras?.length||0,animations:json.animations?.length||0,
      materials:json.materials,extensions:json.extensionsUsed,validation:{errors:result.issues.numErrors,warnings:result.issues.numWarnings,
        infos:result.issues.numInfos,codes:[...new Set(result.issues.messages.map(m=>m.code))]}};
    if(result.issues.numErrors||result.issues.numWarnings)process.exitCode=1;
  }
  fs.writeFileSync(path.join(__dirname,'../docs/robot-model-audit.json'),JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(audit.models).map(([id,m])=>[id,{bytes:m.bytes,triangles:m.triangles,dimensions:m.bounds.size,validation:m.validation}])) ,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
