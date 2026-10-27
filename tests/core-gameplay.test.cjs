const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./runtime.cjs');
const fixture=path.join(__dirname,'fixtures/core-gameplay-before.json');
const fingerprint=`JSON.stringify({grid,dyn:dyn.map(d=>[d.i,d.j,d.closed]),
  crystals:crystals.map(c=>c.mesh.position.toArray()),
  foes:foes.map(f=>[f.g.position.toArray(),f.hp,f.kind,f.spd]),
  pads:pulsePads.map(p=>[p.x,p.z]),players:players.map(a=>a.g.position.toArray()),
  stations:survivalStations.map(s=>s.g?.position?.toArray()),timeLeft,swapT,wave})`;
function snapshots(game){
  const result={};
  for(const count of [1,2])for(const level of [0,1,2,3,4])for(const seed of [123,907,4251]){
    game.run(`nP=${count};net=null;start(${level},${seed})`);
    result[[count,level,seed].join('/')]=crypto.createHash('sha256').update(game.run(fingerprint)).digest('hex');
  }
  return result;
}
if(process.argv.includes('--record')){
  fs.mkdirSync(path.dirname(fixture),{recursive:true});fs.writeFileSync(fixture,JSON.stringify(snapshots(runtime()),null,2)+'\n');
}else{
  test('CORE scenery preserves original seeded gameplay across five levels, seeds and coop',()=>{
    assert.deepEqual(snapshots(runtime()),JSON.parse(fs.readFileSync(fixture)));
  });
  test('quality replacement preserves current doors, combat, objectives and collision/BFS',()=>{
    const g=runtime();g.run('start(3,123)');const before=g.run(fingerprint);
    for(const q of ['low','high','medium']){
      g.context.LimbyrinthGraphics={read:()=>q};g.run('refreshCoreScenery()');
      assert.equal(g.run(fingerprint),before);
      assert.equal(g.run('coreEnvironment.stats.quality'),q);
      assert.equal(g.run('coreEnvironment.ceiling.visible'),false);
    }
    assert.equal(g.run('!!bfs([1,1],[7,7])'),true);
  });
}
module.exports={fingerprint};
