const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {gameResponse}=require('./serve-game.cjs');

test('GLB : rendu WebGL bureau/mobile, kits, cache et repli réseau',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  t.after(()=>browser.close());
  for(const mobile of [false,true])await t.test(mobile?'mobile 844×390':'bureau 1440×900',async()=>{
    const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.host!=='game.test')return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({top:[],totalPlayers:0})});
      if(url.pathname.endsWith('.glb'))requests.push(url.pathname);
      return route.fulfill(gameResponse(url.pathname));
    });
    await page.goto('https://game.test/cube-escape/');
    await page.waitForFunction(()=>!!window.gameEval);
    const run=code=>page.evaluate(code=>window.gameEval(code),code);
    const result=await run(`(async()=>{
      window.LimbyrinthFriends={hasProfile:()=>true,requireProfile:cb=>{cb();return true;}};
      save.robot='rspectre';nP=2;net='host';remoteRobotId='rsovereign';start(4,123);
      const roots=players.map(p=>p.robot);await Promise.all(players.map(p=>p.rig.modelReady));
      const kits=players.map((p,i)=>{animerRobot(p.rig,1,true,true);shots=[];fire(p,0,1);const count=shots.length;useUltimate(p);
        return {source:p.rig.modelSource,same:p.robot===roots[i],count,cooldown:p.ultCd};});
      renderer.render(scene,camera);
      showRobotPreview('rspectre');await preview.rig.modelReady;showRobotPreview('rsovereign');await preview.rig.modelReady;
      preview.renderer.render(preview.scene,preview.camera);
      return {kits,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,preview:preview.rig.modelSource};
    })()`);
    assert.deepEqual(result.kits.map(k=>[k.source,k.same,k.count,k.cooldown]),[['glb',true,1,26],['glb',true,2,32]]);
    assert.ok(result.calls>0&&result.triangles>0);assert.equal(result.preview,'glb');
    assert.equal(requests.filter(p=>p.endsWith('/spectre.glb')).length,1);assert.equal(requests.filter(p=>p.endsWith('/souverain.glb')).length,1);
    assert.deepEqual(errors,[]);
    await page.close();
  });
  await t.test('GLB inaccessible : partie et aperçu continuent',async()=>{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.route('https://game.test/**',route=>route.request().url().endsWith('.glb')?route.abort('failed'):route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
    await page.route('https://limbyrinth-online.baptiste-werner.workers.dev/**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"top":[],"totalPlayers":0}'}));
    await page.goto('https://game.test/');
    const result=await page.evaluate(()=>window.gameEval(`(async()=>{showRobotPreview('rspectre');const ok=await preview.rig.modelReady;animerRobot(preview.rig,2,true,false);preview.renderer.render(preview.scene,preview.camera);return {ok,source:preview.rig.modelSource,calls:preview.renderer.info.render.calls};})()`));
    assert.equal(result.ok,false);assert.equal(result.source,'procedural');assert.ok(result.calls>0);assert.deepEqual(errors,[]);
    await page.close();
  });
});
