import { SocialHub } from './social.mjs';
export { SocialHub };
import { DurableObject } from 'cloudflare:workers';

const CODE=/^[A-HJ-NP-Z2-9]{8}$/;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const WAIT_MS=15*60*1000, SESSION_MS=2*60*60*1000;
const ALLOWED=new Set(['https://babaw201.github.io','https://limbyrinth-prive.baptiste-werner.workers.dev','null']);
const HOST_TYPES=new Set(['start','s','end','cosmetic']);
const GUEST_TYPES=new Set(['i','cosmetic']);
function code(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>ALPHABET[n&31]).join('');}
async function hash(value){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));}
function hex(buffer){return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');}
async function tokenMatches(token,expected){const actual=await hash(token),bytes=Uint8Array.from(expected.match(/../g)||[],n=>parseInt(n,16));return bytes.length===32&&crypto.subtle.timingSafeEqual(actual,bytes);}
function json(data,status=200,origin=null){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};if(origin)headers['Access-Control-Allow-Origin']=origin;return new Response(JSON.stringify(data),{status,headers});}

export class GameRoom extends DurableObject {
  constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), code TEXT NOT NULL, host_hash TEXT NOT NULL, expires INTEGER NOT NULL, joined INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0)');ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
  row(){return this.ctx.storage.sql.exec('SELECT * FROM room WHERE id=1').toArray()[0]||null;}
  sockets(role){return this.ctx.getWebSockets(role).filter(ws=>ws.readyState===1);}
  async create(roomCode){
    if(this.row())return null;
    const hostToken=crypto.randomUUID(),hostHash=hex(await hash(hostToken)),expires=Date.now()+WAIT_MS;
    // A hash await can allow another creation; INSERT OR IGNORE decides atomically.
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO room(id,code,host_hash,expires) VALUES(1,?,?,?)',roomCode,hostHash,expires);
    if(this.row().host_hash!==hostHash)return null;
    await this.ctx.storage.setAlarm(expires);
    return {code:roomCode,hostToken,expires};
  }
  describe(){const r=this.row();if(!r)return {state:'missing'};if(r.closed||r.expires<=Date.now())return{state:'closed'};const players=this.sockets().length;return{code:r.code,state:players>=2?'full':'waiting',hostReady:this.sockets('host').length===1,players,expires:r.expires};}
  async fetch(request){
    const first=this.row();if(!first)return json({error:'Salon introuvable.'},404);
    if(first.closed||first.expires<=Date.now())return json({error:'Salon fermé ou expiré. Crée un nouveau salon.'},410);
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'Connexion WebSocket requise.'},426);
    const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(v=>v.trim());
    if(!protocols.includes('limbyrinth-v1'))return json({error:'Version de connexion incompatible.'},400);
    const hostProtocol=protocols.find(v=>v.startsWith('host.')),role=hostProtocol?'host':'guest';
    if(hostProtocol&&!await tokenMatches(hostProtocol.slice(5),first.host_hash))return json({error:'Accès hôte refusé.'},403);
    // Recheck after asynchronous authentication before claiming a player slot.
    const r=this.row();if(!r||r.closed||r.expires<=Date.now())return json({error:'Salon fermé ou expiré.'},410);
    if(this.sockets(role).length)return json({error:'Salon complet.'},409);
    if(role==='guest'&&!this.sockets('host').length)return json({error:'L’hôte prépare encore le salon.'},409);
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.ctx.acceptWebSocket(server,[role]);server.serializeAttachment({role,window:Date.now(),count:0});
    if(role==='host')server.send(JSON.stringify({t:'room',state:'waiting',code:r.code,expires:r.expires}));
    else{
      const expires=Date.now()+SESSION_MS;this.ctx.storage.sql.exec('UPDATE room SET joined=1, expires=? WHERE id=1',expires);await this.ctx.storage.setAlarm(expires);
      if(this.row()?.closed||this.sockets().length!==2)this.closeRoom('Un joueur a quitté le salon.');
      else for(const peer of this.sockets()){const {role:peerRole}=peer.deserializeAttachment();peer.send(JSON.stringify({t:'room',state:'ready',role:peerRole,code:r.code}));}
    }
    return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'limbyrinth-v1'}});
  }
  closeRoom(reason,closeCode=1000){
    this.ctx.storage.sql.exec('UPDATE room SET closed=1 WHERE id=1');
    for(const socket of this.sockets())try{socket.send(JSON.stringify({t:'room',state:'closed',message:reason}));socket.close(closeCode,reason);}catch{}
  }
  webSocketMessage(ws,message){
    const r=this.row();if(!r||r.closed||r.expires<=Date.now()){this.closeRoom('Salon fermé ou expiré.');return;}
    if(message==='ping'){ws.send('pong');return;}
    const attachment=ws.deserializeAttachment();
    if(!attachment||typeof message!=='string'||message.length>65536){this.closeRoom('Message invalide.',1008);return;}
    const now=Date.now();if(now-attachment.window>=1000){attachment.window=now;attachment.count=0;}
    if(++attachment.count>120){this.closeRoom('Trop de messages.',1008);return;}ws.serializeAttachment(attachment);
    let data;try{data=JSON.parse(message);}catch{this.closeRoom('Message invalide.',1008);return;}
    const allowed=attachment.role==='host'?HOST_TYPES:GUEST_TYPES;
    if(!data||typeof data!=='object'||!allowed.has(data.t)){this.closeRoom('Message non autorisé.',1008);return;}
    if(!r.joined)return;
    if(data.t==='i'&&(!Number.isFinite(data.dx)||!Number.isFinite(data.dz)||data.f!=null&&(!Array.isArray(data.f)||data.f.length!==2||!data.f.every(Number.isFinite)))){this.closeRoom('Commandes invalides.',1008);return;}
    for(const other of this.sockets())if(other!==ws)try{other.send(message);}catch{this.closeRoom('Connexion interrompue.');}
  }
  webSocketClose(ws,code,reason){try{ws.close(code===1005?1000:code,reason);}catch{}if(this.row()&&!this.row().closed)this.closeRoom('Ton ami a quitté le salon.');}
  webSocketError(){if(this.row()&&!this.row().closed)this.closeRoom('Connexion interrompue.');}
  async alarm(){const r=this.row();if(!r)return;if(r.expires>Date.now()&&!r.closed){await this.ctx.storage.setAlarm(r.expires);return;}this.closeRoom('Salon expiré.');this.ctx.storage.sql.exec('DELETE FROM room');}
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const allowed=!origin||ALLOWED.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if(!allowed)return json({error:'Origine non autorisée.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
    if(url.pathname==='/'&&request.method==='GET')return json({service:'limbyrinth-online',version:1},200,origin);
    if(url.pathname.startsWith('/social/')){
      // Same trusted origins and limits as the multiplayer service.
      if(request.method==='POST'){
        const identity=request.headers.get('Authorization')||'';
        const action=url.pathname==='/social/register'?'register':url.pathname;
        const fingerprint=action==='register'?(request.headers.get('CF-Connecting-IP')||'unknown'):identity.slice(0,48);
        const limit=await env.ROOM_LIMIT.limit({key:'social:'+action+':'+fingerprint});
        if(!limit.success)return json({error:'Trop de demandes. Réessaie dans une minute.'},429,origin);
      }
      return env.SOCIAL.getByName('limbyrinth-social-global').fetch(request);
    }
    if(request.method==='POST'&&url.pathname==='/rooms'){
      const limit=await env.ROOM_LIMIT.limit({key:'create:'+(request.headers.get('CF-Connecting-IP')||'unknown')});
      if(!limit.success)return json({error:'Trop de salons créés. Réessaie dans une minute.'},429,origin);
      for(let attempt=0;attempt<3;attempt++){const name=code(),created=await env.ROOMS.getByName(name).create(name);if(created)return json(created,201,origin);}
      return json({error:'Création indisponible. Réessaie.'},503,origin);
    }
    const match=url.pathname.match(/^\/rooms\/([^/]+)(\/socket)?$/);
    if(!match||request.method!=='GET')return json({error:'Requête inconnue.'},404,origin);
    const roomCode=match[1].toUpperCase();if(!CODE.test(roomCode))return json({error:'Le code doit contenir 8 caractères.'},400,origin);
    const limit=await env.ROOM_LIMIT.limit({key:'join:'+(request.headers.get('CF-Connecting-IP')||'unknown')});
    if(!limit.success)return json({error:'Trop de tentatives. Réessaie dans une minute.'},429,origin);
    const room=env.ROOMS.getByName(roomCode);
    if(match[2])return room.fetch(request);
    const info=await room.describe();return json(info.state==='missing'?{error:'Salon introuvable. Vérifie le code.'}:info.state==='closed'?{error:'Salon fermé ou expiré. Demande un nouveau code.'}:info,info.state==='missing'?404:info.state==='closed'?410:200,origin);
  }
};
