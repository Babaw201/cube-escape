import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as Three from 'three';

const html=fs.readFileSync(new URL('../cube-escape/github/index.html',import.meta.url),'utf8');
function element() {
  const nested=new Map();const e={style:{},dataset:{},children:[],classList:{toggle(){}},textContent:'',value:'',disabled:false,
    clientWidth:1000,clientHeight:700,setAttribute(){},removeAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};},
    appendChild(x){this.children.push(x);},prepend(){},addEventListener(){},focus(){},
    querySelector(s){if(!nested.has(s))nested.set(s,element());return nested.get(s);},
    querySelectorAll(){return [element(),element(),element()];},cloneNode(){return element();}};
  Object.defineProperty(e,'innerHTML',{set(){e.children.length=0;},get(){return '';}});return e;
}
function load() {
  const dom=new Map(),events=new Map(),saved=new Map();
  const $=id=>{if(!dom.has(id))dom.set(id,element());return dom.get(id);};
  class Renderer {constructor(){this.domElement=element();}setPixelRatio(){}setSize(){}render(){}}
  const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer},document:{getElementById:$,createElement:element,body:element(),hidden:false,addEventListener(){}},
    innerWidth:1000,innerHeight:700,devicePixelRatio:1,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){return 1;},clearTimeout(){},
    addEventListener:(name,fn)=>events.set(name,fn),localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,String(v))},console});
  const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  // Instrument only the test copy; no testing API is included in the delivered game.
  vm.runInContext(source.replace('loop();\n})();','globalThis.gameTest = code => eval(code);\n})();'),context);
  return {run:context.gameTest,dom,events,saved,context};
}
function openArena(g) {
  g.run(`start(0,123);grid=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));dyn=[];foes=[];lasers=[];players[0].g.position.set(toW(3),0,toW(3));`);
}
test('first-person view follows the robot, rotates movement and keeps follow view available',()=>{
  const g=load();openArena(g);
  g.run('players[0].robot.rotation.y=Math.PI/2;setCameraMode(true);animate(.016);');
  assert.equal(g.run('firstPerson'),true);
  assert.equal(g.run('camera.position.x'),g.run('players[0].g.position.x'));
  assert.equal(g.run('camera.position.z'),g.run('players[0].g.position.z'));
  assert.equal(g.run('players[0].robot.visible'),false);
  const x=g.run('players[0].g.position.x');
  g.run('keys.z=true;update(.1);');
  assert.ok(g.run('players[0].g.position.x')>x+.5);
  g.run('setCameraMode(false);animate(.016);');
  assert.equal(g.run('firstPerson'),false);
  assert.equal(g.run('players[0].robot.visible'),true);
});
test('first-person shooting follows view direction and local duo stays in follow view',()=>{
  const g=load();openArena(g);
  g.run('setCameraMode(true);viewYaw=Math.PI/2;mouse.x=0;mouse.y=0;fire(players[0],...aim(players[0]));');
  assert.ok(g.run('shots[0].vx')>20);
  assert.ok(Math.abs(g.run('shots[0].vz'))<1e-8);
  g.run('nP=2;start(0,123);setCameraMode(true);');
  assert.equal(g.run('firstPerson'),false);
});
test('online guest moves in the direction of its first-person view without losing its aim to snapshots',()=>{
  const host=load(),guest=load();
  host.context.channel={readyState:'open',send:data=>guest.context.channel.onmessage({data})};
  guest.context.channel={readyState:'open',send:data=>host.context.channel.onmessage({data})};
  host.run('setupDC(globalThis.channel,true);');guest.run('setupDC(globalThis.channel,false);');
  host.context.channel.onopen();guest.context.channel.onopen();host.run('start(0,1234);');
  guest.run('setCameraMode(true);viewYaw=Math.PI/2;keys.z=true;const [dx,dz]=inputDirection(1);send({t:"i",dx,dz,yaw:viewYaw});');
  assert.ok(host.run('rin.dx')>.99);
  assert.ok(Math.abs(host.run('rin.dz'))<1e-8);
  assert.ok(Math.abs(host.run('players[1].robot.rotation.y')-Math.PI/2)<1e-8);
  host.run('snap();');
  assert.ok(Math.abs(guest.run('players[1].robot.rotation.y')-Math.PI/2)<1e-8);
});
test('published solo, local co-op, level progression and storage keys remain available',()=>{
  const g=load();g.run('nP=2;start(0,123);');
  assert.equal(g.run('players.length'),2);assert.equal(g.run('players.every(a=>a.hp===3&&a.alive)'),true);
  assert.equal(g.run('LV[0].foes'),2);assert.equal(g.run('LV[1].foes'),4);
  assert.equal(g.run('typeof hostGame'), 'function');assert.equal(g.run('typeof joinGame'),'function');
  g.run('collected=3;timeLeft=20;end(true);');assert.equal(g.saved.get('cubeEscapeUnlocked'),'2');
  assert.equal(g.saved.get('cubeEscapeBest'),'500');
  g.run('start(1,456)');assert.equal(g.run('cur'),1);assert.equal(g.run('players.length'),2);
});

test('mission dashboard follows collection, damage, dash, combat score and restart',()=>{
  const g=load();g.run('start(0,123);players[0].g.position.copy(crystals[0].mesh.position);update(.01);players[0].hp=2;players[0].dashCd=2.5;hitFoe(foes[0],foes[0].g.position);hitFoe(foes[0],foes[0].g.position);hitFoe(foes[0],foes[0].g.position);hud();');
  assert.equal(Number(g.dom.get('score').textContent),250);
  assert.match(g.dom.get('crystal-0').querySelector('.state').textContent,/Récupéré/);
  assert.match(g.dom.get('enemy-status').textContent,/1.*Traqueur/);
  assert.match(g.dom.get('enemy-kills').textContent,/1/);
  assert.match(g.dom.get('bars').querySelector('.health-label').textContent,/2\s*\/\s*3/);
  assert.equal(g.dom.get('bars').querySelector('.dash-fill').style.width,'50%');
  g.run('end(true);');assert.ok(Number(g.saved.get('cubeEscapeBest'))>250);
  g.run('start(0,123);');assert.equal(Number(g.dom.get('score').textContent),0);
  assert.match(g.dom.get('crystal-0').querySelector('.state').textContent,/récupérer/);
  assert.match(g.dom.get('enemy-kills').textContent,/0/);
});

test('online snapshots carry drone health, alert state and combat score to the dashboard',()=>{
  const host=load(),guest=load();
  host.context.channel={readyState:'open',send:data=>guest.context.channel.onmessage({data})};
  guest.context.channel={readyState:'open',send:data=>host.context.channel.onmessage({data})};
  host.run('setupDC(globalThis.channel,true);');guest.run('setupDC(globalThis.channel,false);');
  host.context.channel.onopen();guest.context.channel.onopen();host.run('start(0,1234);');
  host.run('hitFoe(foes[0],foes[0].g.position);foes[0].mode="chase";snap();');guest.run('guestStep(0,true);');
  assert.equal(guest.run('foes[0].hp'),2);assert.equal(guest.run('foes[0].mode'),'chase');
  assert.match(guest.dom.get('enemy-status').textContent,/ALERTE/);
  host.run('hitFoe(foes[0],foes[0].g.position);hitFoe(foes[0],foes[0].g.position);snap();');guest.run('guestStep(0,true);');
  assert.equal(Number(guest.dom.get('score').textContent),150);
});

test('mouse aim uses the canvas rectangle after the dashboard shifts the viewport',()=>{
  const g=load();g.run('start(0,123);camera.position.set(0,20,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();');
  const first=JSON.parse(g.run('mouse.x=500;mouse.y=350;JSON.stringify(aim(players[0]));'));
  g.run('renderer.domElement.getBoundingClientRect=()=>({left:120,top:80,width:1000,height:700});mouse.x=620;mouse.y=430;');
  const shifted=JSON.parse(g.run('JSON.stringify(aim(players[0]))'));
  assert.ok(Math.abs(first[0]-shifted[0])<1e-8&&Math.abs(first[1]-shifted[1])<1e-8,'same point in canvas must preserve aim');
});
test('every level-2 map supplies three lasers and keeps a path to all crystals and the portal',()=>{
  const g=load();g.run('maxLv=2;');
  for(let seed=1;seed<=80;seed++){
    g.run(`start(1,${seed});`);assert.equal(g.run('lasers.length'),3,`seed ${seed}`);
    for(let swap=0;swap<3;swap++){
      g.run('swapWalls();');
      assert.equal(g.run('crystals.every(c=>bfs([1,1],[fromW(c.mesh.position.x),fromW(c.mesh.position.z)]))&&!!bfs([1,1],[13,13])'),true);
    }
  }
});
test('shots use their entire path: a wall shields a drone and three unobstructed hits destroy it',()=>{
  const g=load();openArena(g);
  g.run(`const f=(()=>{const g=new THREE.Group();g.position.set(toW(5),1,toW(3));world.add(g);return {g,hp:3,mat:new THREE.MeshStandardMaterial(),flash:0};})();foes=[f];foeAI=()=>{};grid[3][4]=1;fire(players[0],1,0);combat(.5);`);
  assert.equal(g.run('foes[0].hp'),3);assert.equal(g.run('shots.length'),0);
  g.run('grid[3][4]=0;');
  for(let i=0;i<3;i++)g.run('players[0].fireCd=0;fire(players[0],1,0);combat(.5);');
  assert.equal(g.run('foes.length'),0);
});
test('only the host can select levels or accept remote control in online co-op',()=>{
  const g=load();g.run('maxLv=2;net="guest";renderLv();');
  assert.equal(g.dom.get('lv').children.filter(b=>b.textContent.startsWith('Niveau')).every(b=>b.disabled),true);
  g.run('net="host";state="menu";cur=0;onMsg({t:"start",lv:1,seed:12});');
  assert.equal(g.run('state'),'menu');assert.equal(g.run('cur'),0);
  g.run('net="guest";onMsg({t:"start",lv:1,seed:12});');assert.equal(g.run('state'),'play');
});
test('pause preserves both robots and mission time, and resumes without restarting',()=>{
  const g=load();g.run('nP=2;start(0,123);players[0].hp=2;');
  g.run('setPaused(true);');assert.equal(g.run('state'),'paused');
  const before=g.run('timeLeft');g.run('setPaused(false);');
  assert.equal(g.run('state'),'play');assert.equal(g.run('timeLeft'),before);assert.equal(g.run('players[0].hp'),2);
  g.run('net="guest";setPaused(true);');assert.equal(g.run('state'),'play');
  g.run('onMsg({t:"pause",paused:true});');assert.equal(g.run('state'),'paused');
  g.run('onMsg({t:"pause",paused:false});');assert.equal(g.run('state'),'play');
});
test('trackers navigate a corner without crossing walls and return to patrol after losing sight',()=>{
  const g=load();openArena(g);
  g.run(`grid=Array.from({length:N},()=>Array(N).fill(1));for(const [x,z] of [[1,1],[2,1],[3,1],[3,2],[3,3],[13,13]])grid[z][x]=0;
    players[0].g.position.set(toW(13),0,toW(13));
    foes=[{g:new THREE.Group(),ring:new THREE.Group(),mat:new THREE.MeshStandardMaterial(),hp:3,ph:0,flash:0,pts:[[1,1],[3,3]],pi:1,mode:'patrol',lost:0}];foes[0].g.position.set(toW(1),1,toW(1));`);
  for(let i=0;i<450;i++){
    g.run('foeAI(foes[0],.02)');assert.equal(g.run('hit(foes[0].g.position.x,foes[0].g.position.z,.4)'),false);
  }
  assert.equal(g.run('foes[0].pi'),0,'Drone must reach the patrol point after the corner');
  g.run('players[0].g.position.copy(foes[0].g.position);foeAI(foes[0],.01);');assert.equal(g.run('foes[0].mode'),'chase');
  g.run('players[0].g.position.set(toW(13),0,toW(13));');
  for(let i=0;i<120;i++)g.run('foeAI(foes[0],.02);');
  assert.equal(g.run('foes[0].mode'),'patrol');
});
test('two simulated peers keep their maze, pause, remote inputs and final score synchronized',()=>{
  const host=load(),guest=load();
  host.context.channel={readyState:'open',send:data=>guest.context.channel.onmessage({data})};
  guest.context.channel={readyState:'open',send:data=>host.context.channel.onmessage({data})};
  host.run('setupDC(globalThis.channel,true);');guest.run('setupDC(globalThis.channel,false);');
  host.context.channel.onopen();guest.context.channel.onopen();host.run('start(0,1234);');
  assert.equal(host.run('JSON.stringify(grid)'),guest.run('JSON.stringify(grid)'));
  assert.equal(guest.run('players.length'),2);
  host.run('swapWalls();snap();');
  assert.equal(host.run('JSON.stringify(grid)'),guest.run('JSON.stringify(grid)'));
  host.run('setPaused(true);');assert.equal(guest.run('state'),'paused');
  host.run('setPaused(false);');assert.equal(guest.run('state'),'play');
  guest.run('send({t:"i",dx:1,dz:0,d:true});');
  assert.equal(host.run('rin.dx'),1);assert.equal(host.run('players[1].dashCd'),5);
  host.run('collected=3;timeLeft=17;players[0].hp=0;players[0].alive=false;players[1].g.position.set(portal.x,0,portal.z);end(true);');
  assert.equal(guest.run('collected'),3);assert.equal(guest.run('timeLeft'),17);assert.equal(guest.run('state'),'win');
  assert.equal(guest.saved.get('cubeEscapeBest'),host.saved.get('cubeEscapeBest'));
  assert.equal(Number(guest.dom.get('n').textContent),3);assert.equal(Number(guest.dom.get('tm').textContent),17);
  assert.equal(guest.run('players[0].robot.visible'),false);
  assert.equal(guest.run('players[1].g.position.x'),host.run('players[1].g.position.x'));
  assert.equal(guest.run('players[1].g.position.z'),host.run('players[1].g.position.z'));
});
test('dash keeps its duration and recharge while substeps stop both robots at walls',()=>{
  const smooth=load(),slow=load();openArena(smooth);openArena(slow);
  for(const g of [smooth,slow])g.run('keys.d=true;players[0].dashT=.18;players[0].dashCd=5;');
  for(let i=0;i<10;i++)smooth.run('update(.02);');slow.run('update(.2);');
  assert.ok(Math.abs(smooth.run('players[0].g.position.x')-slow.run('players[0].g.position.x'))<1e-7);
  assert.ok(Math.abs(slow.run('players[0].dashCd')-4.8)<1e-7);
  const blocked=load();openArena(blocked);
  blocked.run('grid[3][4]=1;keys.d=true;players[0].dashT=.18;update(.2);');
  assert.equal(blocked.run('hit(players[0].g.position.x,players[0].g.position.z)'),false);
  assert.ok(blocked.run('players[0].g.position.x')<blocked.run('toW(4)-T/2'));
});
test('Space leaves native activation available on focused menu buttons',()=>{
  const g=load();let prevented=0;
  g.events.get('keydown')({key:' ',target:{tagName:'BUTTON'},preventDefault(){prevented++;}});
  assert.equal(prevented,0);assert.equal(g.run('state'),'menu');
  g.events.get('keydown')({key:' ',target:{tagName:'BODY'},preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.equal(g.run('state'),'play');
});

test('J2 can fire with Enter after a toolbar button receives focus without activating that button',()=>{
  const g=load();g.run('nP=2;start(0,123);');let prevented=0;
  g.events.get('keydown')({key:'Enter',target:{tagName:'BUTTON'},preventDefault(){prevented++;}});
  assert.equal(g.run('shots.length'),1);assert.equal(g.run('players[1].fireCd'),.35);
  assert.equal(g.run('players[0].fireCd'),0);assert.equal(prevented,1);
  g.run('setPaused(true);');
  g.events.get('keydown')({key:'Enter',target:{tagName:'BUTTON'},preventDefault(){prevented++;}});
  assert.equal(prevented,1,'menu buttons retain native keyboard activation while paused');
});

test('destroying a drone and rebuilding the level releases owned graphics resources',()=>{
  const g=load();
  g.run(`start(0,123);globalThis.releasedPanels=0;globalThis.releasedDroneMaterials=0;
    world.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>globalThis.releasedPanels++);});
    const materials=new Set();foes[0].g.traverse(o=>{if(o.material)materials.add(o.material);});
    globalThis.ownedDroneMaterials=materials.size;
    materials.forEach(m=>m.addEventListener('dispose',()=>globalThis.releasedDroneMaterials++));
    hitFoe(foes[0],foes[0].g.position);hitFoe(foes[0],foes[0].g.position);hitFoe(foes[0],foes[0].g.position);`);
  assert.equal(g.context.releasedDroneMaterials,g.context.ownedDroneMaterials);
  g.run('start(0,456);');assert.equal(g.context.releasedPanels,3);
});
test('both published levels remain winnable through movement, shooting and waiting for lasers',()=>{
  for(const level of [0,1]){
    const g=load();
    const result=JSON.parse(g.run(`(()=>{
      maxLv=2;start(${level},1234);let frames=0,waypoint=null;
      while(state==='play'&&frames<5400){
        const a=players[0],p=a.g.position,target=crystals.find(c=>!c.got)?.mesh.position||{x:portal.x,z:portal.z};
        const visible=foes.filter(f=>los(p,f.g.position)).sort((a,b)=>p.distanceTo(a.g.position)-p.distanceTo(b.g.position));
        if(visible[0])fire(a,visible[0].g.position.x-p.x,visible[0].g.position.z-p.z);
        if(!waypoint||Math.hypot(waypoint.x-p.x,waypoint.z-p.z)<1e-6){
          const cell=[fromW(p.x),fromW(p.z)],goal=[fromW(target.x),fromW(target.z)];
          const next=bfs(cell,goal);if(!next)throw Error('No route');waypoint={x:toW(next[0]),z:toW(next[1])};
        }
        if(hit(waypoint.x,waypoint.z)){waypoint=null;continue;}
        const dx=waypoint.x-p.x,dz=waypoint.z-p.z,distance=Math.hypot(dx,dz);
        const laser=lasers.find(l=>Math.abs(l.x-waypoint.x)<.1&&Math.abs(l.z-waypoint.z)<.1);
        const wait=laser&&(laserOn||laserT<.7);
        keys.d=!wait&&dx>1e-7;keys.q=!wait&&dx< -1e-7;keys.s=!wait&&dz>1e-7;keys.z=!wait&&dz< -1e-7;
        update(wait?1/60:Math.min(1/60,distance/SPEED));frames++;
        if(hit(p.x,p.z)||foes.some(f=>hit(f.g.position.x,f.g.position.z,.4)))throw Error('Wall overlap');
      }
      return JSON.stringify({state,hp:players[0].hp,collected,timeLeft,frames});
    })()`));
    assert.equal(result.state,'win',`level ${level+1}: ${JSON.stringify(result)}`);
    assert.equal(result.collected,3);assert.ok(result.hp>0);
    console.log(`Published level ${level+1}: victory, ${result.hp} HP, ${result.timeLeft.toFixed(1)} seconds left`);
  }
});
