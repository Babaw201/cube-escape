/* CORE modular scenery, Three.js r128. Never writes the collision grid or uses RNG. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LimbyrinthCore=factory(root.THREE);
})(typeof window!=='undefined'?window:globalThis,function createCore(THREE,options){
  'use strict';
  options=options||{};
  const themes=[
    {name:'Confinement',shell:0x273b48,panel:0xc4ced1,edge:0x718793,floor:0x52616a,accent:0x65e5fa,wear:0x5c717b},
    {name:'Industrie',shell:0x292d30,panel:0x665a4c,edge:0x90938b,floor:0x3e4040,accent:0xffac57,wear:0x49392d},
    {name:'Cœur énergétique',shell:0x272c43,panel:0x697284,edge:0x9a9fb1,floor:0x3e4355,accent:0xb391ff,wear:0x434253},
    {name:'Labyrinthe instable',shell:0x263746,panel:0x526a79,edge:0x96a6b1,floor:0x354855,accent:0x86b9db,wear:0x2d343d},
    {name:'Arène CORE',shell:0x292f39,panel:0x686c70,edge:0xa4a398,floor:0x42464a,accent:0xffcb78,wear:0x3f3732}
  ];
  const qualities={low:{detail:0,pixelRatio:1,effects:false},medium:{detail:1,pixelRatio:1.25,effects:true},high:{detail:2,pixelRatio:1.75,effects:true}};
  // Integer hash: decorating must not advance the shared campaign/coop PRNG.
  const hash=(x,z,seed)=>{let n=Math.imul(x+17,374761393)^Math.imul(z+31,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};

  // Three r128 itself uses Math.random for object UUIDs. Isolate those calls too.
  function isolated(fn,seed=1){
    const previous=Math.random;let value=seed|0;
    Math.random=()=>{value=(Math.imul(value,1664525)+1013904223)|0;return (value>>>0)/4294967296;};
    try{return fn();}finally{Math.random=previous;}
  }

  function build({grid,dynamicCells=[],level=0,cellSize=4,height=2.8,quality='medium',seed=1,reducedMotion=false,accent,themeOverride={}}={}){
    if(!grid?.length||grid.some(row=>row.length!==grid.length))throw Error('CORE requires a square grid');
    if(cellSize!==4||height!==2.8)throw Error('CORE modules use 4 m cells and 2.8 m walls');
    const theme={...(themes[level]||themes[0]),...themeOverride},q=qualities[quality]||qualities.medium,detail=q.detail;
    const n=grid.length,T=cellSize,H=height,half=T/2,at=i=>(i-n/2+.5)*T;
    const reserved=new Set(dynamicCells.map(c=>c.join(',')));
    const solid=(x,z)=>grid[z]?.[x]===1&&!reserved.has(x+','+z)&&!(level===2&&x===Math.floor(n/2)&&z===Math.floor(n/2));
    const group=new THREE.Group();group.name='CORE / '+theme.name;
    const ceiling=new THREE.Group();ceiling.name='CORE / removable ceiling';ceiling.visible=false;group.add(ceiling);
    const effects=new THREE.Group();effects.name='CORE / ambient effects';effects.visible=q.effects&&!reducedMotion;group.add(effects);
    const resources=new Set(),attachments=[],batches=new Map(),pending=new Set(),loadedSlots=new Set(),rotors=[];let dead=false,lastCue=-1,replacement=null,lastState={};
    const own=r=>(resources.add(r),r);
    const standard=(color,roughness=.65,metalness=.55)=>own(new THREE.MeshStandardMaterial({color,roughness,metalness}));
    const mats={shell:standard(theme.shell,.78),panel:standard(theme.panel,.52,.58),edge:standard(theme.edge,.42,.76),
      floor:standard(theme.floor,.84,.35),wear:standard(theme.wear,.92,.25),
      dark:standard(0x131f27,.8,.4),accent:own(new THREE.MeshStandardMaterial({color:accent??theme.accent,emissive:accent??theme.accent,emissiveIntensity:.65,roughness:.38,metalness:.25})),
      warning:standard(0xd5ad56,.8,.25),screen:own(new THREE.MeshStandardMaterial({color:0x174454,emissive:0x397887,emissiveIntensity:.45,roughness:.3})),signal:own(new THREE.MeshBasicMaterial({color:theme.accent}))};
    mats.accent.userData.coreAccent=true;
    const box=own(new THREE.BoxGeometry(1,1,1));box.computeBoundingBox();
    const cylinder=own(new THREE.CylinderGeometry(1,1,1,10));cylinder.computeBoundingBox();
    const dummy=new THREE.Object3D();
    function add(material,zone,x,y,z,sx,sy,sz,yaw=0,geometry=box,parent=group,tilt=0){
      const key=material+'|'+zone+'|'+geometry.id;
      if(!batches.has(key))batches.set(key,{material:mats[material],geometry,zone,parent,items:[]});
      batches.get(key).items.push([x,y,z,sx,sy,sz,yaw,tilt]);
    }
    // Wall module pivot: cell centre; face coordinates: u horizontal, y up, d depth.
    function wall(x,z){
      const cx=at(x),cz=at(z),v=hash(x,z,seed),damaged=level===3||v%11===0;
      const part=(mat,u,y,d,w,h,depth,yaw)=>{
        const c=Math.cos(yaw),s=Math.sin(yaw);
        add(mat,'solid',cx+c*u+s*d,y,cz-s*u+c*d,w,h,depth,yaw);
      };
      add('shell','solid',cx,H/2,cz,T-.24,H,T-.24);
      add('panel','solid',cx,H+.015,cz,T-.06,.07,T-.06);
      // Expose faces against EVERY possible opening, including closed dynamic doors.
      for(const [dx,dz,yaw]of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
        const nx=x+dx,nz=z+dz;
        if(nx<0||nz<0||nx>=n||nz>=n||solid(nx,nz))continue;
        part('dark',0,H*.47,1.91,3.98,H*.85,.12,yaw);
        part('panel',0,H*.49,1.94,3.56,H*.68,.06,yaw);
        part('edge',0,.14,1.96,3.98,.22,.065,yaw);
        part('edge',0,H-.15,1.96,3.98,.24,.065,yaw);
        for(const u of [-1.87,1.87])part('edge',u,H/2,1.96,.14,H,.065,yaw);
        part('accent',0,H-.30,1.975,3.42,.045,.035,yaw);
        part('dark',0,.64,1.978,3.40,.055,.025,yaw);
        if(detail){
          // Real inset service hatches, split panels, junctions and corner fasteners.
          for(const u of [-.9,.9]){
            part('shell',u,1.33,1.98,.025,1.30,.018,yaw);
            for(const y of [.55,2.15])part('dark',u,y,1.98,.055,.055,.025,yaw);
          }
          part('dark',.96,1.33,1.98,1.22,.57,.025,yaw);
          for(let i=0;i<5;i++)part('edge',.96,1.11+i*.1,1.99,1.06,.033,.018,yaw);
          part('edge',-.96,1.45,1.982,1.20,.71,.02,yaw);
          part('panel',-.96,1.45,1.996,1.08,.58,.006,yaw);
          for(const u of [-1.72,1.72])for(const y of [.31,2.48])part('dark',u,y,1.99,.065,.065,.02,yaw);
          part('warning',-.96,.82,1.99,.74,.11,.02,yaw);
          for(let i=0;i<3;i++)part('dark',-1.22+i*.24,.82,1.999,.10,.11,.002,yaw);
          if(v%4===0){
            // Flush terminal: housing, recessed screen, four status lines and keypad.
            part('dark',-.96,1.55,1.988,1.31,.95,.02,yaw);
            part('screen',-.96,1.63,1.999,1.10,.56,.002,yaw);
            for(let i=0;i<4;i++)part('accent',-1.30+i*.13,1.76-i*.10,2,.06,.025,.001,yaw);
            for(let i=0;i<4;i++)part('edge',-1.30+i*.23,1.23,1.999,.13,.05,.001,yaw);
          }
        }
        if(detail>1){
          for(const u of [-1.5,0,1.5])part('edge',u,2.48,1.98,.06,.09,.025,yaw);
          if(damaged){
            for(let i=0;i<4;i++)part('wear',-.28+i*.13,.9+i*.18,1.999,.035,.32,.002,yaw);
            part('wear',.33,1.86,1.999,.31,.14,.002,yaw);
          }
        }
        if(level===1&&detail){
          for(const y of [1.98,2.22])part('edge',0,y,1.96,3.62,.12,.07,yaw);
        }else if(level===2){
          for(const u of [-1.55,1.55])part('accent',u,1.4,1.984,.065,1.30,.025,yaw);
        }
      }
      // A coherent roof cassette makes the top-down silhouette more than a cube.
      add('edge','solid',cx,H+.10,cz,3.48,.10,3.48);
      add('dark','solid',cx,H+.17,cz,2.96,.10,2.96);
      if(detail){
        for(const s of [-1,1])add('accent','solid',cx+s*1.38,H+.23,cz,.045,.025,2.5);
        if(level===1)for(const s of [-1,1])add('edge','solid',cx+s*.91,H+.36,cz,.20,.22,3.5);
        else if(level===2)add('accent','solid',cx,H+.24,cz,.13,.04,2.8);
        else for(let j=0;j<4;j++)add('edge','solid',cx-.7+j*.46,H+.24,cz,.24,.04,1.7);
      }
    }

    function floor(x,z){
      const cx=at(x),cz=at(z),v=hash(x,z,seed);
      add('floor','floor',cx,-.045,cz,3.96,.10,3.96);
      add('dark','floor',cx,.008,cz,3.78,.012,.055);
      for(const s of [-1,1]){
        add('dark','floor',cx+s*1.76,.008,cz,.12,.012,3.80);
        add('accent','floor',cx+s*1.76,.018,cz,.04,.012,.48);
      }
      if(detail){
        add('edge','floor',cx,.008,cz+1.75,3.5,.013,.04);
        for(const s of [-1,1])add('edge','floor',cx+s*1.50,.016,cz-1.51,.075,.012,.075);
        if(v%5===0||level===1){
          add('dark','floor',cx,.012,cz,.75,.014,2.6);
          for(let j=0;j<7;j++)add('edge','floor',cx,.025,cz-1.1+j*.36,.67,.008,.045);
        }
        if(level===2){add('accent','floor',cx,.021,cz,.045,.01,3.6);}
        if(level===3&&v%4===0)for(let j=0;j<3;j++)add('wear','floor',cx+j*.13,.022,cz+.4+j*.13,.035,.008,.5);
        const openings=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid[z+dz]?.[x+dx]===0||reserved.has((x+dx)+','+(z+dz)));
        if(openings.length>=3){
          add('warning','floor',cx,.026,cz,.70,.008,.08);
          for(const s of [-1,1])add('warning','floor',cx+.30,.026,cz+s*.12,.32,.008,.08,s*Math.PI/4);
        }
      }
      // Cutaway ceiling: NO camera collision/occlusion in top-down and shared coop.
      add('shell','roof',cx,H+.73,cz,3.98,.14,3.98,0,box,ceiling);
      add('edge','roof',cx,H+.43,cz-1.85,4,.22,.18,0,box,ceiling);
      add('accent','roof',cx,H+.63,cz,1.48,.035,.20,0,box,ceiling);
      if(detail){
        for(const s of [-1,1])add('dark','roof',cx+s*1.47,H+.43,cz,.26,.20,3.98,0,box,ceiling);
        add('edge','roof',cx+1.47,H+.38,cz,.12,.10,3.98,0,box,ceiling);
      }
    }

    function equipment(x,z){
      const cx=at(x),cz=at(z),v=hash(x,z,seed);
      // All props are within existing solid wall cells; never in a walkable tile.
      add('shell','solid',cx,H+.53,cz,2.70,.60,2.70);
      if(level===1){
        add('edge','solid',cx,H+1.10,cz,.75,1.6,.75,0,cylinder);
        for(const y of [H+.5,H+1.8])add('dark','solid',cx,y,cz,.88,.16,.88,0,cylinder);
        add('accent','solid',cx,H+1.95,cz,.42,.10,.42,0,cylinder);
      }else{
        add('edge','solid',cx,H+.86,cz,1.85,.20,1.85);
        add('dark','solid',cx,H+1.1,cz,1.4,.30,1.4);
        add('accent','solid',cx,H+1.29,cz,.85,.05,.85);
        if(level===0)add('panel','solid',cx,H+1.43,cz,1.50,.17,1.50);
        if(level===2){
          add('accent','solid',cx,H+1.8,cz,.35,1.2,.35,0,cylinder);
          add('edge','solid',cx,H+2.3,cz,1.2,.12,1.2);
        }
        if(level===3)add('wear','solid',cx+.52,H+1.43,cz,1.2,.27,.50,Math.PI/8);
      }
      if(detail>1)for(const s of [-1,1])add('warning','solid',cx+s,H+.88,cz,.11,.16,2.1);
      if(detail>1&&!reducedMotion&&rotors.length<4)rotors.push([cx,H+1.58,cz]);
      return v;
    }

    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      if(solid(x,z))wall(x,z);else floor(x,z);
      if(solid(x,z)&&((x===0||z===0||x===n-1||z===n-1)&&hash(x,z,seed)%5===0))equipment(x,z);
    }
    if(level===4&&n===15){
      // Platform is a flush floor graphic, leaving the spawn, relays and paths free.
      for(const s of [-1,1]){
        add('warning','floor',s*5.6,.032,0,.10,.012,10.9);
        add('warning','floor',0,.032,s*5.6,10.9,.012,.10);
      }
      // The towering reactor occupies an existing border cell, NEVER the centre spawn.
      const x=at(7),z=at(0);
      for(const dx of [-1.2,1.2])for(const dz of [-1.2,1.2])add('edge','solid',x+dx,H+3,z+dz,.18,5.8,.18);
      add('accent','solid',x,H+3.0,z,.72,5.1,.72,0,cylinder);
      for(const y of [H+.8,H+2.2,H+4.0,H+5.6])add('shell','solid',x,y,z,1.62,.30,1.62,0,cylinder);
      for(const s of [-1,1])add('edge','solid',x+s*1.50,H+3,z,.20,6.0,.6);
      for(const [bx,bz]of [[0,4],[14,4],[0,10],[14,10]]){
        equipment(bx,bz);
        add('signal','solid',at(bx),H+1.55,at(bz),1.7,.14,1.7);
      }
      // Wave signal stays distinct from gameplay's red attacks / green relays.
      add('signal','solid',x,H+6.2,z,2.5,.35,1.1);
    }
    function flush(target,batch){
      if(!batch.items.length)return;
      const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);
      mesh.name='CORE / '+batch.zone;mesh.userData.zone=batch.zone;
      // r128 cannot cull individual instances; the 60m complex is intentionally one batch.
      mesh.frustumCulled=false;
      batch.items.forEach(([x,y,z,sx,sy,sz,yaw,tilt],i)=>{
        dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(tilt,yaw,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;target.add(mesh);
    }
    for(const b of batches.values())flush(b.parent,b);
    let turbine;
    if(rotors.length){
      turbine=new THREE.InstancedMesh(box,mats.edge,rotors.length*3);turbine.name='CORE / turbines';turbine.userData.zone='solid';turbine.frustumCulled=false;group.add(turbine);
    }

    // A tiny, bounded steam/spark cloud. No textures, lights, transparent planes or timers.
    const particlePositions=[];
    if(effects.visible){
      for(let i=0;i<24;i++){
        const x=i%2?n-1:0,z=1+hash(i,0,seed)%(n-2);
        particlePositions.push(at(x),H+.6+(i%4)*.18,at(z)+(i%3)*.15);
      }
      const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
      const mat=own(new THREE.PointsMaterial({color:theme.accent,size:.10,transparent:true,opacity:.32,depthWrite:false}));
      const cloud=new THREE.Points(g,mat);cloud.frustumCulled=false;effects.add(cloud);
    }
    const stats={sector:theme.name,quality:qualities[quality]?quality:'medium',instances:0,drawCalls:0,triangles:0,dynamicLights:0};
    group.traverse(o=>{if(o.isInstancedMesh){stats.instances+=o.count;stats.drawCalls++;stats.triangles+=(o.geometry.index.count/3)*o.count;}else if(o.isPoints)stats.drawCalls++;});
    // Includes roofs (even though hidden in top-down): conservative budget.
    const api={group,ceiling,effects,stats,source:'procedural',wallMaterial:mats.panel,accentMaterial:mats.accent,
      isDisposed:()=>dead,
      setVisual(visual){
        if(dead){visual.dispose();return;}
        replacement?.dispose();
        for(const child of group.children)if(child!==effects)child.visible=false;
        attachments.forEach(o=>o.visible=false);replacement=visual;group.add(visual.group);
        api.source='blender';api.stats=visual.stats;api.ceiling=visual.ceiling;
        api.accentMaterial=visual.accentMaterial;api.wallMaterial=visual.wallMaterial;
        visual.update(0,lastState);
      },
      loadAsset({url,cell}={}){
        const fetchAsset=options.fetch||(typeof fetch==='function'&&fetch.bind(globalThis));
        if(dead||detail===0||!fetchAsset||!THREE.GLTFLoader||!/^assets\/models\/core\/[\w-]+\.glb$/.test(url)||
          !Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger)||!solid(...cell)||!cell.some(v=>v===0||v===n-1)||loadedSlots.size>=6||loadedSlots.has(cell.join(',')))return Promise.resolve(false);
        const slot=cell.join(',');loadedSlots.add(slot);
        return new Promise(resolve=>{
          const controller=new AbortController();let settled=false;
          const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);pending.delete(cancel);if(!value)loadedSlots.delete(slot);resolve(value);};
          const cancel=()=>{controller.abort();finish(false);};
          const timer=setTimeout(cancel,options.assetTimeoutMs??5000);pending.add(cancel);
          (async()=>{
            const response=await fetchAsset(url,{signal:controller.signal});if(!response.ok||settled)return false;
            const bytes=await response.arrayBuffer();if(settled)return false;
            if(bytes.byteLength<24||bytes.byteLength>2*1024*1024)return false;
            const header=new DataView(bytes);
            if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength||header.getUint32(16,true)!==0x4e4f534a)return false;
            const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,header.getUint32(12,true))));
            // Autonomous, texture-free GLBs: no external requests or decoder dependencies.
            if(json.buffers?.some(b=>b.uri)||json.images?.length||json.extensionsRequired?.some(x=>!['KHR_materials_emissive_strength'].includes(x)))return false;
            const gltf=await new Promise((ok,fail)=>isolated(()=>new THREE.GLTFLoader().parse(bytes,'',ok,fail),seed));
            const assetResources=new Set();let triangles=0,unsupported=false;
            gltf.scene?.traverse(o=>{
              if(o.isLight||o.isCamera||o.isSkinnedMesh)unsupported=true;
              if(o.geometry){assetResources.add(o.geometry);triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}
              for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)assetResources.add(m);
            });
            const discard=()=>assetResources.forEach(r=>r.dispose());
            if(dead||settled||!gltf.scene||unsupported||triangles>20000||triangles===0){discard();return false;}
            gltf.scene.updateMatrixWorld(true);
            const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
            if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0)){discard();return false;}
            const fitted=isolated(()=>new THREE.Group(),seed);fitted.name='CORE / Blender equipment';
            const scale=Math.min(3.6/size.x,3.6/size.z,5.5/size.y);
            fitted.scale.setScalar(scale);fitted.position.set(at(cell[0])-center.x*scale,H+.35-bounds.min.y*scale,at(cell[1])-center.z*scale);
            fitted.add(gltf.scene);group.add(fitted);assetResources.forEach(own);return true;
          })().then(finish,()=>finish(false));
        });
      },
      decorateDoor(parent){
        return isolated(()=>{
        if(dead)return null;
        const decor=new THREE.Group();decor.name='CORE / security door';parent.add(decor);attachments.push(decor);
        const doorBatches=new Map();
        const put=(material,x,y,z,sx,sy,sz)=>{
          if(!doorBatches.has(material))doorBatches.set(material,{material:mats[material],geometry:box,zone:'door',items:[]});
          doorBatches.get(material).items.push([x,y,z,sx,sy,sz,0,0]);
        };
        for(const s of [-1,1]){
          put('dark',0,1.35,s*1.985,3.65,2.25,.02);put('edge',0,1.35,s*1.999,.09,2.22,.002);
          for(const x of [-1.5,1.5])put('warning',x,1.3,s*1.998,.12,1.95,.003);
          for(const x of [-.78,.78])put('panel',x,1.35,s*1.998,1.40,2.05,.002);
          put('warning',0,2.62,s*1.99,3.45,.11,.018);
          put('signal',0,H+.14,s*.9,1.55,.08,.11);
        }
        // Identical relief on the two other faces, so any corridor orientation works.
        const cross=new THREE.Group();cross.rotation.y=Math.PI/2;decor.add(cross);
        for(const b of doorBatches.values()){flush(decor,b);flush(cross,b);}
        return decor;
        },seed);
      },
      update(time,{firstPerson=false,wave=0,phase=0,warning=false}={}){
        if(dead)return false;
        lastState={firstPerson,wave,phase,warning};replacement?.update(time,lastState);
        ceiling.visible=firstPerson&&!replacement;
        mats.signal.color.setHex(level===4&&wave>0&&wave%5===0?0xff708e:level===3?[0x61eaff,0xff78de,0xffc86b][phase%3]:theme.accent);
        // Slow, subtle pulse; never a high-frequency strobe. Phase remains readable in low.
        if(!reducedMotion&&q.effects)mats.signal.color.multiplyScalar(warning?.78+.15*Math.sin(time*3):.95);
        if(effects.visible){
          const p=effects.children[0].geometry.attributes.position;
          for(let i=0;i<p.count;i++)p.setY(i,H+.55+((time*.20+i*.13)%1.15));p.needsUpdate=true;
        }
        if(turbine){
          rotors.forEach(([x,y,z],i)=>{for(let blade=0;blade<3;blade++){
            const angle=time*.25+blade*Math.PI*2/3;dummy.position.set(x+Math.cos(angle)*.40,y,z+Math.sin(angle)*.40);
            dummy.rotation.set(0,-angle,0);dummy.scale.set(.94,.055,.14);dummy.updateMatrix();turbine.setMatrixAt(i*3+blade,dummy.matrix);
          }});turbine.instanceMatrix.needsUpdate=true;
        }
        const cue=Math.floor(time/24),beep=detail>1&&!reducedMotion&&cue>0&&cue!==lastCue;lastCue=cue;return beep;
      },
      dispose(){
        if(dead)return;dead=true;
        replacement?.dispose();
        [...pending].forEach(cancel=>cancel());
        for(const root of[group,...attachments])root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
        group.parent?.remove(group);attachments.forEach(o=>o.parent?.remove(o));
        resources.forEach(r=>r.dispose());resources.clear();
      }
    };
    api.update(0);return api;
  }
  // Retire legacy scenery after procedural gameplay placement, preserving its RNG
  // sequence and any materials/geometries still used by existing dynamic doors.
  function retire(objects,liveRoot,preserve=[]){
    const retained=new Set(preserve),discarded=new Set();
    const collect=(root,set)=>root.traverse(o=>{
      if(o.geometry)set.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m){set.add(m);for(const v of Object.values(m))if(v?.isTexture)set.add(v);}
    });
    for(const o of objects){o.parent?.remove(o);collect(o,discarded);o.traverse(m=>{if(m.isInstancedMesh)m.dispose();});}
    collect(liveRoot,retained);
    for(const r of discarded)if(!retained.has(r))r.dispose();
  }
  return {build:options=>isolated(()=>build(options),options?.seed),retire,themes,qualities};
});
