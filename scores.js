/* Limbyrinth — tableau des scores local. Aucun compte ni serveur requis. */
(function () {
  "use strict";
  const KEY = "limbyrinthScoresV1";
  const WORLD_BASE="https://limbyrinth-online.baptiste-werner.workers.dev";
  const TOKEN_KEY="limbyrinthSocialTokenV1";
  const PENDING_KEY="limbyrinthLeaderboardPendingV1";
  let onlineLevel="all",onlineRequest=0,sending=false,uploadMessage="";
  function getToken(){try{return localStorage.getItem(TOKEN_KEY)||"";}catch{return "";}}
  function getPending(){
    try{const val=JSON.parse(localStorage.getItem(PENDING_KEY)||"{}");return val&&typeof val==="object"&&!Array.isArray(val)?val:{};}
    catch{return {};}
  }
  // Only freshly completed runs on a signed-in browser are eligible. Old local saves are never imported.
  function queueOnline(data){
    if(!getToken())return;
    const payload={
      level:data.level,score:data.score,won:data.won,mode:data.mode,
      seconds:data.seconds,remaining:data.remaining,crystals:data.crystals
    };
    try{
      const pending=getPending(),prev=pending[String(data.level)];
      if(!prev||prev.score<payload.score){pending[String(data.level)]=payload;localStorage.setItem(PENDING_KEY,JSON.stringify(pending));}
    }catch{return;}
    void flushOnline();
  }
  async function flushOnline(){
    const token=getToken();
    if(!token||sending)return;
    sending=true;
    try{
      const pending=getPending();
      for(const [key,entry] of Object.entries(pending)){
        let res;
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
        try{
          res=await fetch(WORLD_BASE+"/social/score",{
            method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
            body:JSON.stringify(entry),signal:controller.signal,cache:"no-store"
          });
        }catch{uploadMessage="Synchronisation impossible. Réessaie depuis Scores avec une connexion Internet.";break;}
        finally{clearTimeout(timer);}
        if(res.status===401){uploadMessage="Profil non connecté. Ouvre Amis & pseudo.";break;}
        if(!res.ok&&res.status!==400){uploadMessage="Classement indisponible. La partie est conservée sur cet appareil.";break;}
        const current=getPending();
        if(current[key]&&JSON.stringify(current[key])===JSON.stringify(entry)){
          delete current[key];try{localStorage.setItem(PENDING_KEY,JSON.stringify(current));}catch{}
        }
        uploadMessage=res.status===400?"Résultat non accepté par le classement (score à vérifier).":"";
      }
    }finally{sending=false;}
  }

  let lastError = "";
  let filterLevel = "all", filterMode = "all", order = "recent";

  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(data)) return [];
      return data.filter(r => r && r.level >= 1 && r.level <= 4 && Number.isFinite(r.score))
        .map(r => ({
          level: Math.floor(r.level), score: Math.max(0, Math.floor(r.score)),
          won: !!r.won, mode: ["Solo", "Coop locale", "En ligne"].includes(r.mode) ? r.mode : "Solo",
          seconds: Math.max(0, Math.floor(Number(r.seconds) || 0)),
          remaining: Math.max(0, Math.floor(Number(r.remaining) || 0)),
          crystals: Math.max(0, Math.floor(Number(r.crystals) || 0)),
          kills: Math.max(0, Math.floor(Number(r.kills) || 0)),
          date: typeof r.date === "string" && Number.isFinite(Date.parse(r.date)) ? r.date : ""
        }));
    } catch (error) { return []; }
  }

  function record(data) {
    if (!data || !Number.isFinite(data.score) || data.level < 1 || data.level > 4) return false;
    const entry = {
      level: Math.floor(data.level), score: Math.max(0, Math.floor(data.score)),
      won: !!data.won,
      mode: ["Solo", "Coop locale", "En ligne"].includes(data.mode) ? data.mode : "Solo",
      seconds: Math.max(0, Math.floor(Number(data.seconds) || 0)),
      remaining: Math.max(0, Math.floor(Number(data.remaining) || 0)),
      crystals: Math.max(0, Math.floor(Number(data.crystals) || 0)),
      kills: Math.max(0, Math.floor(Number(data.kills) || 0)),
      date: new Date().toISOString()
    };
    try {
      const history = read();
      history.push(entry);
      localStorage.setItem(KEY, JSON.stringify(history));
      lastError = "";
      queueOnline(data);
      return true;
    } catch (error) {
      lastError = "Impossible d’enregistrer le score : espace de stockage du navigateur insuffisant ou désactivé.";
      return false;
    }
  }

  const $ = id => document.getElementById(id);
  const el = (tag, cls, label) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (label !== undefined) node.textContent = label;
    return node;
  };
  const button = (label, onClick, cls) => {
    const b = el("button", cls || "scores-btn", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  };
  const num = n => Number(n).toLocaleString("fr-FR");
  const dateText = iso => {
    if (!iso) return "Date inconnue";
    try { return new Date(iso).toLocaleString("fr-FR", {dateStyle: "short", timeStyle: "short"}); }
    catch (error) { return "Date inconnue"; }
  };
  const levelNames = ["Labyrinthe", "Zone instable", "Le Noyau", "Labyrinthe instable"];

  const style = el("style");
  style.textContent = [
    "#scores-screen[hidden]{display:none!important}",
    "#scores-screen{position:fixed;inset:0;z-index:30;overflow:auto;background:radial-gradient(ellipse at 18% 0%,#17405a 0,#081421 48%,#04070d 100%);color:#e6f4ff;font-family:'Trebuchet MS','Segoe UI',system-ui,sans-serif;box-sizing:border-box}",
    "#scores-screen *{box-sizing:border-box}",
    ".scores-wrap{width:min(1100px,100%);margin:0 auto;padding:calc(22px + env(safe-area-inset-top,0px)) 18px calc(40px + env(safe-area-inset-bottom,0px))}",
    ".scores-top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:22px}",
    ".scores-title{margin:0;color:#8ff3ff;font-size:clamp(30px,5vw,55px);letter-spacing:.08em}",
    ".scores-caption{color:#a2bfd1;font-size:14px;margin:5px 0 0;line-height:1.5}",
    ".scores-btn{margin:0;padding:11px 18px;border:1px solid #416983;border-radius:11px;background:#19364d;color:#e6f4ff;font:700 14px system-ui,sans-serif;box-shadow:none;cursor:pointer}",
    ".scores-btn:hover,.scores-btn:focus-visible{outline:2px solid #8ff3ff;outline-offset:2px;background:#235471;transform:none}",
    ".scores-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}",
    ".scores-stat,.scores-card{background:rgba(9,27,43,.87);border:1px solid #31556e;border-radius:15px;padding:16px}",
    ".scores-stat small{display:block;font-size:11px;letter-spacing:.12em;color:#9bb9cc;text-transform:uppercase}",
    ".scores-stat b{display:block;font-size:clamp(20px,3vw,30px);margin-top:7px;color:#8ff3ff}",
    ".scores-section{margin:22px 0 10px;font-size:15px;letter-spacing:.1em;color:#cee6fa;text-transform:uppercase}",
    ".scores-levels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
    ".scores-level{border-left:3px solid #65e7ff}",
    ".scores-level h3{font-size:14px;margin:0 0 10px;color:#c6eafa}",
    ".scores-level strong{font-size:23px;color:#fff}",
    ".scores-level p{color:#91b1c4;font-size:12px;margin:8px 0 0}",
    ".scores-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0}",
    ".scores-controls label{font-size:13px;color:#9bb9cc}",
    ".scores-controls select{margin-left:6px;background:#132b40;color:#e6f4ff;border:1px solid #416983;border-radius:9px;padding:10px;font-size:13px;max-width:200px}",
    ".scores-scroll{overflow:auto;border:1px solid #31556e;border-radius:14px;background:rgba(9,27,43,.87)}",
    ".scores-table{width:100%;border-collapse:collapse;min-width:650px;font-size:13px}",
    ".scores-table th,.scores-table td{text-align:left;padding:12px 11px;border-bottom:1px solid #223f55;white-space:nowrap}",
    ".scores-table th{color:#92b9d4;text-transform:uppercase;font-size:11px;letter-spacing:.07em}",
    ".scores-table tr:last-child td{border-bottom:0}",
    ".scores-win{color:#7dffb8;font-weight:700}.scores-loss{color:#ff96a8;font-weight:700}",
    ".scores-empty{padding:32px 18px;text-align:center;color:#a6bfd2;line-height:1.5}",
    ".scores-small{color:#94afc0;font-size:12px;line-height:1.6}",
    ".scores-error{color:#ffb8bf;font-size:13px}",
    ".scores-online{border-color:#49819a;margin:20px 0;background:linear-gradient(145deg,rgba(12,43,67,.94),rgba(9,26,42,.94))}",
    ".scores-online h2{margin:0 0 6px;font-size:21px;color:#8ff3ff}",
    ".scores-online-table{width:100%;border-collapse:collapse;font-size:13px}",
    ".scores-online-table td,.scores-online-table th{padding:11px 9px;border-bottom:1px solid #264a5d;text-align:left}",
    ".scores-online-table th{color:#a5cce1;font-size:11px;text-transform:uppercase}",
    ".scores-online-table tr:first-child td{font-weight:700;color:#ffe3a2}",
    ".scores-online-table tr:last-child td{border-bottom:0}",
    ".scores-online-table td:nth-child(2){font-weight:700;overflow-wrap:anywhere}",
    ".scores-online-table td:nth-child(3){font-weight:700;font-variant-numeric:tabular-nums}",
    ".scores-online-table tbody tr:nth-child(even){background:rgba(255,255,255,.025)}",

    "@media(max-width:720px){.scores-stats,.scores-levels{grid-template-columns:repeat(2,minmax(0,1fr))}.scores-wrap{padding-left:12px;padding-right:12px}.scores-controls{align-items:flex-start}}",
    "@media(max-width:360px){.scores-stats,.scores-levels{grid-template-columns:1fr}}"
  ].join("\n");
  document.head.appendChild(style);

  const screen = el("section");
  screen.id = "scores-screen";
  screen.hidden = true;
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-label", "Tous les scores de Limbyrinth");
  document.body.appendChild(screen);
  let returnFocus = null;

  function close() {
    screen.hidden = true;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
  }

  function stat(title, value) {
    const c = el("div", "scores-stat");
    c.append(el("small", "", title), el("b", "", value));
    return c;
  }

  function select(label, options, value, onChange) {
    const holder = el("label", "", label);
    const control = el("select");
    options.forEach(([v, text]) => {
      const opt = el("option", "", text); opt.value = v; control.appendChild(opt);
    });
    control.value = value;
    control.addEventListener("change", () => onChange(control.value));
    holder.appendChild(control);
    return holder;
  }

  function csvExport() {
    const rows = read();
    const header = ["Date","Niveau","Score","Résultat","Mode","Durée (s)","Temps restant (s)","Cristaux","Drones"];
    const cells = rows.map(r => [r.date,r.level,r.score,r.won ? "Victoire":"Défaite",r.mode,r.seconds,r.remaining,r.crystals,r.kills]);
    const safe = cell => '"' + String(cell).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g,'""') + '"';
    const csv = "\ufeff" + [header,...cells].map(row => row.map(safe).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a = el("a"); a.href = url; a.download = "limbyrinth-scores.csv"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function render() {
    const all = read();
    const wrap = el("div", "scores-wrap"), top = el("div", "scores-top"), heading = el("div");
    heading.append(el("h1", "scores-title", "SCORES"), el("p", "scores-caption", "Tous tes résultats enregistrés sur cet appareil."));
    const actions = el("div", "scores-controls");
    actions.append(button("← Retour", close), button("Exporter en CSV", csvExport));
    top.append(heading, actions);
    wrap.appendChild(top);
    const stats = el("div", "scores-stats");
    const legacyBest = (() => { try { return Math.max(0, +localStorage.getItem("cubeEscapeBest") || 0); } catch(error){ return 0; } })();
    const best = Math.max(legacyBest, 0, ...all.map(r=>r.score));
    stats.append(
      stat("Parties enregistrées", num(all.length)),
      stat("Victoires", num(all.filter(r=>r.won).length)),
      stat("Meilleur score", num(best)),
      stat("Points cumulés", num(all.reduce((a,r)=>a+r.score,0)))
    );
    wrap.appendChild(stats);

    const global=el("section","scores-card scores-online");
    global.append(el("h2","","🏆 TOP 10 MONDIAL"),el("p","scores-small","Meilleur score d’une seule partie par joueur. Classement partagé sur Internet · joueurs avec pseudo."));
    const globals=el("div","scores-controls"),output=el("div","scores-scroll");
    globals.append(
      select("Classement ",[["all","Tous les niveaux"],...levelNames.map((n,i)=>[String(i+1),"Niveau "+(i+1)])],onlineLevel,v=>{onlineLevel=v;void loadLeaderboard(output,v);}),
      button("↻ Actualiser",()=>{void flushOnline().then(()=>loadLeaderboard(output,onlineLevel));},"scores-btn")
    );
    global.append(globals,output);
    if(!getToken())global.appendChild(el("p","scores-small","Pour apparaître ici, crée d’abord ton pseudo dans 👥 Amis & pseudo, puis termine une nouvelle partie."));
    global.appendChild(el("p","scores-small","Classement communautaire en bêta : les scores proviennent des jeux des participants et ne sont pas encore vérifiés par un système anti-triche. Les anciens scores locaux ne sont pas importés."));
    wrap.appendChild(global);
    if (legacyBest && !all.some(r=>r.score===legacyBest)) {
      wrap.appendChild(el("p", "scores-small", "Ton ancien record de " + num(legacyBest) + " points a été conservé. Les anciennes parties ne peuvent pas être reconstituées."));
    }
    if (lastError) wrap.appendChild(el("p", "scores-error", lastError));
    wrap.appendChild(el("h2", "scores-section", "Meilleurs scores par niveau"));
    const levels = el("div", "scores-levels");
    levelNames.forEach((name,i) => {
      const matches=all.filter(r=>r.level===i+1);
      const c=el("div", "scores-card scores-level");
      c.append(el("h3","",String(i+1)+". "+name),el("strong","", matches.length ? num(Math.max(...matches.map(r=>r.score))) : "—"),el("p","",matches.length+" partie(s) · "+matches.filter(r=>r.won).length+" victoire(s)"));
      levels.appendChild(c);
    });
    wrap.appendChild(levels);
    wrap.appendChild(el("h2", "scores-section", "Historique des parties"));
    const controls=el("div", "scores-controls");
    controls.append(
      select("Niveau ", [["all","Tous"],...levelNames.map((n,i)=>[String(i+1),String(i+1)+" · "+n])], filterLevel, v=>{filterLevel=v;render();}),
      select("Mode ", [["all","Tous"],["Solo","Solo"],["Coop locale","Coop locale"],["En ligne","En ligne"]], filterMode, v=>{filterMode=v;render();}),
      select("Trier ", [["recent","Plus récents"],["best","Meilleurs scores"]], order, v=>{order=v;render();})
    );
    wrap.appendChild(controls);
    const filtered=all.filter(r=>(filterLevel==="all"||String(r.level)===filterLevel)&&(filterMode==="all"||r.mode===filterMode));
    filtered.sort((a,b)=>order==="best" ? b.score-a.score || Date.parse(b.date||0)-Date.parse(a.date||0) : Date.parse(b.date||0)-Date.parse(a.date||0));
    if (!filtered.length) wrap.appendChild(el("p","scores-empty","Aucun score pour cette sélection. Termine une partie pour enregistrer ton premier résultat."));
    else {
      const scroll=el("div","scores-scroll"), table=el("table","scores-table"), head=el("thead"), row=el("tr");
      ["Date","Niveau","Score","Résultat","Mode","Durée","Cristaux","Drones"].forEach(label=>row.appendChild(el("th","",label)));
      head.appendChild(row); table.appendChild(head);
      const body=el("tbody");
      filtered.forEach(r=>{
        const tr=el("tr");
        [dateText(r.date),String(r.level),num(r.score),r.won?"Victoire":"Défaite",r.mode,r.seconds+" s",r.crystals+"/3",String(r.kills)].forEach((value,i)=>{
          const cell=el("td",i===3?(r.won?"scores-win":"scores-loss"):"",value);
          tr.appendChild(cell);
        });
        body.appendChild(tr);
      });
      table.appendChild(body); scroll.appendChild(table); wrap.appendChild(scroll);
    }
    wrap.appendChild(el("p","scores-small","Historique ci-dessus : local à cet appareil. Seuls les meilleurs résultats des joueurs connectés avec un pseudo peuvent rejoindre le classement mondial."));

    screen.replaceChildren(wrap);
    void flushOnline().then(()=>loadLeaderboard(output,onlineLevel));
  }

  async function loadLeaderboard(output,level){
    const current=++onlineRequest;
    output.replaceChildren(el("p","scores-empty","Chargement du classement en ligne…"));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const res=await fetch(WORLD_BASE+"/social/leaderboard?level="+encodeURIComponent(level),{cache:"no-store",signal:controller.signal});
      const data=await res.json();
      if(!res.ok)throw Error(data.error||"Service indisponible.");
      if(current!==onlineRequest||!output.isConnected)return;
      const players=Array.isArray(data.top)?data.top:[];
      output.replaceChildren();
      if(!players.length){output.appendChild(el("p","scores-empty","Aucun joueur classé pour le moment. Termine une partie avec ton pseudo pour inaugurer le Top 10 !"));return;}
      const table=el("table","scores-online-table"),head=el("thead"),tr=el("tr");
      ["Rang","Pseudo","Points","Niveau","Mode"].forEach(label=>tr.appendChild(el("th","",label)));
      head.appendChild(tr);table.appendChild(head);
      const body=el("tbody");
      players.slice(0,10).forEach((p,i)=>{
        const row=el("tr");
        [i===0?"🥇 1":i===1?"🥈 2":i===2?"🥉 3":String(i+1),p.pseudo||"Joueur",num(p.score),String(p.level),p.mode||"—"].forEach(value=>row.appendChild(el("td","",value)));
        body.appendChild(row);
      });
      table.appendChild(body);output.appendChild(table);
      output.appendChild(el("p","scores-small",num(data.totalPlayers||0)+" joueur(s) classé(s)."+(uploadMessage?" "+uploadMessage:"")));
    }catch(error){
      if(current!==onlineRequest||!output.isConnected)return;
      output.replaceChildren(el("p","scores-empty","Classement momentanément indisponible. Vérifie ta connexion puis appuie sur Actualiser."));
    }finally{clearTimeout(timer);}
  }

  function open() {
    if (screen.hidden) returnFocus = document.activeElement;
    render(); screen.hidden = false;
    const back = screen.querySelector("button"); if (back) back.focus({preventScroll:true});
  }

  screen.addEventListener("keydown", e => { if (e.key==="Escape"){e.preventDefault();e.stopPropagation();close();} });
  window.LimbyrinthScores = { record, open, close, read, refreshLeaderboard:flushOnline };
})();