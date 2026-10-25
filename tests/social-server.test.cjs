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
    assert.equal((await app.call('register',{method:'POST',body:{pseudo:'robot32'})).status,409);
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