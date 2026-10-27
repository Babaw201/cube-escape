const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {gameResponse}=require('./serve-game.cjs');

test('VORTEX — boutique, WebGL, clavier et tactile',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  t.after(()=>browser.close());
  for(const mobile of [false,true])await t.test(mobile?'mobile tactile':'bureau clavier',async()=>{
    const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      return url.host==='game.test'?route.fulfill(gameResponse(url.pathname)):route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"top":[],"totalPlayers":0}'});
    });
    await page.goto('https://game.test/cube-escape/');
    await page.waitForFunction(()=>!!window.gameEval);
    const run=code=>page.evaluate(code=>window.gameEval(code),code);
    await run("window.LimbyrinthFriends={hasProfile:()=>true,requireProfile:cb=>{cb();return true;}};openShop()");
    const card=page.locator('#sh-list .card').filter({has:page.locator('b',{hasText:/^VORTEX$/})});
    assert.equal(await page.locator('#sh-list .card').count(),7);
    assert.equal(await card.getByRole('button',{name:'🔒 Atteindre la vague 20',exact:true}).isDisabled(),true);
    await card.getByRole('button',{name:'Voir en 3D',exact:true}).click();
    assert.match(await page.locator('#preview-desc').innerText(),/IMPLOSION.*SINGULARITÉ/);
    const preview=await run("(()=>{animerRobot(preview.rig,2,true,true);preview.renderer.render(preview.scene,preview.camera);return {id:preview.id,arms:preview.rig.arms.length,calls:preview.renderer.info.render.calls,triangles:preview.renderer.info.render.triangles};})()");
    assert.equal(preview.id,'rvortex');assert.equal(preview.arms,3);assert.ok(preview.calls<=40&&preview.calls>0);assert.ok(preview.triangles<7000);
    await run("start(4,123);missionElapsed=19*WAVE_S+.01;updateSurvival(.05);endSurvival();openShop()");
    await card.getByRole('button',{name:'Équiper',exact:true}).click();
    assert.equal(await run('save.robot'),'rvortex');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cubeEscapeSave')).robot),'rvortex');
    await run("$('shop').style.display='none';nP=1;net=null;start(4,123);foes.forEach(f=>world.remove(f.g));foes=[];players[0].g.position.set(0,0,0);makeSwarmFoe(999,3,0,0,1);players[0].robot.rotation.y=0;document.activeElement?.blur()");
    if(mobile){await page.locator('#tfire').tap();await page.locator('#tulti').tap();}
    else{await run('fire(players[0],1,0)');await page.keyboard.press('u');}
    const active=await run("(()=>{combat(.05);animerRobot(players[0].rig,2,true,false);animate(.05);renderer.render(scene,camera);return {count:singularities.length,cooldown:players[0].ultCd,deploy:players[0].rig.ultimate,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lights:players[0].g.children.filter(o=>o.isLight).length};})()");
    assert.equal(active.count,1);assert.ok(active.cooldown>27);assert.ok(active.deploy>0);assert.equal(active.lights,0);assert.ok(active.calls>0&&active.triangles>0);
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../artifacts/vortex-'+(mobile?'mobile':'desktop')+'.png')});
    const expired=await run("(()=>{for(let i=0;i<60;i++)updateGravity(.05);renderer.render(scene,camera);return singularities.length;})()");assert.equal(expired,0);
    assert.deepEqual(errors,[]);await page.close();
  });
});
