const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {webcrypto,timingSafeEqual}=require('node:crypto');
function createApp(){
 const db=new DatabaseSync(':memory:');
 const crypto={subtle:{timingSafeEqual:(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b))}};
 const ctx=vm.createContext({Request,Response,URL,TextEncoder,Uint8Array,console,Date,crypto,
   DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}}});
 let source=fs.readFileSync('online/feedback.mjs','utf8')
   .replace(/^import .*$/gm,'').replace('export class FeedbackInbox','class FeedbackInbox');
 source+='\nglobalThis.FeedbackInbox=FeedbackInbox;';
 vm.runInContext(source,ctx);
 const sql={exec(query,...args){
   const stmt=db.prepare(query);
   const rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);
   return{toArray:()=>rows};
 }};
 const inbox=new ctx.FeedbackInbox({storage:{sql}},{FEEDBACK_ADMIN_KEY:'a'.repeat(32)});
 const send=(path,{method='GET',body=null,key=''}={})=>{
   const headers={Origin:'https://babaw201.github.io'};
   if(body)headers['Content-Type']='application/json';
   if(key)headers.Authorization='Bearer '+key;
   return inbox.fetch(new Request('https://example.test'+path,{
     method,headers,body:body===null?undefined:JSON.stringify(body)
   }));
 };
 return{send,db};
}
test('feedback : sondages et signalements privés',async t=>{
 const app=createApp(),valid={kind:'bug',topic:'niveau5',message:'La porte bloque pendant la phase 2.'};
 await t.test('rejet des entrées invalides',async()=>{
   assert.equal((await app.send('/feedback',{method:'POST',body:{kind:'unknown',topic:'autre',message:'bonjour'}})).status,400);
   assert.equal((await app.send('/feedback',{method:'POST',body:{kind:'bug',topic:'murs',message:'court'}})).status,400);
   assert.equal((await app.send('/feedback',{method:'POST',body:{kind:'poll',topic:'secret',message:''}})).status,400);
   assert.equal((await app.send('/feedback/admin')).status,401);
   assert.equal((await app.send('/feedback/admin',{key:'b'.repeat(32)})).status,401);
 });
 await t.test('sondages et idées enregistrés anonymement',async()=>{
   assert.equal((await app.send('/feedback',{method:'POST',body:{kind:'poll',topic:'murs',message:''}})).status,201);
   assert.equal((await app.send('/feedback',{method:'POST',body:valid})).status,201);
   assert.equal((await app.send('/feedback',{method:'POST',body:{kind:'idea',topic:'cooperation',message:'Ajouter une carte en duo.'}})).status,201);
   const data=await (await app.send('/feedback/admin',{key:'a'.repeat(32)})).json();
   assert.equal(data.unread,3);
   assert.equal(data.entries.length,3);
   assert.deepEqual(Array.from(data.entries.map(e=>e.kind)),['idea','bug','poll']);
   assert.equal(data.entries[1].message,valid.message);
   assert.equal(data.entries[2].topic,'murs');
 });
 await t.test('marquage lu réservé au créateur',async()=>{
   assert.equal((await app.send('/feedback/read',{method:'POST'})).status,401);
   assert.equal((await app.send('/feedback/read',{method:'POST',key:'a'.repeat(32)})).status,200);
   const data=await (await app.send('/feedback/admin',{key:'a'.repeat(32)})).json();
   assert.equal(data.unread,0);
   assert.ok(data.entries.every(r=>r.seen===1));
 });
});
