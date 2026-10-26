const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./runtime.cjs');

test('Limbyrinth — logique réelle et géométrie Three.js', async t => {
  const game = runtime();
  const run = async code => game.run(code);
  await t.test('quatre niveaux de campagne et une arène de survie infinie', async () => {
    assert.equal(await run('LV.length'), 5);
    assert.equal(await run("LV[4].name"), 'Arène infinie');
  });
  await t.test('niveau 5 : arène ouverte, départ central et aucun cristal', async () => {
    const data = await run(`(() => {
      nP=1; net=null; start(4,123);
      return {wave, player:[fromW(players[0].g.position.x),fromW(players[0].g.position.z)],
        crystals:crystals.length, foes:foes.length, dyn:dyn.length, 
        border:grid[0].every(c=>c===1), open:grid[7][7]===0};
    })()`);
    assert.deepEqual(data,{wave:0,player:[7,7],crystals:0,foes:0,dyn:0,border:true,open:true});
  });
  await t.test('niveau 5 : vagues déclenchées, sans chrono terminal', async () => {
    const data = await run(`(() => {
      start(4,123); update(.05); 
      const first={wave,number:foes.length};
      missionElapsed=12.1; update(.05);
      const second={wave,number:foes.length};
      timeLeft=0; update(.05);
      return {first,second,state,timeLeft};
    })()`);
    assert.equal(data.first.wave,1);
    assert.ok(data.first.number>0);
    assert.equal(data.second.wave,2);
    assert.ok(data.second.number>=data.first.number);
    assert.equal(data.state,'play');
    assert.equal(data.timeLeft,0);
  });
  await t.test('niveau 5 : Titan et résistance croissante même avec limite de drones', async () => {
    const data=await run(`(() => {
      start(4,123); wave=4; missionElapsed=48.1;
      updateSurvival(.05);
      return {wave,titan:foes.some(f=>f.kind===3),
        hp1:swarmStats(0,1).hp,hp100:swarmStats(0,100).hp,
        titan5:swarmStats(3,5).hp,titan100:swarmStats(3,100).hp,
        limit:MAXF};
    })()`);
    assert.equal(data.wave,5);
    assert.equal(data.titan,true);
    assert.ok(data.hp100>data.hp1);
    assert.ok(data.titan100>data.titan5);
    assert.equal(data.limit,30);
  });
  await t.test('carte : dimensions et marqueurs uniques', async () => {
    assert.deepEqual(await run(`({rows:LEVEL4_MAP.length,lengths:LEVEL4_MAP.map(r=>r.length),markers:[...'SO123ABCE'].map(c=>LEVEL4_MAP.join('').split(c).length-1)})`),{rows:15,lengths:Array(15).fill(15),markers:Array(9).fill(1)});
  });
  await t.test('les modèles ont des silhouettes et animations distinctes', async () => {
    const data = await run(`ROBOT_SKINS.map(s => { const rig = creerRobot(0, 0, false, s.id); animerRobot(rig, 1, true, true); const size = new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3()); return { id: s.id, size: size.toArray().map(v => +v.toFixed(2)), shape: rig.shape }; })`);
    assert.equal(data.length, 4);
    assert.equal(new Set(data.map(v => v.shape)).size, 4);
    assert.equal(new Set(data.map(v => v.size.join(','))).size, 4);
  });
  await t.test('carte et BFS : seule la bonne aile est accessible, sortie après stabilisation', async () => {
    const data = await run(`(() => { start(3); return [0,1,2].map(phase => { level4.phase = phase; level4.latched = [false,false,false]; players.forEach(a => a.g.position.set(toW(1),0,toW(1))); syncLevel4Gates(); const reachable = (x,z) => !!bfs([1,1],[x,z]); const result = { gates: dyn.map(d=>d.closed), console: reachable(7,7), relays: [[11,3],[3,11],[11,11]].map(p=>reachable(...p)) }; level4.latched = [true,true,true]; syncLevel4Gates(); result.exit = reachable(13,13); return result; }); })()`);
    assert.deepEqual(data, [
      { gates: [false,true,true], console:true, relays:[true,false,false], exit:true },
      { gates: [true,false,true], console:true, relays:[false,true,false], exit:true },
      { gates: [true,true,false], console:true, relays:[false,false,true], exit:true }
    ]);
  });
  await t.test('100 changements : aucune fermeture sur joueur ou traqueur, grille cohérente', async () => {
    assert.equal(await run(`(() => { start(3); for(let i=0;i<100;i++){ const d=dyn[i%3], occupant=i%2?players[0]:foes[0]; level4.phase=i%3; syncLevel4Gates(); occupant.g.position.set(d.x+2.8,0,d.z); level4.phase=(i+1)%3; syncLevel4Gates(); if(d.closed || grid[d.j][d.i]) return false; occupant.g.position.set(toW(7),0,toW(7)); syncLevel4Gates(); for(const g of dyn) if(grid[g.j][g.i]!==+g.closed) return false; if(!d.closed) return false; } return true; })()`), true);
  });
  await t.test('une porte fermée reste solide lorsqu’un joueur s’en approche', async () => {
    const result=await run(`(() => { start(3);foes=[];players[0].g.position.set(toW(6),0,toW(11));keys.q=true;for(let i=0;i<20;i++)update(.05);keys.q=false;return {cell:fromW(players[0].g.position.x),closed:dyn[1].closed,wall:grid[11][5],phase:level4.phase}; })()`);
    assert.deepEqual(result,{cell:6,closed:true,wall:1,phase:0});
  });
  await t.test('console : portée, touche maintenue, avertissement et cooldown', async () => {
    assert.equal(await run(`(() => { start(3); if(requestLevel4Phase(0)) return false; players[0].g.position.set(toW(7),0,toW(7)); dispatchEvent(new KeyboardEvent('keydown',{key:'e'})); const seconds=level4.pendingSeconds; dispatchEvent(new KeyboardEvent('keydown',{key:'e',repeat:true})); if(seconds!==1.5 || level4.pendingSeconds!==seconds) return false; for(let i=0;i<31;i++) updateLevel4(.05); if(level4.phase!==1 || requestLevel4Phase(0)) return false; for(let i=0;i<160;i++) updateLevel4(.05); return requestLevel4Phase(0) && level4.pendingPhase===2; })()`), true);
  });
  await t.test('trois clés : portes verrouillées ouvertes et alarme unique à 35 s', async () => {
    const data=await run(`(() => { start(3); foes=[]; for(let i=0;i<3;i++){level4.phase=i;syncLevel4Gates();players[0].g.position.copy(crystals[i].mesh.position);update(.01);} const first=timeLeft; update(.05); level4.phase=0;syncLevel4Gates();return { collected, alarm:level4.alarm, first, later:timeLeft, closed:dyn.map(d=>d.closed) }; })()`);
    assert.equal(data.collected,3); assert.equal(data.alarm,true); assert.ok(data.first<=35); assert.ok(data.later<data.first); assert.deepEqual(data.closed,[false,false,false]);
  });
  await t.test('Traqueur : trois tirs étourdissent sans mort ni dégâts pendant 4 s', async () => {
    assert.equal(await run(`(() => { start(3); const f=foes[0]; for(let i=0;i<3;i++) hitFoe(f,f.g.position); if(foes.length!==1 || f.stun!==4 || kills!==0) return false; const before=f.g.position.clone(); players[0].g.position.copy(f.g.position); combat(.05); if(players[0].hp!==3 || f.g.position.distanceTo(before)>.001) return false; for(let i=0;i<81;i++) foeAI(f,.05); return f.stun<=0 && f.hp===3 && foes.length===1; })()`), true);
  });
  await t.test('snapshots : portes physiques et étourdissement synchronisés', async () => {
    assert.equal(await run(`(() => { start(3); let packet; dc={readyState:'open',send:s=>packet=JSON.parse(s)}; snap(); packet.d='101'; packet.l4.phase=1; packet.f[0][7]=2; applySnap(packet); dc=null; return dyn.every((d,i)=>grid[d.j][d.i]===+[true,false,true][i] && d.closed===[true,false,true][i] && (!d.closed || d.mesh.visible)) && foes[0].stun===2 && level4.phase===1; })()`), true);
  });
  await t.test('invité : seul l’hôte valide une demande près de la console', async () => {
    assert.equal(await run(`(() => { nP=2; net=null;start(3);net='guest';players[1].g.position.set(toW(7),0,toW(7));requestLevel4Phase(1);if(level4.pendingPhase!==null || !pend.phase)return false;net='host';players[1].g.position.set(toW(1),0,toW(1));onMsg({t:'i',dx:0,dz:0,phase:true});if(level4.pendingPhase!==null)return false;players[1].g.position.set(toW(7),0,toW(7));onMsg({t:'i',dx:0,dz:0,phase:true});const ok=level4.pendingPhase===1;net=null;nP=1;return ok; })()`), true);
  });
  await t.test('rebuilds et niveaux précédents : timers et drones conservés', async () => {
    assert.equal(await run(`(() => { nP=1;net=null; for(let i=0;i<3;i++){start(i);if(dyn.length<1 || foes.length!==[2,4,4][i])return false;const sw=swapT;update(.05);if(Math.abs(swapT-(sw-.05))>.001)return false;}start(3);level4.latched[0]=true;start(3);return collected===0 && level4.phase===0 && !level4.alarm && level4.latched.every(x=>!x) && dyn.length===3 && foes.length===1; })()`), true);
  });
  await t.test('skin équipé : persistance et repli si modèle inconnu', async () => {
    assert.equal(await run(`(() => { save.coins=10000;shopTab='robot';act(ROBOT_SKINS[1]);start(0);if(players[0].rig.shape!==ROBOT_SKINS[1].shape)return false;save.robot='unknown';start(0);return players[0].rig.shape==='classic'; })()`), true);
  });
  await t.test('anciens joueurs : niveau 4 accessible sans double prime finale', async () => {
    const old = runtime({cubeEscapeSave:JSON.stringify({finished:1,l3:1,done:["cl","l3"]})});
    assert.equal(old.run('maxLv'),4);
    const pay=old.run(`(() => { start(3); collected=3; timeLeft=10; const before=save.coins; end(true); return save.coins-before; })()`);
    assert.equal(pay,175);
    assert.equal(old.run('save.level4Finished'),1);
    assert.equal(runtime().run('maxLv'),1);
  });
  await t.test('parcours solo sans ennemi : trois clés et portail avec les collisions réelles', async () => {
    const result=await run(`(() => {
      nP=1;net=null;save.stock={};save.robot='rclassic';start(3,123);foes=[];
      const goals=[[11,3],[3,11],[11,11],[13,13]]; let target=0,waypoint=null,steps=0;
      for(;steps<4800 && state==='play';steps++){
        const p=players[0].g.position,goal=goals[target];
        if(target<3 && crystals[target].got){target++;waypoint=null;}
        if(waypoint && Math.max(Math.abs(p.x-toW(waypoint[0])),Math.abs(p.z-toW(waypoint[1])))<.24)waypoint=null;
        if(!waypoint)waypoint=bfs([fromW(p.x),fromW(p.z)],goals[target]);
        keys.d=keys.q=keys.z=keys.s=false;
        if(waypoint){const dx=toW(waypoint[0])-p.x,dz=toW(waypoint[1])-p.z;if(Math.abs(dx)>.24)keys[dx>0?'d':'q']=true;else if(Math.abs(dz)>.24)keys[dz>0?'s':'z']=true;}
        fireAuto();update(.05);t+=.05;
      }
      for(const k in keys)keys[k]=false;
      return {state,collected,hp:players[0].hp,timeLeft,steps,position:[fromW(players[0].g.position.x),fromW(players[0].g.position.z)]};
    })()`);
    assert.equal(result.state,'win',JSON.stringify(result));assert.equal(result.collected,3);assert.ok(result.timeLeft>0);
  });
  await t.test('coop réseau : le modèle de chaque joueur est préservé', async () => {
    assert.equal(await run(`(() => { net='host';nP=2;save.robot='rorb';onMsg({t:'cosmetic',robot:'rtrack'});start(3);const ok=players[0].rig.shape==='orb'&&players[1].rig.shape==='tracks';net=null;nP=1;return ok; })()`),true);
  });
  await t.test('aucun avertissement Three.js à la construction', () => assert.deepEqual(game.warnings, []));
});
