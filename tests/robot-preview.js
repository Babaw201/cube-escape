// Visual review harness, injected by tests/preview-server.cjs only.
addEventListener('load',()=>window.gameEval(`(async()=>{
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x081322);
  const cam=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,30);cam.position.set(3.2,3,6.7);cam.lookAt(0,.95,0);
  const render=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});render.setSize(innerWidth,innerHeight);render.setPixelRatio(Math.min(devicePixelRatio,1.5));render.outputEncoding=THREE.sRGBEncoding;render.toneMapping=THREE.ACESFilmicToneMapping;render.toneMappingExposure=1.15;
  sc.add(new THREE.HemisphereLight(0xe7f4ff,0x28304a,1.4));const key=new THREE.DirectionalLight(0xffffff,1.7);key.position.set(3,5,4);sc.add(key);
  const rigs=[creerRobot(-1.3,0,false,'rspectre'),creerRobot(1.3,0,true,'rsovereign')];rigs.forEach(r=>sc.add(r.group));
  await Promise.all(rigs.map(r=>r.modelReady));
  const stats=rigs.map(r=>{let meshes=0,triangles=0;r.model?.traverse(m=>{if(m.isMesh){meshes++;triangles+=m.geometry.index.count/3;}});return r.skinId+': '+r.modelSource+' · '+meshes+' dessins · '+triangles+' triangles';});
  document.body.replaceChildren(render.domElement);document.body.style.cssText='margin:0;overflow:hidden;background:#081322;color:#dcecff;font:16px system-ui';
  const title=document.createElement('div');title.style.cssText='position:absolute;left:28px;top:20px;line-height:1.7';title.textContent='LIMBYRINTH — SPECTRE & SOUVERAIN · Modèles Blender';document.body.append(title);
  const info=document.createElement('pre');info.style.cssText='position:absolute;left:28px;bottom:18px;font:14px system-ui;line-height:1.8';info.textContent=stats.join('\\n');document.body.append(info);
  const tick=()=>{const time=performance.now()/1000;rigs.forEach(r=>animerRobot(r,time,true,false));render.render(sc,cam);requestAnimationFrame(tick);};tick();
})()`));
