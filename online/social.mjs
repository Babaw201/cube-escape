import { DurableObject } from 'cloudflare:workers';

const PSEUDO = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;
const ROOM = /^[A-HJ-NP-Z2-9]{8}$/;
const INVITE_MS = 15 * 60 * 1000;
const MAX_FRIENDS = 60;
const MAX_PENDING = 20;
const asName = value => String(value || '').trim();
const key = value => asName(value).toLowerCase();
const response = (data, status = 200, origin = '') => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
};
const error = (msg, status = 400, origin = '') => response({ error: msg }, status, origin);
async function sha(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** One global SQLite-backed Durable Object. Suitable for a small indie game; shard before scaling. */
export class SocialHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE, secret TEXT NOT NULL UNIQUE, created INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS requests(sender TEXT NOT NULL, receiver TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(sender,receiver))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS friends(a TEXT NOT NULL, b TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(a,b))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS blocks(owner TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(owner,target))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS invites(recipient TEXT NOT NULL, sender TEXT NOT NULL, room TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(recipient,sender))');
    // Best single run per player and level. Renames follow the stable user id.
    this.sql.exec('CREATE TABLE IF NOT EXISTS leaderboard_scores(user_id TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, won INTEGER NOT NULL, mode TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id,level))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS leaderboard_best ON leaderboard_scores(level,score DESC,created ASC)');
  }
  one(query, ...args) { return this.sql.exec(query, ...args).toArray()[0] || null; }
  rows(query, ...args) { return this.sql.exec(query, ...args).toArray(); }
  count(query, ...args) { return Number(this.one(query, ...args)?.n || 0); }
  byName(name) { return this.one('SELECT id,pseudo FROM users WHERE pseudo=? COLLATE NOCASE', asName(name)); }
  pair(a,b) { return a < b ? [a,b] : [b,a]; }
  isFriend(a,b) { const [x,y]=this.pair(a,b); return !!this.one('SELECT 1 AS yes FROM friends WHERE a=? AND b=?',x,y); }
  blocked(a,b) { return !!this.one('SELECT 1 AS yes FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)',a,b,b,a); }
  auth(request) {
    const header=request.headers.get('Authorization') || '';
    // Authenticated callers use Bearer token; accept only random UUID pairs issued by this service.
    return /^Bearer [0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(header) ? header.slice(7) : null;
  }
  async fetch(request) {
    const origin=request.headers.get('Origin') || '';
    const path=new URL(request.url).pathname, method=request.method;
    if (method!=='GET' && method!=='POST') return error('Méthode non autorisée.',405,origin);
    if (method==='POST' && Number(request.headers.get('Content-Length') || 0) > 2048) return error('Requête trop grande.',413,origin);
    let body={};
    if (method==='POST') {
      try { body=await request.json(); if (!body || typeof body!=='object' || Array.isArray(body)) throw Error(); }
      catch { return error('JSON invalide.',400,origin); }
    }
    if(path==='/social/leaderboard' && method==='GET'){
      const scope=new URL(request.url).searchParams.get('level')||'all';
      if(scope!=='all'&&!/^[1-4]$/.test(scope))return error('Niveau inconnu.',400,origin);
      let top,totalPlayers;
      if(scope==='all'){
        top=this.rows('SELECT pseudo,score,level,mode,won,created FROM (SELECT u.pseudo AS pseudo,s.score AS score,s.level AS level,s.mode AS mode,s.won AS won,s.created AS created, ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.score DESC,s.created ASC) AS rn FROM leaderboard_scores s JOIN users u ON u.id=s.user_id) WHERE rn=1 ORDER BY score DESC,created ASC,pseudo COLLATE NOCASE LIMIT 10');
        totalPlayers=this.count('SELECT count(DISTINCT user_id) AS n FROM leaderboard_scores');
      }else{
        const level=Number(scope);
        top=this.rows('SELECT u.pseudo,s.score,s.level,s.mode,s.won,s.created FROM leaderboard_scores s JOIN users u ON u.id=s.user_id WHERE s.level=? ORDER BY s.score DESC,s.created ASC,u.pseudo COLLATE NOCASE LIMIT 10',level);
        totalPlayers=this.count('SELECT count(*) AS n FROM leaderboard_scores WHERE level=?',level);
      }
      return response({level:scope,totalPlayers,top:top.map(r=>({pseudo:r.pseudo,score:r.score,level:r.level,mode:r.mode,won:!!r.won,created:r.created}))},200,origin);
    }
    if (path==='/social/register' && method==='POST') {
      const pseudo=asName(body.pseudo);
      if (!PSEUDO.test(pseudo)) return error('Pseudo : 3 à 16 caractères, commence par une lettre, puis lettres/chiffres/_ seulement.',400,origin);
      if (this.byName(pseudo)) return error('Ce pseudo est déjà pris.',409,origin);
      const id=crypto.randomUUID(), token=crypto.randomUUID()+'.'+crypto.randomUUID();
      // We deliberately do not collect emails, passwords, real names, or personal details.
      try { this.sql.exec('INSERT INTO users (id,pseudo,secret,created) VALUES(?,?,?,?)',id,pseudo,await sha(token),Date.now()); }
      catch { return error('Ce pseudo est déjà pris. Réessaie.',409,origin); }
      return response({pseudo,token},201,origin);
    }
    const token=this.auth(request);
    if (!token) return error('Profil non connecté sur cet appareil.',401,origin);
    const user=this.one('SELECT id,pseudo FROM users WHERE secret=?',await sha(token));
    if (!user) return error('Profil invalide. Vérifie ta connexion.',401,origin);
    if(path==='/social/score' && method==='POST'){
      const level=Number(body.level),score=Number(body.score),crystals=Number(body.crystals),
        remaining=Number(body.remaining),seconds=Number(body.seconds);
      const won=body.won,mode=body.mode;
      const durations=[90,90,120,240];
      if(!Number.isInteger(level)||level<1||level>4||
        !Number.isInteger(score)||score<0||
        !Number.isInteger(crystals)||crystals<0||crystals>3||
        !Number.isFinite(remaining)||remaining<0||remaining>durations[level-1]||
        !Number.isFinite(seconds)||seconds<0||seconds>3600||
        typeof won!=='boolean'||!['Solo','Coop locale','En ligne'].includes(mode)||
        (won&&crystals!==3)||
        score!==(crystals*100+(won?Math.ceil(remaining)*10:0)))
        return error('Score incohérent ou non pris en charge.',400,origin);
      const old=this.one('SELECT score FROM leaderboard_scores WHERE user_id=? AND level=?',user.id,level);
      if(old && Number(old.score)>=score)return response({ok:true,improved:false},200,origin);
      this.sql.exec('INSERT INTO leaderboard_scores(user_id,level,score,won,mode,created) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,level) DO UPDATE SET score=excluded.score,won=excluded.won,mode=excluded.mode,created=excluded.created WHERE excluded.score>leaderboard_scores.score',user.id,level,score,won?1:0,mode,Date.now());
      return response({ok:true,improved:true},200,origin);
    }
    if (path==='/social/me' && method==='GET') {
      this.sql.exec('DELETE FROM invites WHERE created<?',Date.now()-INVITE_MS);
      const friends=this.rows('SELECT u.pseudo FROM friends f JOIN users u ON u.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=? ORDER BY u.pseudo COLLATE NOCASE',user.id,user.id,user.id).map(r=>r.pseudo);
      const incoming=this.rows('SELECT u.pseudo FROM requests r JOIN users u ON u.id=r.sender WHERE r.receiver=? ORDER BY r.created DESC LIMIT 30',user.id).map(r=>r.pseudo);
      const outgoing=this.rows('SELECT u.pseudo FROM requests r JOIN users u ON u.id=r.receiver WHERE r.sender=? ORDER BY r.created DESC LIMIT 30',user.id).map(r=>r.pseudo);
      const invites=this.rows('SELECT u.pseudo,i.room FROM invites i JOIN users u ON u.id=i.sender WHERE i.recipient=? ORDER BY i.created DESC LIMIT 30',user.id);
      const blocked=this.rows('SELECT u.pseudo FROM blocks b JOIN users u ON u.id=b.target WHERE b.owner=? ORDER BY u.pseudo COLLATE NOCASE',user.id).map(r=>r.pseudo);
      return response({pseudo:user.pseudo,friends,incoming,outgoing,invites,blocked},200,origin);
    }
    if(method!=='POST') return error('Requête inconnue.',404,origin);
    if (path==='/social/rename') {
      const pseudo=asName(body.pseudo);
      if (!PSEUDO.test(pseudo)) return error('Pseudo invalide : 3 à 16 caractères.',400,origin);
      if (key(pseudo)===key(user.pseudo)) return response({pseudo:user.pseudo},200,origin);
      if (this.byName(pseudo)) return error('Ce pseudo est déjà pris.',409,origin);
      try {this.sql.exec('UPDATE users SET pseudo=? WHERE id=?',pseudo,user.id);}
      catch {return error('Ce pseudo est déjà pris.',409,origin);}
      return response({pseudo},200,origin);
    }
    const name=asName(body.pseudo);
    if (!PSEUDO.test(name)) return error('Saisis un pseudo valide.',400,origin);
    const other=this.byName(name);
    if (!other) return error('Aucun joueur avec ce pseudo exact.',404,origin);
    if (other.id===user.id) return error('Tu ne peux pas t’ajouter toi-même.',400,origin);
    if (path==='/social/request') {
      if (this.blocked(user.id,other.id)) return error('Demande impossible.',403,origin);
      if (this.isFriend(user.id,other.id)) return error('Vous êtes déjà amis.',409,origin);
      if (this.one('SELECT 1 AS yes FROM requests WHERE sender=? AND receiver=?',other.id,user.id)) return error('Cette personne t’a déjà envoyé une demande : accepte-la depuis ton profil.',409,origin);
      if (this.one('SELECT 1 AS yes FROM requests WHERE sender=? AND receiver=?',user.id,other.id)) return error('Demande déjà envoyée.',409,origin);
      if (this.count('SELECT count(*) AS n FROM requests WHERE sender=?',user.id)>=MAX_PENDING) return error('Trop de demandes en attente.',429,origin);
      if (this.count('SELECT count(*) AS n FROM requests WHERE receiver=?',other.id)>=MAX_PENDING) return error('Cette personne reçoit trop de demandes.',429,origin);
      this.sql.exec('INSERT INTO requests(sender,receiver,created) VALUES(?,?,?)',user.id,other.id,Date.now());
      return response({ok:true},201,origin);
    }
    if (path==='/social/respond') {
      if (!this.one('SELECT 1 AS yes FROM requests WHERE sender=? AND receiver=?',other.id,user.id)) return error('Demande introuvable.',404,origin);
      this.sql.exec('DELETE FROM requests WHERE sender=? AND receiver=?',other.id,user.id);
      if (body.accept===true && !this.blocked(user.id,other.id)) {
        if (this.count('SELECT count(*) AS n FROM friends WHERE a=? OR b=?',user.id,user.id)>=MAX_FRIENDS || this.count('SELECT count(*) AS n FROM friends WHERE a=? OR b=?',other.id,other.id)>=MAX_FRIENDS) return error('Limite de 60 amis atteinte.',409,origin);
        const [a,b]=this.pair(user.id,other.id);
        this.sql.exec('INSERT OR IGNORE INTO friends(a,b,created) VALUES(?,?,?)',a,b,Date.now());
        return response({ok:true,accepted:true},200,origin);
      }
      return response({ok:true,accepted:false},200,origin);
    }
    if (path==='/social/cancel') {
      this.sql.exec('DELETE FROM requests WHERE sender=? AND receiver=?',user.id,other.id);
      return response({ok:true},200,origin);
    }
    if (path==='/social/remove' || path==='/social/block') {
      const [a,b]=this.pair(user.id,other.id);
      this.sql.exec('DELETE FROM friends WHERE a=? AND b=?',a,b);
      this.sql.exec('DELETE FROM requests WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',user.id,other.id,other.id,user.id);
      this.sql.exec('DELETE FROM invites WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',user.id,other.id,other.id,user.id);
      if (path==='/social/block') this.sql.exec('INSERT OR IGNORE INTO blocks(owner,target) VALUES(?,?)',user.id,other.id);
      return response({ok:true},200,origin);
    }
    if (path==='/social/unblock') {
      this.sql.exec('DELETE FROM blocks WHERE owner=? AND target=?',user.id,other.id);
      return response({ok:true},200,origin);
    }
    if (path==='/social/invite') {
      if (!this.isFriend(user.id,other.id) || this.blocked(user.id,other.id)) return error('Invitation réservée aux amis.',403,origin);
      const room=String(body.room||'').toUpperCase();
      if(!ROOM.test(room)) return error('Code de salon invalide.',400,origin);
      // Invitations expire after 15 minutes and are visible only to their recipient.
      this.sql.exec('INSERT OR REPLACE INTO invites(recipient,sender,room,created) VALUES(?,?,?,?)',other.id,user.id,room,Date.now());
      return response({ok:true},201,origin);
    }
    return error('Requête inconnue.',404,origin);
  }
}
