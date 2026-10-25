const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {webcrypto,timingSafeEqual}=require('node:crypto');
function createApp({discordWebhook='',emailTo='',emailApiKey='',failDelivery=false}={}){
 const db=new DatabaseSync(':memory:');
 const alerts=[],alarms=[];
 const delivery={fail:failDelivery};
 const crypto={subtle:{timingSafeEqual:(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b))}};
 const fetch=async(url,options)=>{
   alerts.push({url,options,payload:JSON.parse(options.body)});
   return{ok:!delivery.fail,status:delivery.fail?503:204};
 };
 const ctx=vm.createContext({Request,Response,URL,TextEncoder,Uint8Array,console,Date,crypto,
   fetch,AbortController,setTimeout:()=>1,clearTimeout:()=>{},
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
 const inbox=new ctx.FeedbackInbox({storage:{sql,setAlarm:async due=>alarms.push(due)}},{
   FEEDBACK_ADMIN_KEY:'a'.repeat(32),FEEDBACK_DISCORD_WEBHOOK_URL:discordWebhook,
   FEEDBACK_EMAIL_TO:emailTo,RESEND_API_KEY:emailApiKey
 });
 const send=(path,{method='GET',body=null,key=''}={})=>{
   const headers={Origin:'https://babaw201.github.io'};
   if(body)headers['Content-Type']='application/json';
   if(key)headers.Authorization='Bearer '+key;
   return inbox.fetch(new Request('https://example.test'+path,{
     method,headers,body:body===null?undefined:JSON.stringify(body)
   }));
 };
 return{send,db,alerts,alarms,delivery,inbox};
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

test('alertes de bugs Discord : livraison privée, limites et reprise',async t=>{
 const webhook='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEF123456';
 const bug={kind:'bug',topic:'murs',message:'Une porte se referme devant mon personnage.'};
 await t.test('seuls les bugs déclenchent une alerte',async()=>{
   const app=createApp({discordWebhook:webhook});
   const poll=await app.send('/feedback',{method:'POST',body:{kind:'poll',topic:'murs',message:''}});
   const idea=await app.send('/feedback',{method:'POST',body:{kind:'idea',topic:'murs',message:'Ajouter des murs qui bougent.'}});
   const report=await app.send('/feedback',{method:'POST',body:bug});
   assert.equal(poll.status,201);assert.equal(idea.status,201);assert.equal(report.status,201);
   assert.equal(app.alerts.length,1);
   assert.equal(app.alerts[0].url,webhook);
   assert.match(app.alerts[0].payload.content,/Une porte se referme/);
   assert.deepEqual(JSON.parse(JSON.stringify(app.alerts[0].payload.allowed_mentions)),{parse:[]});
   assert.equal(app.db.prepare('SELECT count(*) AS n FROM bug_alerts').get().n,0);
 });
 await t.test('échec réseau : rapport conservé et alerte reprogrammée',async()=>{
   const app=createApp({discordWebhook:webhook,failDelivery:true});
   const result=await app.send('/feedback',{method:'POST',body:bug});
   assert.equal(result.status,201);
   assert.equal(app.alerts.length,1);
   assert.equal(app.db.prepare('SELECT count(*) AS n FROM feedback').get().n,1);
   const queued=app.db.prepare('SELECT attempts,next_try FROM bug_alerts').get();
   assert.equal(queued.attempts,1);
   assert.ok(queued.next_try>Date.now());
   assert.ok(app.alarms.length>=1);
   app.delivery.fail=false;
   app.db.prepare('UPDATE bug_alerts SET next_try=0').run();
   await app.inbox.alarm();
   assert.equal(app.alerts.length,2);
   assert.equal(app.db.prepare('SELECT count(*) AS n FROM bug_alerts').get().n,0);
 });
 await t.test('sans webhook, aucun message externe mais tous les bugs sont enregistrés',async()=>{
   const app=createApp();
   assert.equal((await app.send('/feedback',{method:'POST',body:bug})).status,201);
   assert.equal(app.alerts.length,0);
   assert.equal(app.db.prepare('SELECT count(*) AS n FROM bug_alerts').get().n,1);
 });
 await t.test('un webhook hors discord.com est ignoré',async()=>{
   const app=createApp({discordWebhook:'https://evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEF123456'});
   assert.equal((await app.send('/feedback',{method:'POST',body:bug})).status,201);
   assert.equal(app.alerts.length,0);
 });
});
