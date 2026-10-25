const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {webcrypto}=require('node:crypto');

function makeApp(){
  const db=new DatabaseSync(':memory:');
  const context=vm.createContext({Request,Response,URL,TextEncoder,Uint8Array,console,Date,
    crypto:{randomUUID:webcrypto.randomUUID.bind(webcrypto),subtle:webcrypto.subtle},
    DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}}});
  let source=fs.readFileSync('online/social.mjs','utf8')
    .replace(/^import .*$/gm,'').replace('export class SocialHub','class SocialHub');
  source+='\nglobalThis.SocialHub=SocialHub;';
  vm.runInContext(source,context);
  const sql={exec(query,...args){
    const statement=db.prepare(query);
    const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);
    return{toArray:()=>rows};
  }};
  const hub=new context.SocialHub({storage:{sql}},{});
  function call(path,{method='GET',token='',body=null}={}){
    const headers={Origin:'https://babaw201.github.io'};
    if(token)headers.Authorization='Bearer '+token;
    if(body)headers['Content-Type']='application/json';
    return hub.fetch(new Request('https://relay.example/social/'+path,{method,headers,body:body?JSON.stringify(body):undefined}));
  }
  return{db,hub,call,async register(pseudo){
    const r=await call('register',{method:'POST',body:{pseudo}});
    assert.equal(r.status,201);
    return r.json();
  }};
}

test('amis : pseudonymes uniques, identité protégée, demandes et invitations',async t=>{
  const app=makeApp();
  await t.test('compte pseudo unique et format',async()=>{
    const r=await app.call('register',{method:'POST',body:{pseudo:'a'}});
    assert.equal(r.status,400);
    const a=await app.register('Robot32');
    assert.match(a.token,/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/);
    assert.equal((await app.call('register',{method:'POST',body:{pseudo:'robot32'}})).status,409);
    assert.equal((await app.call('me')).status,401);
    assert.equal((await app.call('me',{token:'nope'})).status,401);
    assert.equal((await app.call('me',{token:a.token})).status,200);
  });
  const a=await app.register('Alpha42'),b=await app.register('Beta42'),c=await app.register('Gamma42');
  await t.test('une demande doit être acceptée, pas auto-acceptée',async()=>{
    assert.equal((await app.call('request',{method:'POST',token:a.token,body:{pseudo:b.pseudo}})).status,201);
    assert.equal((await app.call('request',{method:'POST',token:a.token,body:{pseudo:b.pseudo}})).status,409);
    assert.equal((await app.call('request',{method:'POST',token:a.token,body:{pseudo:a.pseudo}})).status,400);
    const aa=await (await app.call('me',{token:a.token})).json();
    const bb=await (await app.call('me',{token:b.token})).json();
    assert.deepEqual(Array.from(aa.outgoing),['Beta42']);
    assert.deepEqual(Array.from(bb.incoming),['Alpha42']);
    assert.deepEqual(Array.from(bb.friends),[]);
    assert.equal((await app.call('invite',{method:'POST',token:a.token,body:{pseudo:b.pseudo,room:'ABCDEFGH'}})).status,403);
    assert.equal((await app.call('respond',{method:'POST',token:b.token,body:{pseudo:a.pseudo,accept:true}})).status,200);
    assert.deepEqual(Array.from((await (await app.call('me',{token:a.token})).json()).friends),['Beta42']);
    assert.deepEqual(Array.from((await (await app.call('me',{token:b.token})).json()).friends),['Alpha42']);
  });
  await t.test('invitations seulement entre amis',async()=>{
    assert.equal((await app.call('invite',{method:'POST',token:c.token,body:{pseudo:a.pseudo,room:'ABCDEFGH'}})).status,403);
    assert.equal((await app.call('invite',{method:'POST',token:a.token,body:{pseudo:b.pseudo,room:'ABCDEFGH'}})).status,201);
    assert.deepEqual(JSON.parse(JSON.stringify((await (await app.call('me',{token:b.token})).json()).invites)),[{pseudo:'Alpha42',room:'ABCDEFGH'}]);
  });
  await t.test('renommer conserve les amitiés, le blocage les révoque',async()=>{
    assert.equal((await app.call('rename',{method:'POST',token:b.token,body:{pseudo:'BetaNew'}})).status,200);
    assert.deepEqual(Array.from((await (await app.call('me',{token:a.token})).json()).friends),['BetaNew']);
    assert.equal((await app.call('block',{method:'POST',token:b.token,body:{pseudo:'Alpha42'}})).status,200);
    assert.deepEqual(Array.from((await (await app.call('me',{token:a.token})).json()).friends),[]);
    assert.equal((await app.call('request',{method:'POST',token:a.token,body:{pseudo:'BetaNew'}})).status,403);
    assert.equal((await app.call('unblock',{method:'POST',token:b.token,body:{pseudo:'Alpha42'}})).status,200);
    assert.equal((await app.call('request',{method:'POST',token:a.token,body:{pseudo:'BetaNew'}})).status,201);
    assert.equal((await app.call('respond',{method:'POST',token:b.token,body:{pseudo:'Alpha42',accept:false}})).status,200);
    assert.deepEqual(Array.from((await (await app.call('me',{token:a.token})).json()).friends),[]);
  });
});
test('top 10 en ligne : pseudos, meilleurs scores et classement par niveau', async t=>{
 const app=makeApp();
 const users=[];
 for(let i=0;i<12;i++) users.push(await app.register('Player'+String(i+1).padStart(2,'0')));
 const submit=async(user,level,remaining,crystals=3,won=true,mode='Solo')=>{
   const score=crystals*100+(won?Math.ceil(remaining)*10:0);
   return app.call('score',{method:'POST',token:user.token,body:{level,remaining,crystals,won,score,seconds:45,mode}});
 };
 await t.test('écriture impossible sans pseudo, données incohérentes rejetées',async()=>{
   assert.equal((await app.call('score',{method:'POST',body:{level:1,score:300}})).status,401);
   const bad=await app.call('score',{method:'POST',token:users[0].token,body:{level:1,score:9000,crystals:3,remaining:50,won:true,seconds:40,mode:'Solo'}});
   assert.equal(bad.status,400);
   assert.equal((await app.call('leaderboard?level=abc')).status,400);
   assert.deepEqual(Array.from((await (await app.call('leaderboard')).json()).top),[]);
 });
 await t.test('douze joueurs et seulement dix premières places',async()=>{
   for(let i=0;i<users.length;i++)assert.equal((await submit(users[i],1,80-i)).status,200);
   const data=await (await app.call('leaderboard')).json();
   assert.equal(data.top.length,10);
   assert.equal(data.totalPlayers,12);
   assert.equal(data.top[0].pseudo,'Player01');
   assert.equal(data.top[0].score,1100);
   assert.equal(data.top[9].pseudo,'Player10');
   assert.ok(data.top.every(r=>r.level===1));
 });
 await t.test('une mauvaise partie ne remplace pas le record',async()=>{
   const last=await submit(users[0],1,20);
   assert.equal((await last.json()).improved,false);
   const ranked=await (await app.call('leaderboard?level=1')).json();
   assert.equal(ranked.top[0].score,1100);
 });
 await t.test('classement par niveau et meilleur résultat global par pseudo',async()=>{
   const improved=await submit(users[11],4,220);
   assert.equal((await improved.json()).improved,true);
   const lvl4=await (await app.call('leaderboard?level=4')).json();
   assert.equal(lvl4.top.length,1);
   assert.equal(lvl4.top[0].pseudo,'Player12');
   assert.equal(lvl4.top[0].score,2500);
   const overall=await (await app.call('leaderboard')).json();
   assert.equal(overall.top[0].pseudo,'Player12');
   assert.equal(overall.top.filter(r=>r.pseudo==='Player12').length,1);
 });
 await t.test('changer de pseudo actualise l’affichage sans perdre son score',async()=>{
   assert.equal((await app.call('rename',{method:'POST',token:users[11].token,body:{pseudo:'Champion32'}})).status,200);
   const ranked=await (await app.call('leaderboard?level=4')).json();
   assert.equal(ranked.top[0].pseudo,'Champion32');
 });
 await t.test('le même score ne génère pas de doublons',async()=>{
   assert.equal((await submit(users[11],4,220)).status,200);
   assert.equal(app.db.prepare('SELECT count(*) AS n FROM leaderboard_scores WHERE level=4').get().n,1);
 });
});