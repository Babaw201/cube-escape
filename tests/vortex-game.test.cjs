const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runtime}=require('./runtime.cjs');
const arena=`save.robot='rvortex';nP=1;net=null;start(4,123);lasers=[];
  grid=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
  foes.forEach(f=>world.remove(f.g));foes=[];players[0].g.position.set(0,0,0);`;

test('VORTEX : septième robot, IMPLOSION sphérique, cadence, dégâts et ralentissement réel',()=>{
  const g=runtime();
  const data=g.run(`(()=>{${arena}
    const a=players[0],f=makeSwarmFoe(700,2,0,0,1);fire(a,1,0);
    const shot={count:shots.length,gravity:shots[0].gravity,type:shots[0].m.geometry.type,color:shots[0].col,cadence:a.fireCd};
    combat(.05);const hit={hp:f.hp,slow:f.slow,pulses:gravityPulses.length};
    const b=makeSwarmFoe(701,4,3,0,1);b.slow=1.2;const before=b.g.position.clone();foeAI(b,.1);const slowed=b.g.position.distanceTo(before);
    b.g.position.copy(before);b.slow=0;foeAI(b,.1);const normal=b.g.position.distanceTo(before);
    return {robots:ROBOT_SKINS.length,id:a.rig.skinId,shape:a.rig.shape,shot,hit,slowed,normal};})()`);
  assert.equal(data.robots,7);assert.equal(data.id,'rvortex');assert.equal(data.shape,'vortex');
  assert.equal(data.shot.count,1);assert.equal(data.shot.gravity,true);assert.equal(data.shot.type,'IcosahedronGeometry');
  assert.equal(data.shot.color,0xb865ff);assert.equal(data.shot.cadence,.5);
  assert.equal(data.hit.hp,2);assert.ok(data.hit.slow>1);assert.ok(data.hit.pulses>0);
  assert.ok(data.slowed<data.normal*.65);
});

test('VORTEX : singularité 3 s, six dégâts périodiques, recharge 28 s, aucune invincibilité',()=>{
  const g=runtime();
  const data=g.run(`(()=>{${arena}
    const a=players[0],f=makeSwarmFoe(710,4,0,0,1);f.hp=20;
    const active=useUltimate(a),s=singularities[0],center={x:s.x,z:s.z};
    const before=Math.hypot(f.g.position.x-s.x,f.g.position.z-s.z);
    updateGravity(.25);const after=Math.hypot(f.g.position.x-s.x,f.g.position.z-s.z);
    for(let i=0;i<55;i++)updateGravity(.05);
    const remaining=singularities.length;
    return {active,before,after,hp:f.hp,remaining,life:s.life,cooldown:a.ultCd,rejected:useUltimate(a),inv:a.inv,shield:a.shield||0,deploy:a.rig.ultimate,pulses:gravityPulses.length,center};})()`);
  assert.equal(data.active,true);assert.ok(data.after<data.before);assert.equal(data.hp,14);
  assert.equal(data.remaining,0);assert.ok(data.life<=.000001);assert.equal(data.cooldown,28);
  assert.equal(data.rejected,false);assert.equal(data.inv,0);assert.equal(data.shield,0);assert.equal(data.deploy,0);assert.ok(data.pulses>0);
});

test('VORTEX : un obstacle bloque dégâts et attraction; fermeture de porte et Titan',()=>{
  const g=runtime();
  const d=g.run(`(()=>{${arena}
    const a=players[0];useUltimate(a);const s=singularities[0];s.x=0;s.z=0;s.visual.position.set(0,0,0);
    const normal=makeSwarmFoe(720,4,0,0,1),titan=makeSwarmFoe(721,4,0,3,5);normal.hp=titan.hp=50;
    updateGravity(.1);const normalPull=4-normal.g.position.x,titanPull=4-titan.g.position.x;
    s.x=1.5;normal.g.position.set(6.8,1.2,0);titan.g.position.set(6.8,1.2,0);
    grid[fromW(0)][fromW(3)]=1;updateGravity(.5);
    return {normalPull,titanPull,x:normal.g.position.x,titanX:titan.g.position.x,hp:normal.hp,titanHp:titan.hp,collision:hit(normal.g.position.x,normal.g.position.z,.4)};})()`);
  assert.ok(d.normalPull>d.titanPull&&d.titanPull>0);assert.equal(d.x,6.8);assert.equal(d.titanX,6.8);
  assert.equal(d.hp,50);assert.equal(d.titanHp,50);assert.equal(d.collision,false);
});

test('VORTEX : récompense dès la vague 20 du niveau 5, sauvegarde et équipement',()=>{
  const g=runtime();
  const d=g.run(`(()=>{start(4,321);wave=19;missionElapsed=19*WAVE_S+.01;updateSurvival(.05);
    const awarded=save.own.includes('rvortex');shopTab='robot';act(ROBOT_SKINS.find(r=>r.id==='rvortex'));
    return {wave,awarded,robot:save.robot,spectre:save.own.includes('rspectre'),sovereign:save.own.includes('rsovereign')};})()`);
  assert.equal(d.wave,20);assert.equal(d.awarded,true);assert.equal(d.robot,'rvortex');assert.equal(d.spectre,false);assert.equal(d.sovereign,false);
  const reload=runtime(Object.fromEntries(g.storage));assert.equal(reload.run('save.robot'),'rvortex');assert.equal(reload.run("save.own.includes('rvortex')"),true);
  const historical=runtime({limbyrinthScoresV1:JSON.stringify([{level:5,wave:20,score:100}])});assert.equal(historical.run("save.own.includes('rvortex')"),true);
  const invalid=runtime({limbyrinthScoresV1:JSON.stringify([{level:4,wave:100},{level:5,wave:19.9},{level:5,score:999999},{level:5,wave:'Infinity'}])});assert.equal(invalid.run("save.own.includes('rvortex')"),false);
  const locked=runtime();assert.equal(locked.run("(()=>{shopTab='robot';act(ROBOT_SKINS.find(r=>r.id==='rvortex'));return save.robot;})()"),'rclassic');
});

test('VORTEX : réseau, hôte autoritaire, entrées clavier/tactile et réinitialisation',()=>{
  const host=runtime();
  const packet=host.run(`(()=>{save.robot='rvortex';net='host';nP=2;remoteRobotId='rvortex';start(4,123);
    players[1].g.position.set(0,0,0);onMsg({t:'i',dx:0,dz:0,u:true,f:[1,0]});onMsg({t:'i',dx:0,dz:0,u:true});
    let packet;dc={readyState:'open',send:text=>packet=JSON.parse(text)};snap();return packet;})()`);
  assert.equal(packet.p[1][9],28);assert.equal(packet.gv.length,1);assert.equal(packet.sh[0][4],1);
  const guest=runtime();guest.run("save.robot='rvortex';net='guest';nP=2;remoteRobotId='rvortex';start(4,123)");
  guest.run(`applySnap(${JSON.stringify(packet)})`);
  let d=guest.run(`(()=>{const count=singularities.length;const active=useUltimate(players[1]);guestStep(.05);return {id:players[1].rig.skinId,count,after:singularities.length,active,pending:pend.u,deploy:players[1].rig.ultimate,gravity:shots[0].gravity};})()`);
  assert.equal(d.id,'rvortex');assert.equal(d.count,1);assert.equal(d.after,1);assert.equal(d.active,false);assert.equal(d.pending,true);assert.ok(d.deploy>0);assert.equal(d.gravity,true);
  guest.run(`applySnap(${JSON.stringify(packet)})`);assert.equal(guest.run('singularities.length'),1);
  assert.equal(host.run("(()=>{paused=true;players[1].ultCd=0;onMsg({t:'i',u:true});return singularities.length;})()"),1);
  host.run("paused=false;players[1].alive=false;onMsg({t:'i',u:true})");assert.equal(host.run('singularities.length'),1);
  guest.run("net=null;nP=1;start(0,456)");assert.equal(guest.run('singularities.length+gravityPulses.length'),0);
  const local=runtime();const controls=local.run(`(()=>{save.robot='rvortex';nP=2;start(0,123);
    dispatchEvent(new KeyboardEvent('keydown',{key:'u'}));dispatchEvent(new KeyboardEvent('keydown',{key:'i'}));
    return players.map(p=>p.ultCd);})()`);assert.deepEqual(controls,[28,28]);
});

test('VORTEX : projectile bloqué par un mur, lenteur temporaire et portée limitée',()=>{
  const g=runtime();
  const d=g.run(`(()=>{${arena}
    grid[fromW(0)][fromW(4)]=1;const f=makeSwarmFoe(730,7,0,0,1);fire(players[0],1,0);
    for(let i=0;i<4;i++)combat(.05);const stopped=shots.length===0;
    const hp=f.hp;f.slow=1.2;foeAI(f,1.3);const recovered=f.slow===0;
    grid[fromW(0)][fromW(4)]=0;f.g.position.set(10,1.2,0);useUltimate(players[0]);
    const x=f.g.position.x;updateGravity(.5);return {stopped,hp,recovered,outside:f.g.position.x===x&&f.hp===hp};})()`);
  assert.equal(d.stopped,true);assert.equal(d.hp,3);assert.equal(d.recovered,true);assert.equal(d.outside,true);
});

test('VORTEX : un snapshot retardé ne ressuscite pas une singularité déjà refermée chez l’invité',()=>{
  const g=runtime();
  const d=g.run(`(()=>{save.robot='rvortex';net='guest';nP=2;start(4,123);
    syncGravity([[42,0,0,0,.04]]);guestStep(.05);
    const first=gravityPulses.length;syncGravity([[42,0,0,0,.01]]);guestStep(.05);
    const second=gravityPulses.length,active=singularities.length;
    syncGravity([]);const after=gravityPulses.length;
    net=null;nP=1;start(4,123);net='guest';syncGravity([[42,0,0,0,2]]);
    return {first,second,active,after,restarted:singularities.length};})()`);
  assert.equal(d.first,1);assert.equal(d.second,1);assert.equal(d.active,0);assert.equal(d.after,1);assert.equal(d.restarted,1);
});

test('VORTEX : utilisable dans les cinq niveaux et ressources conservées après destruction d’un autre rig',()=>{
  const g=runtime();
  const d=g.run(`(()=>{save.robot='rvortex';const levels=[];
    for(let level=0;level<5;level++){start(level,123);fire(players[0],1,0);levels.push({id:players[0].rig.skinId,fired:shots.length>0,ulti:useUltimate(players[0])});}
    const a=creerRobot(0,0,false,'rvortex'),b=creerRobot(0,0,true,'rvortex');let disposed=0;
    b.arms[0].children[0].geometry.addEventListener('dispose',()=>disposed++);disposeTree(a.group);animerRobot(b,2,true,true);
    return {levels,disposed,finite:b.arms.every(arm=>arm.position.toArray().every(Number.isFinite))};})()`);
  assert.ok(d.levels.every(l=>l.id==='rvortex'&&l.fired&&l.ulti));assert.equal(d.disposed,0);assert.equal(d.finite,true);
});
