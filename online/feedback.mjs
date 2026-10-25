import { DurableObject } from 'cloudflare:workers';

// Isolated global inbox: responses contain no player ID, email address or IP.
const TYPES=new Set(['bug','idea','poll']);
const TOPICS=new Set(['niveau5','murs','ennemis','cooperation','autre']);
const TOPIC_LABELS={niveau5:'Niveau 5 / niveaux',murs:'Murs et graphismes',ennemis:'Drones et ennemis',cooperation:'Coopération en ligne',autre:'Autre'};
const ADMIN_INBOX='https://babaw201.github.io/cube-escape/retours-admin.html';
// Only HTTPS Discord webhook destinations are permitted; the URL comes from a Cloudflare secret.
function discordWebhook(raw){
  if(typeof raw!=='string')return null;
  try{
    const url=new URL(raw);
    if(url.protocol==='https:'&&url.hostname==='discord.com'&&!url.username&&!url.password&&
      !url.search&&!url.hash&&/^\/api\/webhooks\/\d{15,22}\/[\w.-]{20,}$/.test(url.pathname))
      return url.toString();
  }catch{}
  return null;
}

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
    this.sql.exec('CREATE TABLE IF NOT EXISTS bug_alerts(id INTEGER PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, next_try INTEGER NOT NULL)');
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
      if(kind==='bug'){
        const id=Number(this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0]?.id);
        this.sql.exec('INSERT OR IGNORE INTO bug_alerts(id,next_try) VALUES(?,?)',id,now);
        // Keep the bug report even if Discord is unreachable or not configured.
        if(discordWebhook(this.env.FEEDBACK_DISCORD_WEBHOOK_URL))await this.deliverAlerts();
      }
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
  async deliverAlerts(){
    const webhook=discordWebhook(this.env.FEEDBACK_DISCORD_WEBHOOK_URL);
    if(!webhook||this.sendingAlerts)return;
    this.sendingAlerts=true;
    try{
      const now=Date.now();
      const pending=this.sql.exec(
        'SELECT a.id,a.attempts,f.topic,f.message,f.created FROM bug_alerts a JOIN feedback f ON f.id=a.id WHERE a.next_try<=? AND a.attempts<5 ORDER BY a.id LIMIT 5',now
      ).toArray();
      for(const bug of pending){
        const content=[
          '🐛 **Nouveau bug signalé dans Limbyrinth**',
          '**Sujet :** '+(TOPIC_LABELS[bug.topic]||'Autre'),
          '**Détail :** '+String(bug.message||'').slice(0,800),
          '**Voir les retours :** '+ADMIN_INBOX
        ].join('\n');
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
        let delivered=false;
        try{
          const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username:'Limbyrinth · Bugs',content,allowed_mentions:{parse:[]}}),
            signal:controller.signal});
          delivered=response.ok;
        }catch{
          // Discord failures must never erase the user's saved bug report.
        }finally{clearTimeout(timer);}
        if(delivered)this.sql.exec('DELETE FROM bug_alerts WHERE id=?',bug.id);
        else{
          const attempts=Number(bug.attempts)+1;
          const delay=Math.min(60*60*1000,60*1000*Math.pow(2,attempts-1));
          this.sql.exec('UPDATE bug_alerts SET attempts=?,next_try=? WHERE id=?',attempts,Date.now()+delay,bug.id);
        }
      }
      const next=this.sql.exec('SELECT MIN(next_try) AS due FROM bug_alerts WHERE attempts<5').toArray()[0]?.due;
      if(next!=null)await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,Number(next)));
    }finally{this.sendingAlerts=false;}
  }
  async alarm(){await this.deliverAlerts();}
}
