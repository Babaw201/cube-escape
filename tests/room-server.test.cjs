const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {webcrypto,timingSafeEqual}=require('node:crypto');

function serverRuntime(){
  assert.ok(fs.existsSync('online/worker.mjs'),'Le service de salons doit exister');
  const rooms=new Map();let now=1000000;
  class Socket{constructor(){this.readyState=1;this.sent=[];this.attachment=null;}send(s){this.sent.push(JSON.parse(s));}close(code,reason){this.readyState=3;this.closeCode=code;this.closeReason=reason;}serializeAttachment(v){this.attachment=structuredClone(v);}deserializeAttachment(){return structuredClone(this.attachment);}}
  class Pair{constructor(){this[0]=new Socket();this[1]=new Socket();this[0].peer=this[1];this[1].peer=this[0];}}
  class WorkerResponse extends Response{constructor(body,init={}){super(body,{...init,status:init.status===101?200:init.status});if(init.status===101){Object.defineProperty(this,'status',{value:101});this.webSocket=init.webSocket;}}}
  const nativeDate=Date;class Clock extends nativeDate{static now(){return now;}}
  const context=vm.createContext({Request,Response:WorkerResponse,URL,TextEncoder,Uint8Array,WebSocketPair:Pair,WebSocketRequestResponsePair:class{constructor(request,response){this.request=request;this.response=response;}},Date:Clock,console,crypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto),randomUUID:webcrypto.randomUUID.bind(webcrypto),subtle:{digest:webcrypto.subtle.digest.bind(webcrypto.subtle),timingSafeEqual:(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b))}},DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}}});
  let source=fs.readFileSync('online/worker.mjs','utf8').replace(/^import .*$/gm, '').replace(/^export \{ SocialHub \};$/gm, '').replace('export class GameRoom','class GameRoom').replace('export default {','globalThis.worker={');source+='\nglobalThis.RoomClass=GameRoom;';vm.runInContext(source,context);
  const env={ROOMS:{getByName(code){if(!rooms.has(code)){
    const db=new DatabaseSync(':memory:'),sockets=[];
    const ctx={storage:{sql:{exec(sql,...args){const stmt=db.prepare(sql),rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}},async setAlarm(t){this.alarm=t;}},setWebSocketAutoResponse(pair){this.autoResponse=pair;},acceptWebSocket(ws,tags){ws.tags=tags;sockets.push(ws);},getWebSockets(tag){return sockets.filter(s=>s.readyState===1&&(!tag||s.tags.includes(tag)));}};
    const room=new context.RoomClass(ctx,env);rooms.set(code,{room,ctx,db,sockets});
  }return rooms.get(code).room;}},ROOM_LIMIT:{async limit(){return{success:true};}}};
  const request=(path,options={})=>context.worker.fetch(new Request('https://relay.example'+path,{...options,headers:{Origin:'https://babaw201.github.io',...options.headers}}),env);
  return {env,rooms,request,setNow:v=>now=v,async create(){const r=await request('/rooms',{method:'POST'});assert.equal(r.status,201);return r.json();},async connect(code,role='guest',token=''){const headers={Upgrade:'websocket','Sec-WebSocket-Protocol':'limbyrinth-v1'+(role==='host'?', host.'+token:'')};return request('/rooms/'+code+'/socket',{headers});}};
}

test('salons — création, rôles, relais et fermeture',async t=>{
  const app=serverRuntime();
  await t.test('création : code court distinct et jeton hôte hors consultation publique',async()=>{
    const a=await app.create(),b=await app.create();assert.match(a.code,/^[A-HJ-NP-Z2-9]{8}$/);assert.notEqual(a.code,b.code);assert.ok(a.hostToken.length>=32);
    const r=await app.request('/rooms/'+a.code);const info=await r.json();assert.equal(info.state,'waiting');assert.ok(!JSON.stringify(info).includes(a.hostToken));
  });
  await t.test('origine inconnue et limites : refus avant création',async()=>{
    assert.equal((await app.request('/rooms',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
    app.env.ROOM_LIMIT.limit=async()=>({success:false});assert.equal((await app.request('/rooms',{method:'POST'})).status,429);app.env.ROOM_LIMIT.limit=async()=>({success:true});
  });
  await t.test('code invalide ou inexistant : réponse lisible',async()=>{
    assert.equal((await app.request('/rooms/invalid')).status,400);assert.equal((await app.request('/rooms/ABCDEFGH')).status,404);
  });
  await t.test('rôle hôte : jeton requis et hôte unique',async()=>{
    const room=await app.create();assert.equal((await app.connect(room.code,'host','wrong')).status,403);
    assert.equal((await app.connect(room.code,'host',room.hostToken)).status,101);assert.equal((await app.connect(room.code,'host',room.hostToken)).status,409);
  });
  await t.test('un invité attend que l’hôte soit connecté ; troisième connexion refusée',async()=>{
    const info=await app.create();assert.equal((await app.connect(info.code)).status,409);
    const host=await app.connect(info.code,'host',info.hostToken);assert.equal(host.status,101);const guest=await app.connect(info.code);assert.equal(guest.status,101);
    const {sockets}=app.rooms.get(info.code);assert.ok(sockets[0].sent.some(m=>m.t==='room'&&m.state==='ready'&&m.role==='host'));assert.ok(sockets[1].sent.some(m=>m.t==='room'&&m.state==='ready'&&m.role==='guest'));
    assert.equal((await app.connect(info.code)).status,409);assert.equal((await (await app.request('/rooms/'+info.code)).json()).state,'full');
  });
  await t.test('relais : état hôte et commandes invité traversent le salon',async()=>{
    const info=await app.create();await app.connect(info.code,'host',info.hostToken);await app.connect(info.code);const {room,sockets}=app.rooms.get(info.code),[host,guest]=sockets;
    room.webSocketMessage(host,JSON.stringify({t:'start',lv:3,seed:123}));assert.deepEqual(guest.sent.at(-1),{t:'start',lv:3,seed:123});
    room.webSocketMessage(guest,JSON.stringify({t:'i',dx:1,dz:0,phase:true}));assert.equal(host.sent.at(-1).phase,true);
  });
  await t.test('un invité ne peut pas envoyer un départ ou un snapshot d’hôte',async()=>{
    const info=await app.create();await app.connect(info.code,'host',info.hostToken);await app.connect(info.code);const {room,sockets}=app.rooms.get(info.code);const before=sockets[0].sent.length;
    room.webSocketMessage(sockets[1],JSON.stringify({t:'start',lv:3,seed:1}));assert.equal(sockets[0].sent.filter(m=>m.t==='start').length,0);assert.ok(sockets[1].readyState===3);assert.ok(sockets[0].sent.length>=before);
  });
  await t.test('trame mal formée ou trop longue : fermeture du salon',async()=>{
    for(const message of ['not json','x'.repeat(65537)]){const info=await app.create();await app.connect(info.code,'host',info.hostToken);await app.connect(info.code);const {room,sockets}=app.rooms.get(info.code);room.webSocketMessage(sockets[1],message);assert.equal(sockets[1].readyState,3);}
  });
  await t.test('déconnexion : l’autre joueur est averti et le salon devient indisponible',async()=>{
    const info=await app.create();await app.connect(info.code,'host',info.hostToken);await app.connect(info.code);const {room,sockets}=app.rooms.get(info.code);sockets[0].readyState=3;room.webSocketClose(sockets[0],1000,'');assert.ok(sockets[1].sent.some(m=>m.state==='closed'));assert.equal((await app.connect(info.code)).status,410);
  });
  await t.test('expiration et hibernation : état durable, puis refus après délai',async()=>{
    const info=await app.create();const {ctx}=app.rooms.get(info.code);const Room=app.rooms.get(info.code).room.constructor;const restored=new Room(ctx,app.env);assert.equal(restored.describe().state,'waiting');
    app.setNow(info.expires+1);assert.equal((await app.connect(info.code,'host',info.hostToken)).status,410);
  });
});
