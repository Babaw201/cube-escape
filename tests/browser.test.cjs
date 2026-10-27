const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const {gameResponse}=require('./serve-game.cjs');

test('Limbyrinth — navigateur Three.js réel', async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  t.after(async () => { await browser.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {if(msg.type() === 'error') errors.push(msg.text());});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.route('https://game.test/**', route => route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
  await page.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/leaderboard*', route=>{
    const level=new URL(route.request().url()).searchParams.get('level');
    const sample={pseudo:'Aventurier32',score:920,level:level==='4'?4:1,won:true,mode:'Solo',created:Date.now()};
    return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://game.test'},body:JSON.stringify({level:level||'all',totalPlayers:1,top:[sample]})});
  });
  await page.goto('https://game.test/');
  await page.waitForFunction(() => !!window.gameEval);
  const run = code => page.evaluate(code => window.gameEval(code), code);

  await t.test('nouvel accueil : cinq secteurs, jouer et modes solo / coop', async () => {
    assert.equal(await page.locator('#home').isVisible(), true);
    assert.equal(await page.locator('#home .hm-sec').count(), 5);
    assert.equal(await page.locator('#home .hm-play').count(), 1);
    assert.equal(await page.locator('#home .hm-auth-hint').count(),1);
    assert.equal(await page.locator('#home .hm-seg button').count(), 3);
    assert.equal(await page.locator('#home .hm-thumb').count(),5);
    assert.equal(await page.locator('#home .hm-updates-details').count()>=1,true);
    const desktopFit=await page.evaluate(()=>{
      const root=document.querySelector('#home'),main=root.querySelector('.hm-main'),play=root.querySelector('.hm-play');
      const panel=root.querySelector('.hm-panel'),rect=el=>el.getBoundingClientRect();
      return {scroller:getComputedStyle(root).overflowY,containerScroll:root.scrollHeight-root.clientHeight,
        playBottom:rect(play).bottom,panelBottom:rect(panel).bottom,windowHeight:innerHeight};
    });
    assert.equal(desktopFit.scroller,'hidden');
    assert.ok(desktopFit.containerScroll<=1,JSON.stringify(desktopFit));
    assert.ok(desktopFit.playBottom<desktopFit.windowHeight,JSON.stringify(desktopFit));
    assert.ok(desktopFit.panelBottom<=desktopFit.windowHeight+1,JSON.stringify(desktopFit));
  });
  await t.test('fond du menu visible et prévisualisable; infos et avis regroupés',async()=>{
    assert.equal(fs.existsSync(path.join(root,'assets/home-scene.svg')),true);
    assert.equal(await page.locator('#home .hm-info-combined').count(),1);
    assert.equal(await page.locator('#home .hm-update-box').count(),1);
    assert.match(await page.locator('#home .hm-scene').evaluate(el=>getComputedStyle(el).backgroundImage),/home-scene\.svg/);
    await page.locator('#home .hm-art-preview').click();
    assert.equal(await page.locator('#home.hm-art-only').count(),1);
    await page.locator('#home .hm-art-preview').click();
    assert.equal(await page.locator('#home.hm-art-only').count(),0);
  });
  await t.test('pseudo obligatoire : un nouveau joueur ne peut pas démarrer sans inscription', async () => {
    await page.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/register', route =>
      route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://game.test'},
        body:JSON.stringify({pseudo:'JoueurRobot32',token:'valid-mock-token'})}));
    await page.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/me', route =>
      route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://game.test'},
        body:JSON.stringify({pseudo:'JoueurRobot32',friends:[],incoming:[],outgoing:[],invites:[],blocked:[]})}));
    await page.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/score', route =>
      route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://game.test'},
        body:JSON.stringify({ok:true,improved:true})}));
    assert.match(await page.locator('#home .hm-auth-hint').innerText(),/pseudo/i);
    await run('start(4,123)');
    assert.equal(await run('state'),'menu');
    assert.equal(await page.locator('#friends-screen').isVisible(),true);
    await page.locator('#friends-screen input[aria-label="Ton pseudo"]').fill('JoueurRobot32');
    await page.locator('#friends-screen form:has(input[aria-label="Ton pseudo"]) button[type="submit"]').click();
    await page.waitForFunction(()=>window.gameEval('state')==='play',null,{polling:50});
    assert.equal(await page.locator('#friends-screen').isVisible(),false);
    assert.equal(await page.locator('#home').isVisible(),false);
    await run('wave=3; missionElapsed=25; kills=2; endSurvival()');
    assert.equal(await run('state'),'menu');
    assert.equal(await page.locator('#home').isVisible(),true);
    assert.match(await page.locator('#home .hm-last-run').innerText(),/Vague 3/);
    assert.equal(await page.locator('#home .hm-auth-hint').innerText().then(x=>x.includes('Pseudo confirmé')),true);
    await page.evaluate(()=>localStorage.removeItem('limbyrinthScoresV1'));
  });

  await t.test('navigation : sélectionner un niveau ne lance pas immédiatement une partie', async()=>{
    await run('maxLv=5;renderLv()');
    assert.equal(await page.locator('#home .hm-sec').count(),5);
    await page.locator('#home .hm-sec').nth(2).click();
    assert.match(await page.locator('#home .hm-play').innerText(),/Niveau 3/);
    assert.equal(await page.locator('#home .hm-sec[aria-pressed="true"]').count(),1);
    assert.equal(await run('state'),'menu');
  });
  await t.test('écran paysage mobile : accueil compact et boutons tactiles sans chevauchement', async()=>{
    const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try{
      await mobile.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
      await mobile.route('https://game.test/**', route => route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
      await mobile.goto('https://game.test/');
      await mobile.waitForFunction(()=>!!document.querySelector('#home .hm-level-grid'),null,{polling:50});
      assert.equal(await mobile.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
      assert.equal(await mobile.evaluate(()=>matchMedia('(orientation:landscape)').matches),true);
      assert.equal(await mobile.locator('#home .hm-level-grid .hm-sec').count(),5);
      assert.equal(await mobile.locator('#home .hm-fullscreen-button').count(),1);
      const fit=await mobile.evaluate(()=>{
        const home=document.getElementById('home'), rect=q=>document.querySelector(q).getBoundingClientRect();
        return {scrollHeight:home.scrollHeight,clientHeight:home.clientHeight,
          overflow:getComputedStyle(home).overflowY,
          play:rect('#home .hm-play').bottom,
          levels:rect('#home .hm-level-grid').bottom,
          navigation:rect('#home .hm-row').bottom,
          actions:rect('#home .hm-actions-extra').bottom,
          viewport:innerHeight};
      });
      assert.equal(fit.overflow,'hidden');
      assert.ok(fit.scrollHeight<=fit.clientHeight+1,JSON.stringify(fit));
      assert.ok(fit.play<=fit.viewport+1 && fit.levels<=fit.viewport+1 &&
        fit.navigation<=fit.viewport+1 && fit.actions<=fit.viewport+1,JSON.stringify(fit));
      assert.equal(await mobile.locator('#joy').isVisible(),false);
      const layout=await mobile.evaluate(()=>{
        const main=document.querySelector('#home .hm-main').getBoundingClientRect();
        const hero=document.querySelector('#home .hm-main section').getBoundingClientRect();
        const panel=document.querySelector('#home .hm-panel').getBoundingClientRect();
        return {main:Math.round(main.width),sideBySide:hero.right<=panel.left+4};
      });
      assert.equal(layout.sideBySide,true,JSON.stringify(layout));
      await mobile.evaluate(()=>{
        window.LimbyrinthFriends.hasProfile=()=>true;
        window.gameEval('maxLv=5;renderLv()');
      });
      await mobile.locator('#home .hm-sec').nth(4).click();
      await mobile.locator('#home .hm-play').click();
      assert.equal(await mobile.locator('#home').isVisible(),false);
      assert.equal(await mobile.locator('#joy').isVisible(),true);
      assert.equal(await mobile.locator('#tulti').isVisible(),true);
      await mobile.locator('#tulti').click();
      assert.ok(await mobile.evaluate(()=>window.gameEval('players[0].ultCd>0')));
      const controls=await mobile.evaluate(()=>{
        const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return {joy:box('joy'),fire:box('tfire'),dash:box('tdash'),map:box('mm'),
          phaseVisible:getComputedStyle(document.getElementById('tphase')).display!=='none',
          klass:document.body.classList.contains('playing-game'),screen:[innerWidth,innerHeight]};
      });
      assert.equal(controls.klass,true,JSON.stringify(controls));
      assert.equal(controls.phaseVisible,false);
      assert.ok(controls.joy.width>=88 && controls.joy.width<=123,JSON.stringify(controls));
      assert.ok(controls.fire.width>=50 && controls.fire.height>=50,JSON.stringify(controls));
      assert.ok(controls.joy.right<controls.dash.x,JSON.stringify(controls));
      assert.ok(controls.map.bottom<controls.fire.y,JSON.stringify(controls));
      await mobile.evaluate(()=>window.gameEval('endSurvival()'));
      assert.equal(await mobile.locator('#home').isVisible(),true);
      assert.equal(await mobile.locator('#joy').isVisible(),false);
    }finally{await mobile.close();}
  });
  await t.test('accueil sans défilement sur téléphone portrait', async()=>{
    const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    try{
      await mobile.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
      await mobile.route('https://game.test/**', route => route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
      await mobile.goto('https://game.test/');
      const fit=await mobile.evaluate(()=>{
        const home=document.getElementById('home');
        const rect=q=>document.querySelector(q).getBoundingClientRect();
        return {height:home.clientHeight,scrollHeight:home.scrollHeight,
          play:rect('#home .hm-play').bottom,
          levels:rect('#home .hm-level-grid').bottom,
          scores:rect('#home .hm-scores-button').bottom,
          menu:rect('#home .hm-actions-extra').bottom,windowHeight:innerHeight};
      });
      assert.ok(fit.scrollHeight<=fit.height+1,JSON.stringify(fit));
      assert.ok(Math.max(fit.play,fit.levels,fit.scores,fit.menu)<=fit.windowHeight+1,JSON.stringify(fit));
    }finally{await mobile.close();}
  });
  await t.test('tableau des scores : affichage, filtre, historique local', async () => {
    await page.locator('#home .hm-scores-button').click();
    assert.equal(await page.locator('#scores-screen').isVisible(), true);
    assert.match(await page.locator('#scores-screen').innerText(), /Aucun score/);
    await page.evaluate(() => window.LimbyrinthScores.record({level:2, score:830, won:true, mode:"Solo", seconds:57, remaining:21, crystals:3, kills:2}));
    await page.evaluate(() => window.LimbyrinthScores.open());
    assert.equal(await page.locator('#scores-screen .scores-table tbody tr').count(),1);
    assert.match(await page.locator('#scores-screen .scores-table tbody tr').innerText(),/830/);
    await page.locator('#scores-screen .scores-local-controls select').first().selectOption('1');
    assert.match(await page.locator('#scores-screen').innerText(), /Aucun score/);
    await page.locator('#scores-screen .scores-local-controls select').first().selectOption('2');
    assert.equal(await page.locator('#scores-screen .scores-table tbody tr').count(),1);
    await page.locator('#scores-screen .scores-btn').first().click();
    assert.equal(await page.locator('#scores-screen').isVisible(),false);
    await page.evaluate(() => localStorage.removeItem('limbyrinthScoresV1'));
  });
  await t.test('mode survie valorisé dans le menu principal', async()=>{
    assert.equal(await page.locator('#home .hm-survival-card').count(),1);
    assert.match(await page.locator('#home .hm-survival-card').innerText(),/Vague 50/);
    assert.equal(await page.locator('#home .hm-sec.survival-special').count(),1);
  });
  await t.test('tableau des scores reconnaît les runs survie et la vague', async()=>{
    await page.evaluate(()=>window.LimbyrinthScores.record({level:5,score:1260,won:false,mode:'Solo',seconds:90,remaining:999999,crystals:0,kills:24,wave:8}));
    await page.locator('#home .hm-scores-button').click();
    assert.match(await page.locator('#scores-screen .scores-level').last().innerText(),/vague max 8/);
    await page.locator('#scores-screen .scores-local-controls select').first().selectOption('5');
    assert.match(await page.locator('#scores-screen .scores-table tbody').innerText(),/Vague 8/);
    await page.locator('#scores-screen .scores-btn').first().click();
    await page.evaluate(()=>localStorage.removeItem('limbyrinthScoresV1'));
  });
  await t.test('top 10 mondial en ligne avec pseudo et filtre de niveau', async()=>{
    await page.locator('#home .hm-scores-button').click();
    await page.waitForFunction(()=>document.querySelectorAll('#scores-screen .scores-online-table tbody tr').length===1,null,{polling:50});
    assert.match(await page.locator('#scores-screen .scores-online-table').innerText(),/Aventurier32/);
    assert.match(await page.locator('#scores-screen .scores-online-table').innerText(),/920/);
    await page.locator('#scores-screen .scores-online select').selectOption('4');
    await page.waitForFunction(()=>document.querySelector('#scores-screen .scores-online-table tbody tr td:nth-child(4)')?.textContent==='4',null,{polling:50});
    assert.equal(await page.locator('#scores-screen .scores-online-table tbody tr').count(),1);
    await page.locator('#scores-screen .scores-btn').first().click();
  });
  await t.test('Profil et amis : ouverture du panneau depuis le menu', async () => {
    assert.equal(await page.locator('#home .hm-friends-button').count(),1);
    await page.locator('#home .hm-friends-button').click();
    assert.equal(await page.locator('#friends-screen').isVisible(),true);
    assert.match(await page.locator('#friends-screen').innerText(), /AMIS & PROFIL/);
    await page.locator('#friends-screen .fr-btn').first().click();
    assert.equal(await page.locator('#friends-screen').isVisible(),false);
  });
  await t.test('connexion : session sauvegardée et reprise par code sans recréer le pseudo',async()=>{
    const access='11111111-1111-4111-8111-111111111111.22222222-2222-4222-8222-222222222222';
    const tab=await browser.newPage({viewport:{width:1000,height:740}});
    try{
      await tab.addInitScript(code=>{
        window.requestAnimationFrame=()=>0;
        localStorage.setItem('limbyrinthSocialTokenV1',code);
      },access);
      await tab.route('https://game.test/**',route=>route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
      await tab.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/me',route=>{
        const auth=route.request().headers().authorization;
        if(auth!=='Bearer '+access) return route.fulfill({status:401,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'https://game.test'},
          body:JSON.stringify({error:'Code invalide'})});
        return route.fulfill({status:200,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'https://game.test'},
          body:JSON.stringify({pseudo:'anna2',friends:[],incoming:[],outgoing:[],invites:[],blocked:[]})});
      });
      await tab.goto('https://game.test');
      await tab.waitForFunction(()=>window.LimbyrinthFriends?.hasProfile(),null,{polling:50});
      await tab.locator('#home .hm-friends-button').click();
      assert.match(await tab.locator('#friends-screen').innerText(),/anna2/);
      assert.equal(await tab.locator('#friends-screen input[aria-label="Ta clé secrète de reconnexion"]').inputValue(),access);
      tab.once('dialog',dialog=>dialog.accept());
      await tab.locator('#friends-screen .fr-danger').last().click();
      assert.equal(await tab.locator('#friends-screen input[aria-label="Code de reconnexion"]').count(),1);
      assert.equal(await tab.locator('#friends-screen input[aria-label="Ton pseudo"]').count(),1);
      await tab.locator('#friends-screen input[aria-label="Code de reconnexion"]').fill('not-a-secret');
      await tab.locator('#friends-screen button:has-text("Se reconnecter")').click();
      assert.match(await tab.locator('#fr-status').innerText(),/invalide/i);
      assert.equal(await tab.evaluate(()=>localStorage.getItem('limbyrinthSocialTokenV1')),null);
      await tab.locator('#friends-screen input[aria-label="Code de reconnexion"]').fill(access);
      await tab.locator('#friends-screen button:has-text("Se reconnecter")').click();
      await tab.waitForFunction(()=>window.LimbyrinthFriends?.hasProfile(),null,{polling:50});
      assert.match(await tab.locator('#friends-screen').innerText(),/anna2/);
      assert.equal(await tab.evaluate(()=>localStorage.getItem('limbyrinthSocialTokenV1')),access);
    }finally{await tab.close();}
  });
  await t.test('connexion : erreur serveur avec clé enregistrée ne propose pas de nouveau pseudo',async()=>{
    const tab=await browser.newPage({viewport:{width:1100,height:750}});
    try{
      await tab.addInitScript(()=>{
        window.requestAnimationFrame=()=>0;
        localStorage.setItem('limbyrinthSocialTokenV1','existing-token');
      });
      await tab.route('https://game.test/**',route=>route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
      await tab.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/me',route=>
        route.fulfill({status:503,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'https://game.test'},
          body:JSON.stringify({error:'Serveur temporairement indisponible'})}));
      await tab.goto('https://game.test');
      await tab.locator('#home .hm-friends-button').click();
      await tab.waitForFunction(()=>document.getElementById('fr-status')?.textContent.includes('Serveur temporairement'));
      assert.equal(await tab.locator('#friends-screen input[aria-label="Ton pseudo"]').count(),0);
      assert.equal(await tab.locator('#friends-screen button:has-text("Réessayer ma connexion")').count(),1);
      assert.equal(await tab.evaluate(()=>localStorage.getItem('limbyrinthSocialTokenV1')),'existing-token');
    }finally{await tab.close();}
  });
  await t.test('récompense Spectre d’anna2 : synchronisation du profil et équipement sans vague locale',async()=>{
    const tab=await browser.newPage({viewport:{width:1000,height:700}});
    try{
      await tab.addInitScript(()=>{
        window.requestAnimationFrame=()=>0;
        localStorage.setItem('limbyrinthSocialTokenV1','test-token');
      });
      await tab.route('https://game.test/**',route=>route.fulfill(gameResponse(new URL(route.request().url()).pathname)));
      await tab.route('https://limbyrinth-online.baptiste-werner.workers.dev/social/me',route=>
        route.fulfill({status:200,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'https://game.test'},
          body:JSON.stringify({pseudo:'anna2',friends:[],incoming:[],outgoing:[],invites:[],blocked:[],unlockedRobots:['rspectre']})}));
      await tab.goto('https://game.test');
      await tab.waitForFunction(()=>window.LimbyrinthFriends?.hasProfile()
        && window.gameEval('save.own.includes("rspectre")'));
      assert.equal(await tab.evaluate(()=>window.gameEval('save.survivalMaxWave')),0);
      assert.equal(await tab.evaluate(()=>window.gameEval('save.own.includes("rspectre")')),true);
      const status=await tab.evaluate(()=>window.gameEval(`(() => {
        shopTab='robot';act(ROBOT_SKINS.find(r=>r.id==='rspectre'));
        return {robot:save.robot,persisted:JSON.parse(localStorage.getItem('cubeEscapeSave')).robot};
      })()`));
      assert.deepEqual(status,{robot:'rspectre',persisted:'rspectre'});
    }finally{await tab.close();}
  });
  await t.test('infos et formulaire de retours accessibles depuis le menu', async () => {
    assert.equal(await page.locator('#home .hm-update-box').count(),1);
    if(await page.locator('#home .hm-update-box:not([open]) summary').count()) await page.locator('#home .hm-update-box summary').click();
    assert.match(await page.locator('#home .hm-update-box').innerText(), /Niveau 5/);
    await page.locator('#home .hm-feedback-button').click();
    assert.equal(await page.locator('#feedback-screen').isVisible(),true);
    assert.match(await page.locator('#feedback-screen').innerText(),/Amélioration/);
    await page.locator('#feedback-screen .fb-top button').click();
    assert.equal(await page.locator('#feedback-screen').isVisible(),false);
  });
  await t.test('formulaire : vote envoyé par la vraie interface', async () => {
    await page.evaluate(() => {
      window.__feedbackVote = null;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (url, options) => {
        if (String(url).endsWith('/feedback')) {
          window.__feedbackVote = JSON.parse(options.body);
          return Promise.resolve({ok:true,json:async()=>({ok:true})});
        }
        return nativeFetch(url,options);
      };
    });
    if(await page.locator('#home .hm-update-box:not([open]) summary').count()) await page.locator('#home .hm-update-box summary').click();
    await page.locator('#home .hm-feedback-card').click();
    assert.equal(await page.locator('#feedback-screen').isVisible(),true);
    await page.locator('#fb-topic').selectOption('murs');
    await page.locator('#feedback-screen form button[type=submit]').click();
    await page.waitForFunction(()=>!!window.__feedbackVote);
    assert.deepEqual(await page.evaluate(()=>window.__feedbackVote),{kind:'poll',topic:'murs',message:''});
    assert.match(await page.locator('#feedback-screen .fb-status').innerText(),/transmis/);
    await page.locator('#feedback-screen .fb-top button').click();
  });
  await t.test('quatre niveaux de campagne et une arène infinie', async () => {
    assert.equal(await run('LV.length'), 5);
  });
  await t.test('niveau 5 : démarre en WebGL et affiche la première vague', async () => {
    const data=await run(`(() => {
      start(4); update(.05);
      return {wave,foes:foes.length,crystals:crystals.length,live:state,
        noDeadline:timeLeft===999999,hasTimer:document.querySelector('#tm').textContent.includes('min')};
    })()`);
    assert.equal(data.wave,1);
    assert.ok(data.foes>0);
    assert.equal(data.crystals,0);
    assert.equal(data.live,'play');
    assert.equal(data.noDeadline,true);
    assert.equal(data.hasTimer,true);
  });
  await t.test('carte : dimensions et marqueurs uniques', async () => {
    assert.deepEqual(await run(`({rows:LEVEL4_MAP.length,lengths:LEVEL4_MAP.map(r=>r.length),markers:[...'SO123ABCE'].map(c=>LEVEL4_MAP.join('').split(c).length-1)})`),{rows:15,lengths:Array(15).fill(15),markers:Array(9).fill(1)});
  });
  await t.test('les modèles ont des silhouettes et animations distinctes', async () => {
    const data = await run(`ROBOT_SKINS.map(s => { const rig = creerRobot(0, 0, false, s.id); animerRobot(rig, 1, true, true); const size = new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3()); return { id: s.id, size: size.toArray().map(v => +v.toFixed(2)), shape: rig.shape }; })`);
    assert.equal(data.length, 7);
    assert.equal(new Set(data.map(v => v.shape)).size, 5);
    assert.ok(new Set(data.map(v => v.size.join(','))).size >= 4);
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
    assert.equal(result.state,'menu',JSON.stringify(result));assert.equal(result.collected,3);assert.ok(result.timeLeft>0);
  });
  await t.test('coop réseau : le modèle de chaque joueur est préservé', async () => {
    assert.equal(await run(`(() => { net='host';nP=2;save.robot='rorb';onMsg({t:'cosmetic',robot:'rtrack'});start(3);const ok=players[0].rig.shape==='orb'&&players[1].rig.shape==='tracks';net=null;nP=1;return ok; })()`),true);
  });
  await t.test('fin de partie : score enregistré depuis le moteur', async () => {
    const data = await run('(() => {net=null; nP=1; start(0); collected=2; timeLeft=12; missionElapsed=41; kills=1; end(false,"Test"); return window.LimbyrinthScores.read().at(-1);})()');
    assert.equal(data.level,1);
    assert.equal(data.score,200);
    assert.equal(data.won,false);
    assert.equal(data.mode,'Solo');
    assert.equal(data.seconds,41);
    assert.equal(data.crystals,2);
  });
  await t.test('aucune erreur JavaScript ou WebGL', () => assert.deepEqual(errors, []));
});
