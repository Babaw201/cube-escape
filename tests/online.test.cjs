const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runtime}=require('./runtime.cjs');
function client(fetchOverride){
  const sockets=[],requests=[];
  class Socket{
    static OPEN=1;static CLOSED=3;
    constructor(url,protocols){this.url=url;this.protocols=protocols;this.readyState=0;this.sent=[];sockets.push(this);}
    open(){this.readyState=1;this.onopen?.({});}receive(data){this.onmessage?.({data:JSON.stringify(data)});}send(data){this.sent.push(JSON.parse(data));}close(){this.readyState=3;this.onclose?.({reason:'closed'});}
  }
  const game=runtime({}, {WebSocket:Socket,fetch:async(url,options)=>{requests.push({url,method:options?.method||'GET'});return fetchOverride?fetchOverride(url,options):new Response(JSON.stringify(options?.method==='POST'?{code:'ABCD2345',hostToken:'host-only-token',expires:123456}:{state:'waiting',hostReady:true,players:1}),{status:options?.method==='POST'?201:200});}});
  return {game,sockets,requests};
}
test('salons — client du jeu',async t=>{
  await t.test('codes lisibles et lien d’invitation sans jeton hôte',()=>{
    const {game}=client();assert.equal(game.run(`normalizeRoomCode(' abcd-2345 ')`),'ABCD2345');assert.equal(game.run(`roomInvite('ABCD2345')`),'https://babaw201.github.io/cube-escape/#salon=ABCD2345');
  });
  await t.test('création : attente avant arrivée de l’ami, puis rôle hôte',async()=>{
    const {game,sockets,requests}=client();await game.runAsync('openNet();createOnlineRoom()');assert.equal(requests[0].method,'POST');const ws=sockets[0];assert.ok(ws.protocols.includes('host.host-only-token'));ws.open();ws.receive({t:'room',state:'waiting',code:'ABCD2345'});
    assert.equal(game.run('net'),null);assert.equal(game.run(`$('room-details').hidden`),false);ws.receive({t:'room',state:'ready',role:'host',code:'ABCD2345'});assert.equal(game.run('net'),'host');assert.equal(game.run('nP'),2);assert.ok(ws.sent.some(m=>m.t==='cosmetic'));
  });
  await t.test('rejoindre : code normalisé, aucune clé hôte, rôle invité',async()=>{
    const {game,sockets}=client();await game.runAsync(`openNet();$('room-input').value='abcd-2345';joinOnlineRoom()`);const ws=sockets[0];assert.ok(ws.url.includes('/rooms/ABCD2345/socket'));assert.ok(!ws.protocols.some(p=>p.startsWith('host.')));ws.open();ws.receive({t:'room',state:'ready',role:'guest',code:'ABCD2345'});assert.equal(game.run('net'),'guest');
    ws.receive({t:'start',lv:3,seed:123});assert.equal(game.run('cur'),3);assert.equal(game.run('state'),'play');assert.equal(game.run('players.length'),2);
  });
  await t.test('code invalide : aucun appel réseau',async()=>{
    const {game,requests}=client();await game.runAsync(`openNet();$('room-input').value='123';joinOnlineRoom()`);assert.equal(requests.length,0);assert.match(game.run(`$('nm').textContent`),/8 caractères/);
  });
  await t.test('salon expiré ou complet : message et possibilité de réessayer',async()=>{
    for(const response of [{body:{error:'Salon fermé ou expiré.'},status:410},{body:{state:'full',hostReady:true},status:200}]){
      const {game,sockets}=client(()=>new Response(JSON.stringify(response.body),{status:response.status}));await game.runAsync(`openNet();$('room-input').value='ABCD2345';joinOnlineRoom()`);assert.equal(sockets.length,0);assert.equal(game.run(`$('room-join').disabled`),false);assert.match(game.run(`$('nm').textContent`),/expiré|complet/);
    }
  });
  await t.test('annuler pendant la création ignore la réponse tardive',async()=>{
    let resolve;const response=new Promise(r=>resolve=r);const {game,sockets}=client(()=>response);const pending=game.runAsync('openNet();createOnlineRoom()');game.run('leaveOnline()');resolve(new Response(JSON.stringify({code:'ABCD2345',hostToken:'late-token',expires:1}),{status:201}));await pending;assert.equal(sockets.length,0);assert.equal(game.run('net'),null);
  });
  await t.test('quitter ferme la connexion et ignore les anciens messages',async()=>{
    const {game,sockets}=client();await game.runAsync('openNet();createOnlineRoom()');const ws=sockets[0];ws.open();ws.receive({t:'room',state:'ready',role:'host',code:'ABCD2345'});game.run('leaveOnline()');ws.receive({t:'start',lv:3,seed:1});assert.equal(ws.readyState,3);assert.equal(game.run('net'),null);assert.equal(game.run('nP'),1);assert.equal(game.run('state'),'menu');
  });
  await t.test('invitation : salon prérempli sans connexion automatique',()=>{
    const game=runtime({}, {location:{href:'https://babaw201.github.io/cube-escape/#salon=ABCD2345',hash:'#salon=ABCD2345'}});assert.equal(game.run(`$('room-input').value`),'ABCD2345');assert.equal(game.run(`$('net').style.display`),'flex');assert.equal(game.run('net'),null);
  });
  await t.test('saisie du code : R et Entrée ne démarrent pas une partie solo',()=>{
    const {game}=client();const data=game.run(`(() => {openNet();save.stock.time=1;const field=$('room-input');field.tagName='INPUT';dispatchEvent(new KeyboardEvent('keydown',{key:'r',target:field}));dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',target:field}));return {state,stock:save.stock.time};})()`);assert.deepEqual(data,{state:'menu',stock:1});
  });
  await t.test('invité dans le menu : action Quitter accessible dans le menu',async()=>{
    const {game,sockets}=client();await game.runAsync(`openNet();$('room-input').value='ABCD2345';joinOnlineRoom()`);sockets[0].open();sockets[0].receive({t:'room',state:'ready',role:'guest',code:'ABCD2345'});
    const left=game.run(`(() => {const b=$('lv').children.find(b=>b.textContent==='Quitter le salon');if(!b)return false;b.onclick();return net===null&&state==='menu';})()`);assert.equal(left,true);
  });
  await t.test('deux clients : départ, snapshots de phases et commandes traversent le transport',async()=>{
    const host=client(),guest=client();await host.game.runAsync('openNet();createOnlineRoom()');await guest.game.runAsync(`openNet();$('room-input').value='ABCD2345';joinOnlineRoom()`);const hw=host.sockets[0],gw=guest.sockets[0];hw.open();gw.open();hw.receive({t:'room',state:'ready',role:'host',code:'ABCD2345'});gw.receive({t:'room',state:'ready',role:'guest',code:'ABCD2345'});
    hw.send=data=>gw.receive(JSON.parse(data));gw.send=data=>hw.receive(JSON.parse(data));host.game.run('start(3,123);level4.phase=2;syncLevel4Gates();snap()');assert.equal(guest.game.run('state'),'play');assert.equal(guest.game.run('level4.phase'),2);assert.deepEqual(guest.game.run('dyn.map(d=>d.closed)'),[true,true,false]);
    guest.game.run(`send({t:'i',dx:1,dz:0,phase:false})`);assert.equal(host.game.run('rin.dx'),1);
  });
});
