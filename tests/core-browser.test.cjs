const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {gameResponse}=require('./serve-game.cjs');
const output=path.join(__dirname,'../artifacts/core/webgl');fs.mkdirSync(output,{recursive:true});

test('CORE: real WebGL, quality accessibility, collision, resources and comparable render budgets',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  t.after(()=>browser.close());const errors=[],records=[];
  async function pageFor({legacy=false,mobile=false,reducedMotion=false}={}){
    const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1200,height:750},isMobile:mobile,hasTouch:mobile,reducedMotion:reducedMotion?'reduce':'no-preference'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('limbyrinthCoreQualityV1','medium');});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.host!=='game.test')return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({top:[],totalPlayers:0})});
      if(legacy&&url.pathname.endsWith('/core-environment.js'))return route.fulfill({contentType:'text/javascript',body:''});
      return route.fulfill(gameResponse(url.pathname));
    });
    await page.goto('https://game.test/');await page.waitForFunction(()=>!!window.gameEval);
    if(!legacy)await page.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
    await page.evaluate(()=>{window.LimbyrinthFriends.requireProfile=callback=>{callback();return true;};});
    return page;
  }
  const page=await pageFor(),run=code=>page.evaluate(code=>window.gameEval(code),code);
  await t.test('native keyboard quality selector, saved choice and unchanged active gameplay',async()=>{
    const select=page.getByRole('combobox',{name:'Qualité graphique'});assert.equal(await select.count(),1);
    await select.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
    await select.selectOption('high');assert.equal(await page.evaluate(()=>localStorage.getItem('limbyrinthCoreQualityV1')),'high');
    await run('start(3,123)');const before=await run('JSON.stringify({grid,hp:players[0].hp,phase:level4.phase,seconds:timeLeft,keys:collected})');
    await run("window.LimbyrinthGraphics.save('low')");
    assert.equal(await run('JSON.stringify({grid,hp:players[0].hp,phase:level4.phase,seconds:timeLeft,keys:collected})'),before);
    assert.equal(await run('coreEnvironment.effects.visible'),false);
    assert.equal(await run('!!bfs([1,1],[7,7])'),true);
    assert.equal(await run('hit(toW(1),toW(1))'),false);
    await run('level4.phase=0;syncLevel4Gates()');assert.equal(await run('hit(dyn[1].x,dyn[1].z)'),true);
    await run('level4.phase=1;syncLevel4Gates()');assert.equal(await run('hit(dyn[1].x,dyn[1].z)'),false);
  });
  await t.test('five sectors, camera cutaway, wave/Titan signals and bounded WebGL resources',async()=>{
    for(let level=0;level<5;level++){
      await run(`window.LimbyrinthGraphics.save('medium');start(${level},123)`);
      await page.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
      const info=await run(`(()=>{animate(.016);renderer.render(scene,camera);
        return {...coreEnvironment.stats,calls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};})()`);
      assert.ok(info.calls<400,JSON.stringify(info));assert.ok(info.drawCalls<=80);records.push({level:level+1,...info});
      await run('camera.position.set(22,30,32);camera.lookAt(0,0,-3);renderer.render(scene,camera)');
      await page.locator('body > canvas').first().screenshot({path:path.join(output,'sector-'+(level+1)+'.png')});
      if(level===4){
        assert.equal(await run("(()=>{wave=5;coreEnvironment.update(t,{wave});let found=false;coreEnvironment.group.traverse(o=>{if(o.isInstancedMesh&&o.material.color?.getHex()===0xff708e)found=true;});return found;})()"),true);
        assert.equal(await run('hit(toW(7),toW(7))'),false);
      }
    }
    await run('setCameraMode(true);animate(.016)');assert.equal(await run('coreEnvironment.ceiling.visible'),true);
    await run('setCameraMode(false);animate(.016)');assert.equal(await run('coreEnvironment.ceiling.visible'),false);
    await run('start(4,123)');await page.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
    await run('renderer.render(scene,camera)');const warm=await run('({...renderer.info.memory})');
    for(let i=0;i<8;i++){
      await run(`window.LimbyrinthGraphics.save('${i%2?'low':'high'}');start(4,123)`);
      await page.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
      await run('renderer.render(scene,camera)');
    }
    await run("window.LimbyrinthGraphics.save('medium');start(4,123)");
    await page.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
    await run('renderer.render(scene,camera)');
    const end=await run('({...renderer.info.memory})');assert.ok(end.geometries<=warm.geometries+2,JSON.stringify({warm,end}));assert.ok(end.textures<=warm.textures+1,JSON.stringify({warm,end}));
  });
  await t.test('mobile / reduced motion: selector fits viewport and ambient effects stay off',async()=>{
    const mobile=await pageFor({mobile:true,reducedMotion:true});
    const select=mobile.getByRole('combobox',{name:'Qualité graphique'});assert.equal(await select.isVisible(),true);
    const rect=await select.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=844);
    await select.selectOption('high');assert.equal(await mobile.evaluate(()=>window.gameEval('coreEnvironment.effects.visible')),false);
    await mobile.close();
  });
  await t.test('identical corridor before/after, synthetic render timing and draw calls',async()=>{
    const before=await pageFor({legacy:true});
    const grid=Array.from({length:15},(_,z)=>Array.from({length:15},(_,x)=>x===7&&z>0&&z<14?0:1));
    for(const [name,p]of [['before',before],['after',page]]){
      if(name==='after'){
        await run(`(()=>{const previous=genMaze;genMaze=()=>({g:${JSON.stringify(grid)},dynCells:[]});cur=0;build();genMaze=previous;})()`);
        await p.waitForFunction(()=>window.gameEval("coreEnvironment.source==='blender'"),null,{polling:50});
      }
      const data=await p.evaluate(({grid})=>window.gameEval(`(()=>{
        const begin=performance.now();
        if(!coreEnvironment){const previous=genMaze;genMaze=()=>({g:${JSON.stringify(grid)},dynCells:[]});cur=0;build();genMaze=previous;}
        const buildMs=performance.now()-begin;
        coreEnvironment?.update(1,{firstPerson:true});camera.position.set(.75,1.55,21.3);camera.lookAt(-.15,1.65,-15);
        renderer.setPixelRatio(1);renderer.setSize(1200,750);renderer.render(scene,camera);
        const gl=renderer.getContext();gl.finish();const frames=[];
        for(let i=0;i<6;i++){const begin=performance.now();renderer.render(scene,camera);gl.finish();if(i>1)frames.push(performance.now()-begin);}
        const frameMs=frames.reduce((a,b)=>a+b,0)/frames.length;
        return {buildMs,frameMs,syntheticFps:1000/frameMs,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},gpu:gl.getParameter(gl.RENDERER)};
      })()`),{grid});
      await p.addStyleTag({content:'body>*:not(canvas){visibility:hidden!important}'});
      records.push({reference:name,...data});await p.locator('body > canvas').first().screenshot({path:path.join(output,'corridor-'+name+'.png')});
    }
    assert.ok(records.find(r=>r.reference==='after').calls<records.find(r=>r.reference==='before').calls,JSON.stringify(records));
    await before.close();
  });
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({note:'Same 1200×750 scene and camera. gl.finish synthetic render timing; runner GPU, not an Iris Xe hardware benchmark.',records},null,2)+'\n');
  assert.deepEqual(errors,[]);
});
