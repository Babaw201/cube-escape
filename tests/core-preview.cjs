/* Reproducible CPU geometry capture when Chromium/GPU sockets are unavailable.
 * Uses the actual meshes, instance matrices and materials, not an artist mockup.
 * WebGL screenshots and GPU timing are produced separately by core-browser.test.cjs.
 */
const THREE=require('../vendor/three.min.js');
const {createCanvas}=require('@napi-rs/canvas');
const {runtime}=require('./runtime.cjs');
const fs=require('node:fs');
const path=require('node:path');
const kit=require('../core-environment.js')(THREE);
const out=path.join(__dirname,'../artifacts/core');fs.mkdirSync(out,{recursive:true});
function render(root,camera,width=1200,height=750){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.fillStyle='#0b1520';ctx.fillRect(0,0,width,height);
  root.updateMatrixWorld(true);camera.aspect=width/height;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const triangles=[],light=new THREE.Vector3(.35,.85,.6).normalize();
  const visible=o=>o.visible&&(o.parent===null||visible(o.parent));
  function capture(mesh,matrix){
    const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(let i=0;i<(index?index.count:p.count);i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(matrix));
      const normal=new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(points[1],points[0]),new THREE.Vector3().subVectors(points[2],points[0])).normalize();
      const mat=materials.length===1?materials[0]:materials[geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0];
      if(!mat||mat.side!==THREE.DoubleSide&&normal.dot(new THREE.Vector3().subVectors(camera.position,points[0]))<0)continue;
      let polygon=points.map(v=>v.applyMatrix4(camera.matrixWorldInverse));
      const clipped=[];
      for(let k=0;k<polygon.length;k++){
        const a=polygon[k],b=polygon[(k+1)%polygon.length],aInside=a.z<-.12,bInside=b.z<-.12;
        if(aInside)clipped.push(a);
        if(aInside!==bInside)clipped.push(a.clone().lerp(b,(-.12-a.z)/(b.z-a.z)));
      }
      if(clipped.length<3)continue;
      const z=clipped.reduce((s,p)=>s-p.z,0)/clipped.length,projected=clipped.map(v=>v.clone().applyMatrix4(camera.projectionMatrix));
      if(projected.every(p=>p.x< -1)||projected.every(p=>p.x>1)||projected.every(p=>p.y< -1)||projected.every(p=>p.y>1))continue;
      const shade=mat.isMeshBasicMaterial?1:.48+.52*Math.max(0,normal.dot(light));
      const color=(mat.color||new THREE.Color(0xffffff)).clone().multiplyScalar(shade);
      if(mat.emissive)color.add(mat.emissive.clone().multiplyScalar((mat.emissiveIntensity||0)*.24));
      color.lerp(new THREE.Color(0x101c28),Math.min(.65,z/115));
      triangles.push({points:projected,z,color:'#'+color.getHexString(),alpha:mat.opacity??1});
    }
  }
  root.traverse(mesh=>{
    if(!mesh.isMesh||!visible(mesh))return;
    if(mesh.isInstancedMesh){const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);capture(mesh,new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld,matrix));}}
    else capture(mesh,mesh.matrixWorld);
  });
  const pixels=ctx.getImageData(0,0,width,height),depth=new Float32Array(width*height);depth.fill(Infinity);
  const edge=(a,b,x,y)=>(x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x);
  for(const t of triangles){
    const vertices=t.points.map(p=>({x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z}));
    const rgb=[1,3,5].map(i=>parseInt(t.color.slice(i,i+2),16));
    for(let k=1;k<vertices.length-1;k++){
      const [a,b,c]=[vertices[0],vertices[k],vertices[k+1]],area=edge(a,b,c.x,c.y);if(Math.abs(area)<1e-6)continue;
      const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const top=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
        const wa=edge(b,c,x+.5,y+.5)/area,wb=edge(c,a,x+.5,y+.5)/area,wc=1-wa-wb;
        if(wa<0||wb<0||wc<0)continue;const z=wa*a.z+wb*b.z+wc*c.z,index=y*width+x;
        if(z>=depth[index])continue;depth[index]=z;
        for(let channel=0;channel<3;channel++)pixels.data[index*4+channel]=rgb[channel]*t.alpha+pixels.data[index*4+channel]*(1-t.alpha);
      }
    }
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
function caption(canvas,title,subtitle){
  const ctx=canvas.getContext('2d');ctx.fillStyle='#05101de8';ctx.fillRect(0,0,canvas.width,65);
  ctx.font='bold 21px sans-serif';ctx.fillStyle='#d8f3ff';ctx.fillText(title,25,29);
  ctx.font='13px sans-serif';ctx.fillStyle='#95afc4';ctx.fillText(subtitle,25,51);
  return canvas;
}
const g=Array.from({length:15},(_,z)=>Array.from({length:15},(_,x)=>x===7&&z>0&&z<14?0:1));
const camera=new THREE.PerspectiveCamera(62,1.6,.1,150);camera.position.set(.75,1.55,21.3);camera.lookAt(-.15,1.65,-15);
const game=runtime({}, {LimbyrinthCore:undefined});
game.context.gameEval(`genMaze=()=>({g:${JSON.stringify(g)},dynCells:[]});cur=0;build();`);
const before=caption(render(game.context.gameEval('world'),camera),'AVANT / couloir de référence','Géométrie originale · même grille et caméra · capture CPU sans textures');
const env=kit.build({grid:g,level:0,quality:'high',seed:123});env.update(1,{firstPerson:true});
const after=caption(render(env.group,camera),'APRÈS / confinement CORE','Kit réel instancié · panneaux multicouches, joints, ventilation et plafond · capture CPU');
fs.writeFileSync(path.join(out,'corridor-before.png'),before.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'corridor-after.png'),after.toBuffer('image/png'));env.dispose();
const sheet=createCanvas(1600,1140),ctx=sheet.getContext('2d');ctx.fillStyle='#08111b';ctx.fillRect(0,0,1600,1140);
const sectorGame=runtime({}, {LimbyrinthCore:undefined});
for(let level=0;level<5;level++){
  sectorGame.context.gameEval(`nP=1;start(${level},123);`);
  const grid=sectorGame.context.gameEval('grid');
  const e=kit.build({grid,level,quality:'high',seed:123});
  const cam=new THREE.PerspectiveCamera(48,1.6,.1,160);cam.position.set(level===4?33:19,level===4?37:22,level===4?39:24);cam.lookAt(0,level===4?1:0,-4);
  const c=caption(render(e.group,cam,800,380),String(level+1).padStart(2,'0')+' / '+kit.themes[level].name,'Géométrie du jeu · qualité élevée · capture CPU');
  ctx.drawImage(c,(level%2)*800,Math.floor(level/2)*380);e.dispose();
}
ctx.fillStyle='#c4dce9';ctx.font='bold 23px sans-serif';ctx.fillText('CORE / cinq secteurs',850,870);
ctx.font='16px sans-serif';ctx.fillText('Aucune nouvelle lumière dynamique.',850,910);ctx.fillText('Les volumes restent dans les cellules solides.',850,940);
ctx.fillText('Mesures WebGL séparées en CI.',850,970);
fs.writeFileSync(path.join(out,'sectors.png'),sheet.toBuffer('image/png'));
console.log('CORE geometry captures:',out);
module.exports={render};
