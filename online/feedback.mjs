import { DurableObject } from 'cloudflare:workers';

// Isolated global inbox: responses contain no player ID, email address or IP.
const TYPES=new Set(['bug','idea','poll']);
const TOPICS=new Set(['niveau5','murs','ennemis','cooperation','autre']);
const json=(value,status=200,origin='')=>new Response(JSON.stringify(value),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{})}
});
async function hasAdminAccess(request,secret){
  const header=request.headers.get('Authorization')||'';
  if(!secret || !/^Bearer [\w-]{20,120}$/.test(header))return false;
  const supplied=new TextEncoder().encode(header.slice(7)),expected=new TextEncoder().encode(secret);
  if(supplied.length!==expected.length)return false;
  return crypto.subtle.timingSafeEqual(supplied,expected);
}
export class FeedbackInbox extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, topic TEXT NOT NULL, message TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)');
  }
  async fetch(request){
    const path=new URL(request.url).pathname,origin=request.headers.get('Origin')||'';
    if(path==='/feedback' && request.method==='POST'){
      if(Number(request.headers.get('Content-Length')||0)>4000)return json({error:'Message trop long.'},413,origin);
      let data;
      try{data=await request.json();}catch{return json({error:'Formulaire invalide.'},400,origin);}
      if(!data||typeof data!=='object')return json({error:'Formulaire invalide.'},400,origin);
      const kind=String(data.kind||''),topic=String(data.topic||''),
        message=typeof data.message==='string'?data.message.trim():'';
      if(!TYPES.has(kind)||!TOPICS.has(topic)||message.length>1200||
        (kind==='poll' ? message.length>300 : message.length<10))
        return json({error:'Choisis une catégorie et écris un commentaire de 10 à 1 200 caractères.'},400,origin);
      const now=Date.now();
      this.sql.exec('INSERT INTO feedback(kind,topic,message,created) VALUES(?,?,?,?)',kind,topic,message,now);
      return json({ok:true},201,origin);
    }
    if(path==='/feedback/admin'&&request.method==='GET'){
      if(!await hasAdminAccess(request,this.env.FEEDBACK_ADMIN_KEY))
        return json({error:'Code administrateur incorrect.'},401,origin);
      const entries=this.sql.exec('SELECT id,kind,topic,message,created,seen FROM feedback ORDER BY id DESC LIMIT 500').toArray();
      const unread=this.sql.exec('SELECT count(*) AS n FROM feedback WHERE seen=0').toArray()[0]?.n||0;
      return json({entries,unread},200,origin);
    }
    if(path==='/feedback/read'&&request.method==='POST'){
      if(!await hasAdminAccess(request,this.env.FEEDBACK_ADMIN_KEY))
        return json({error:'Code administrateur incorrect.'},401,origin);
      this.sql.exec('UPDATE feedback SET seen=1 WHERE seen=0');
      return json({ok:true},200,origin);
    }
    return json({error:'Route inconnue.'},404,origin);
  }
}
