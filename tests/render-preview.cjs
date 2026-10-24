// CPU contact sheet of the actual Three.js meshes, usable without a GPU/browser.
const {runtime}=require('./runtime.cjs');
const {createCanvas}=require('@napi-rs/canvas');
const fs=require('node:fs');
const path=require('node:path');
const game=runtime();
const models=game.run(`ROBOT_SKINS.map(skin=>{
  const rig=creerRobot(0,0,false,skin.id);animerRobot(rig,1,true,false);rig.group.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(36,1.6,.1,30);camera.position.set(3.2,2.7,4.7);camera.lookAt(0,1.3,0);camera.updateMatrixWorld(true);
  const triangles=[];const light=new THREE.Vector3(-.5,1,1).normalize();
  rig.group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry.attributes.position)return;
    const geometry=mesh.geometry,positions=geometry.attributes.position,index=geometry.index,mat=mesh.material;
    for(let i=0;i<(index?index.count:positions.count);i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      const normal=new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(points[1],points[0]),new THREE.Vector3().subVectors(points[2],points[0])).normalize();
      if(mat.side!==THREE.DoubleSide&&normal.dot(new THREE.Vector3().subVectors(camera.position,points[0]))<0)continue;
      const color=(mat.color||new THREE.Color(0xffffff)).clone().multiplyScalar(mat.isMeshBasicMaterial?1:.42+.58*Math.max(0,normal.dot(light)));
      const projected=points.map(p=>p.project(camera));
      triangles.push({p:projected.map(p=>[p.x,p.y]),z:projected.reduce((sum,p)=>sum+p.z,0)/3,color:'#'+color.getHexString(),alpha:mat.opacity??1});
    }
  });
  return {name:skin.name,desc:skin.desc,accent:'#'+skin.accent.toString(16),triangles:triangles.sort((a,b)=>b.z-a.z)};
})`);
const canvas=createCanvas(1440,1000),ctx=canvas.getContext('2d');
ctx.fillStyle='#07101d';ctx.fillRect(0,0,1440,1000);
ctx.fillStyle='#85b0c9';ctx.font='bold 14px sans-serif';ctx.fillText('LIMBYRINTH / ATELIER ROBOT',64,48);
ctx.fillStyle='#e3f4ff';ctx.font='bold 36px sans-serif';ctx.fillText('Quatre formes. Un même robot à piloter.',64,102);
ctx.fillStyle='#9cb5c9';ctx.font='17px sans-serif';ctx.fillText('Modèles gratuits · animations dédiées · apparence sauvegardée',64,137);
models.forEach((model,k)=>{
  const x=64+(k%2)*676,y=180+Math.floor(k/2)*390,w=636,h=356;
  const gradient=ctx.createRadialGradient(x+w*.5,y+h*.45,10,x+w*.5,y+h*.5,w*.65);gradient.addColorStop(0,'#284252');gradient.addColorStop(1,'#0c1929');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.roundRect(x,y,w,h,18);ctx.fill();ctx.strokeStyle='#2a455b';ctx.stroke();
  ctx.fillStyle='#050d1666';ctx.beginPath();ctx.ellipse(x+w*.5,y+265,110,20,0,0,Math.PI*2);ctx.fill();
  for(const tri of model.triangles){ctx.globalAlpha=tri.alpha;ctx.fillStyle=tri.color;ctx.beginPath();tri.p.forEach(([px,py],j)=>{const sx=x+w/2+px*240,sy=y+146-py*150;j?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy);});ctx.closePath();ctx.fill();}
  ctx.globalAlpha=1;ctx.fillStyle=model.accent;ctx.font='bold 23px sans-serif';ctx.fillText(model.name.toUpperCase(),x+26,y+303);
  ctx.fillStyle='#a4bccc';ctx.font='14px sans-serif';ctx.fillText(model.desc,x+26,y+330);
});
ctx.fillStyle='#6f8ca4';ctx.font='12px sans-serif';ctx.fillText('Aperçu des maillages du jeu · rendu de contrôle hors navigateur',64,971);
fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../artifacts/robots.png'),canvas.toBuffer('image/png'));
