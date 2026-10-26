/* Limbyrinth — nouvelle interface d'accueil.
   À placer à côté de index.html, puis ajouter juste avant </body> :  <script src="menu.js"></script>
   Ce fichier ne touche pas au code du jeu : il remplace seulement l'écran d'accueil et
   déclenche les mêmes boutons que l'ancien menu (niveaux, mode 1/2 joueurs, en ligne, boutique). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), ov = $("overlay"), lv = $("lv"), title = $("t");
  if (!ov || !lv || !title) return; // si la page est différente, l'ancien menu reste en place

  const SECTEURS = [
    { c: "#70dfff", s: "Laboratoire cryogénique" }, { c: "#ffae62", s: "Fonderie sous pression" },
    { c: "#ff637f", s: "Chambre du réacteur" }, { c: "#65e7ff", s: "Archives de confinement de CORE" },
    {c:"#ffb469",s:"SURVIE INFINIE · ARMÉE DE CORE"}
  ];
  const RANGS = [["Recrue", 0], ["Éclaireur", 200], ["Agent", 600], ["Élite", 1500], ["Légende", 3500]];
  const tactile = matchMedia("(pointer: coarse)").matches;

  const css = document.createElement("style");
  css.textContent = `
#home{position:fixed;inset:0;z-index:5;display:none;flex-direction:column;overflow:auto;color:#e6f4ff;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;background:radial-gradient(ellipse at 25% 8%,#17405a 0,#08121f 55%,#04070d 100%);-webkit-user-select:none;user-select:none}
#overlay.home-on{background:none!important;pointer-events:none}#overlay.home-on>*{visibility:hidden!important}
.hm-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.hm-grid{position:absolute;left:-40%;right:-40%;bottom:-8%;height:55%;transform:perspective(520px) rotateX(64deg);background:linear-gradient(transparent,rgba(101,231,255,.22)),repeating-linear-gradient(90deg,rgba(101,231,255,.28) 0 1px,transparent 1px 64px),repeating-linear-gradient(0deg,rgba(101,231,255,.28) 0 1px,transparent 1px 64px);animation:hmgrid 3.5s linear infinite}
@keyframes hmgrid{to{background-position:0 0,0 0,0 64px}}
.hm-dot{position:absolute;width:4px;height:4px;border-radius:50%;background:#65e7ff;box-shadow:0 0 10px #65e7ff;opacity:.55;animation:hmfloat linear infinite}
@keyframes hmfloat{from{transform:translateY(0)}to{transform:translateY(-110vh)}}
.hm-ui{position:relative;display:flex;flex-direction:column;flex:1;padding:calc(16px + env(safe-area-inset-top,0px)) clamp(16px,4vw,56px) calc(22px + env(safe-area-inset-bottom,0px))}
.hm-top{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.hm-chip{display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #2f5a77;border-radius:999px;background:rgba(10,28,44,.72);backdrop-filter:blur(8px);font-size:13px;letter-spacing:.04em}
.hm-chip b{color:#ffd24a}.hm-bar{width:70px;height:6px;border-radius:4px;background:#1a2f44;overflow:hidden}.hm-bar i{display:block;height:100%;background:linear-gradient(90deg,#4f86ff,#b46bff,#3dff9a)}
.hm-main{flex:1;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(18px,4vw,60px);align-items:center;padding:18px 0}
.hm-cubewrap{perspective:700px;width:84px;height:84px;margin:6px 0 30px 14px}
.hm-cube{position:relative;width:84px;height:84px;transform-style:preserve-3d;animation:hmspin 14s linear infinite}
.hm-cube i{position:absolute;inset:0;border:2px solid #65e7ff;background:rgba(101,231,255,.07);box-shadow:inset 0 0 22px rgba(101,231,255,.35),0 0 16px rgba(101,231,255,.25)}
.hm-cube i:nth-child(1){transform:translateZ(42px)}.hm-cube i:nth-child(2){transform:rotateY(180deg) translateZ(42px)}.hm-cube i:nth-child(3){transform:rotateY(90deg) translateZ(42px)}
.hm-cube i:nth-child(4){transform:rotateY(-90deg) translateZ(42px)}.hm-cube i:nth-child(5){transform:rotateX(90deg) translateZ(42px)}.hm-cube i:nth-child(6){transform:rotateX(-90deg) translateZ(42px)}
@keyframes hmspin{from{transform:rotateX(-24deg) rotateY(0)}to{transform:rotateX(-24deg) rotateY(360deg)}}
.hm-eye{font-size:11px;letter-spacing:.34em;color:#8fb4cc;margin:0 0 10px}
.hm-h1{margin:0;font-size:clamp(40px,8.5vw,104px);line-height:.95;letter-spacing:.06em;font-weight:800;background:linear-gradient(95deg,#8ff3ff,#65a8ff 45%,#c08aff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 26px rgba(101,170,255,.55))}
.hm-tag{margin:14px 0 26px;font-size:clamp(14px,1.6vw,18px);color:#a8c4d8;max-width:30em;line-height:1.5}
.hm-play{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:min(100%,320px);padding:16px 30px;border:0;border-radius:16px;cursor:pointer;font:800 24px/1 inherit;letter-spacing:.14em;color:#04131c;background:linear-gradient(180deg,#8fffd0,#37e29a);box-shadow:0 0 34px rgba(61,255,154,.45),inset 0 -4px 0 rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s}
.hm-play small{font:600 12px/1.2 inherit;letter-spacing:.06em;opacity:.75}.hm-play:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 0 48px rgba(61,255,154,.65),inset 0 -4px 0 rgba(0,0,0,.18)}
.hm-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.hm-btn{display:flex;align-items:center;gap:8px;padding:12px 18px;border:1px solid #3a6784;border-radius:12px;background:rgba(14,38,58,.78);color:#dff3ff;font:700 14px/1 inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
.hm-btn:hover:not(:disabled){background:#1d4a69;border-color:#65e7ff;transform:translateY(-2px)}.hm-btn:disabled{opacity:.45;cursor:default}
.hm-btn.gold{border-color:#a8832f;color:#ffe08a}.hm-btn.viol{border-color:#7a52b8;color:#e2ccff}
.hm-note{margin-top:16px;padding:10px 14px;border-left:3px solid #ffd24a;background:rgba(255,210,74,.08);border-radius:0 10px 10px 0;font-size:13px;color:#ffe9a8;max-width:30em}
.hm-note.on{border-color:#3dff9a;background:rgba(61,255,154,.08);color:#bdffdc}.hm-note.err{border-color:#ff6b84;background:rgba(255,107,132,.09);color:#ffc2cc}
.hm-panel{display:flex;flex-direction:column;gap:14px}
.hm-box{padding:16px;border:1px solid #2c566f;border-radius:18px;background:rgba(9,26,41,.74);backdrop-filter:blur(10px)}
.hm-box h2{margin:0 0 12px;font-size:12px;letter-spacing:.24em;color:#8fb4cc;font-weight:700}
.hm-sec{display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;margin-bottom:8px;border:1px solid #25465c;border-left:4px solid var(--c);border-radius:12px;background:rgba(14,36,54,.8);color:inherit;text-align:left;font:inherit;cursor:pointer;transition:transform .15s,background .15s}
.hm-sec:last-child{margin-bottom:0}
.hm-sec.survival-special{background:linear-gradient(120deg,#3d251e,#1e2338);border:2px solid #ffb469;box-shadow:0 0 24px #f98b3544;animation:survival-glow 3s ease-in-out infinite}
@keyframes survival-glow{50%{box-shadow:0 0 34px #ffb46966}}
.hm-survival-card{background:linear-gradient(145deg,#392017,#152238);border:1px solid #f4a65f;border-radius:17px;padding:16px;margin:15px 0;max-width:480px}
.hm-survival-card h2{margin:0 0 8px;color:#ffd5a0;font-size:18px}.hm-survival-card p{margin:6px 0;color:#f1c8a3;font-size:13px;line-height:1.5}
.hm-survival-card button{width:100%;margin:8px 0 0}
@media(prefers-reduced-motion:reduce){.hm-sec.survival-special{animation:none}}.hm-sec:hover:not(:disabled){background:#1a4560;transform:translateX(4px)}.hm-sec:disabled{cursor:default;opacity:.5}
.hm-num{font:800 26px/1 inherit;color:var(--c);min-width:34px}.hm-sec b{display:block;font-size:15px}.hm-sec small{color:#9bb7ca;font-size:12px}.hm-tagb{margin-left:auto;font-size:11px;letter-spacing:.1em;padding:4px 10px;border-radius:999px;border:1px solid #3a6784;white-space:nowrap}
.hm-tagb.next{border-color:#3dff9a;color:#3dff9a}.hm-tagb.lock{color:#7c8fa0}
.hm-seg{display:flex;border:1px solid #3a6784;border-radius:12px;overflow:hidden}.hm-seg button{flex:1;padding:11px;border:0;background:transparent;color:#a8c4d8;font:700 14px/1 inherit;cursor:pointer}.hm-seg button.on{background:#1f5b7a;color:#fff}.hm-seg button:disabled{cursor:default;opacity:.6}
.hm-keys{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px;color:#b9d2e2;align-items:center}.hm-keys kbd{padding:2px 8px;border:1px solid #4a7390;border-bottom-width:3px;border-radius:6px;background:#10283b;font:700 12px/1.4 inherit;color:#e6f4ff}
.hm-foot{text-align:center;font-size:11px;letter-spacing:.14em;color:#587790;padding-top:8px}
@media(max-width:860px){.hm-main{grid-template-columns:1fr;padding-top:6px}.hm-top{justify-content:flex-start}.hm-cubewrap{margin-bottom:18px}.hm-play{width:100%}}
.hm-update-box{margin-top:20px;border-color:#477b89!important;background:linear-gradient(125deg,rgba(22,61,81,.85),rgba(8,27,44,.93))!important}
.hm-update-line{display:flex;flex-direction:column;gap:3px;padding:9px 0;margin:0;border-bottom:1px solid rgba(143,220,246,.16);font-size:13px;line-height:1.5}
.hm-update-line b{font-size:12px;color:#8ff3ff;letter-spacing:.04em}
.hm-update-line span{color:#e4f3fc}
.hm-update-small{font-size:11px;color:#9dbed1;line-height:1.5;margin:10px 0}
.hm-update-box .hm-btn{width:100%;justify-content:center}
@media(prefers-reduced-motion:reduce){.hm-cube,.hm-grid,.hm-dot{animation:none}.hm-play,.hm-btn,.hm-sec{transition:none}}`;
  document.head.appendChild(css);

  // Accueil v2 : lecture verticale claire, résultat précédent et options secondaires repliées.
  css.textContent += `
.hm-ui{width:min(1260px,100%);margin:0 auto}
.hm-main{align-items:start;gap:clamp(16px,3vw,34px);padding-top:12px;grid-template-columns:minmax(300px,.92fr) minmax(310px,1fr)}
.hm-panel{gap:10px}
.hm-box{padding:14px}
.hm-box h2{letter-spacing:.09em;font-size:13px;margin-bottom:10px;color:#aad9f0}
.hm-cubewrap{width:48px;height:48px;transform:scale(.65);transform-origin:left top;margin:2px 0 -2px 5px}
.hm-eye{margin-top:4px}
.hm-h1{font-size:clamp(37px,6vw,78px);letter-spacing:.03em}
.hm-tag{margin:13px 0 18px;font-size:14px}
.hm-play{max-width:100%;min-width:0;width:100%;margin:0;padding:16px 20px;font-size:22px;box-sizing:border-box}
.hm-row{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.hm-row .hm-btn{width:100%;justify-content:center;margin:0;text-align:center}
.hm-mode-section{border-color:#4d8498}
.hm-mode-section .hm-seg button{font-size:12px}
.hm-survival-card{padding:12px 14px;margin:13px 0 0;max-width:none}
.hm-survival-card h2{font-size:15px}
.hm-survival-card p{font-size:12px;margin:4px 0}
.hm-last-run{margin:12px 0 0;padding:12px 14px;border:1px solid #388e8a;border-radius:13px;background:rgba(12,65,65,.45);font-size:13px;line-height:1.5}
.hm-last-run strong{display:block;font-size:14px;color:#91ffdf}
.hm-auth-hint{font-size:12px;margin:8px 0 0;color:#e4c3a1;line-height:1.45}
.hm-auth-hint.ok{color:#9de7c6}
.hm-updates-details{padding:0}
.hm-updates-details summary{cursor:pointer;padding:13px 15px;color:#c2e8f4;font-size:13px;font-weight:700;list-style:auto}
.hm-updates-details .hm-update-content{padding:0 14px 14px}
.hm-update-box{margin:0!important}
.hm-sec{margin:0 0 6px;padding:10px 12px}
.hm-sec b{font-size:14px}
.hm-sec small{font-size:11px}
.hm-foot{padding-top:9px;line-height:1.5}
@media(max-width:860px){.hm-main{grid-template-columns:1fr;gap:15px}.hm-cubewrap{display:none}.hm-tag{margin-bottom:14px}.hm-top{justify-content:space-between}}
@media(max-width:420px){.hm-ui{padding-left:12px;padding-right:12px}.hm-main{padding:9px 0}.hm-row{gap:7px}.hm-btn{padding:12px 9px;font-size:12px}.hm-h1{font-size:38px}.hm-tagb{font-size:10px;padding:3px 7px}}
`;
  const home = document.createElement("div"); home.id = "home";
  const bg = document.createElement("div"); bg.className = "hm-bg";
  bg.appendChild(Object.assign(document.createElement("div"), { className: "hm-grid" }));
  for (let i = 0; i < 16; i++) { const d = document.createElement("i"); d.className = "hm-dot"; d.style.cssText = "left:" + (i * 6.4 + 2) + "%;bottom:-10px;animation-duration:" + (9 + (i * 7) % 11) + "s;animation-delay:-" + ((i * 3) % 12) + "s;opacity:" + (0.25 + (i % 4) * 0.12); bg.appendChild(d); }
  const ui = document.createElement("div"); ui.className = "hm-ui";
  home.append(bg, ui); document.body.appendChild(home);

  const el = (tag, cls, txt, kids) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; (kids || []).forEach(k => e.appendChild(k)); return e; };
  const btn = (cls, txt, fn, off) => { const b = el("button", cls, txt); b.type = "button"; b.disabled = !!off; if (fn) b.onclick = fn; return b; };
  const save = () => { try { return JSON.parse(localStorage.getItem("cubeEscapeSave") || "{}") || {}; } catch (e) { return {}; } };
  const old = () => [...lv.querySelectorAll("button")];
  const press = re => { const b = old().find(x => re.test(x.textContent)); if (b && !b.disabled) b.click(); };

  function render() {
    const menu = ov.style.display !== "none" && title.textContent.trim() === "LIMBYRINTH";
    ov.classList.toggle("home-on", menu); home.style.display = menu ? "flex" : "none";
    if (!menu) return;
    const sv = save(), earned = +sv.earned || 0, coins = +sv.coins || 0;
    let ri = 0; RANGS.forEach((r, i) => { if (earned >= r[1]) ri = i; });
    const lo = RANGS[ri][1], hi = RANGS[ri + 1] ? RANGS[ri + 1][1] : null, pct = hi ? Math.min(100, (earned - lo) / (hi - lo) * 100) : 100;
    const modeTxt = (old().find(b => /joueur|En ligne/.test(b.textContent) && !/Jouer en ligne/.test(b.textContent)) || {}).textContent || "";
    const online = /En ligne/.test(modeTxt) || !!old().find(b => /Quitter le salon/.test(b.textContent));
    const duo = /^2 joueurs/.test(modeTxt);
    const levels = old().map(b => { const m = b.textContent.match(/Niveau (\d+)\s*:\s*(.+)$/); return m ? { i: +m[1] - 1, name: m[2].trim(), locked: /\u{1F512}/u.test(b.textContent), off: b.disabled } : null; }).filter(Boolean);
    const open = levels.filter(l => !l.locked), next = open.length ? open[open.length - 1] : levels[0];
    const guest = online && levels.length > 0 && levels.every(l => l.off) && !old().find(b => /Boutique/.test(b.textContent));
    const hasPseudo=!!window.LimbyrinthFriends?.hasProfile?.();
    let hasToken=false;
    try{hasToken=!!localStorage.getItem('limbyrinthSocialTokenV1');}catch{}
    const info = ($("d") && $("d").textContent) || "";
    const bonus = info.match(/Bonus du jour : \+\d+ pièces[^.]*\./);

    const top = el("div", "hm-top", null, [
      el("div", "hm-chip", null, [el("span", null, "\u{1FA99}"), el("b", null, String(coins))]),
      el("div", "hm-chip", null, [el("span", null, "Rang " + RANGS[ri][0]), el("span", "hm-bar", null, [el("i")])]),
      ...(sv.streak > 1 ? [el("div", "hm-chip", "\u{1F525} " + sv.streak + " jours de suite")] : [])
    ]);
    top.querySelector(".hm-bar i").style.width = pct + "%";

    const cube = el("div", "hm-cubewrap", null, [el("div", "hm-cube", null, [el("i"), el("i"), el("i"), el("i"), el("i"), el("i")])]);
    const hero = el("section", null, null, [cube, el("p", "hm-eye", "CUBE ESCAPE · PROTOCOLE D’ÉVASION"), el("h1", "hm-h1", "LIMBYRINTH"),
      el("p", "hm-tag", guest ? "Tu es connecté à ton ami. L’hôte choisit le secteur : la partie démarrera toute seule." : "Cinq secteurs : explore, infiltre-toi, puis résiste dans une arène infinie où chaque vague compte.")]);
    if(!guest && next) {
      const p=btn("hm-play",hasPseudo?"▶ REPRENDRE":"▶ COMMENCER À JOUER",
        ()=>press(new RegExp("Niveau "+(next.i+1)+"\\b")));
      p.appendChild(el('small',null,'Secteur '+(next.i+1)+' · '+next.name));
      p.dataset.play='1';hero.appendChild(p);
      hero.appendChild(el('p','hm-auth-hint'+(hasPseudo?' ok':''),
        hasPseudo?'✓ Pseudo confirmé · scores sauvegardés':
        hasToken?'👤 Ton profil sera vérifié avant de jouer.':
        '🔒 Première partie ? Choisis un pseudo pour débloquer le jeu.'));
    }
    const row=el("div","hm-row");
    row.appendChild(btn('hm-btn hm-friends-button','👤 Mon pseudo',()=>window.LimbyrinthFriends?.open()));
    row.appendChild(btn('hm-btn hm-scores-button','🏆 Scores et Top 10',()=>window.LimbyrinthScores?.open()));
    if(!guest)row.appendChild(btn('hm-btn gold','🛒 Boutique',()=>press(/Boutique/)));
    if(online)row.appendChild(btn('hm-btn viol','Quitter le salon',()=>press(/Quitter le salon/)));
    else row.appendChild(btn('hm-btn viol','🌐 Jouer en ligne',()=>press(/Jouer en ligne/)));
    hero.appendChild(row);
    const last=sv.lastRun;
    if(last && typeof last.title==='string' && Number.isFinite(Number(last.score))) {
      hero.appendChild(el('section','hm-last-run',null,[
        el('strong',null,'DERNIÈRE PARTIE · '+last.title),
        el('span',null,'Niveau '+last.level+' · '+last.score+' points'+(last.details?' · '+last.details:''))
      ]));
    }
    const survival = levels.find(l=>l.i===4);
    const showcase=el('section','hm-survival-card',null,[
      el('h2',null,'♾️ NIVEAU 5 · SURVIE INFINIE'),
      el('p',null,'3 relais tactiques à capturer : EMP, réparation et surcharge · Titan toutes les 5 vagues.'),
      el('p',null,'🏆 Vague 50 : Spectre · Vague 100 : Souverain'),
      el('p',null,'Record personnel : vague '+(sv.survivalMaxWave||0)+' · '+Math.floor((sv.bestSurvive||0)/60)+' min '+String(Math.floor((sv.bestSurvive||0)%60)).padStart(2,'0')+' s')
    ]);
    hero.appendChild(showcase);
    const updateBox=el('details','hm-box hm-update-box hm-updates-details');
    updateBox.appendChild(el('summary',null,'💡 Actualités, nouveautés et idées'));
    const updates=el('div','hm-update-content');
    updates.append(
      el('p','hm-update-line','Niveau 5 : survie infinie, relais tactiques et nouveaux skins aux vagues 50 et 100.'),
      btn('hm-btn hm-feedback-button','💬 Signaler un bug ou proposer une idée',()=>window.LimbyrinthFeedback?.open('idea')),
      btn('hm-btn hm-feedback-card','📊 Répondre au sondage',()=>window.LimbyrinthFeedback?.open('poll'))
    );
    updateBox.appendChild(updates);
    if (online) hero.appendChild(el("div", "hm-note on", guest ? "Salon en ligne · tu es l’invité" : "Salon en ligne · ton ami est connecté, tu es l’hôte"));
    else if (/Connexion perdue|quitté le salon/.test(info)) hero.appendChild(el("div", "hm-note err", /perdue/.test(info) ? "Connexion perdue. Crée ou rejoins un nouveau salon." : "Le salon a été quitté."));
    else if (bonus) hero.appendChild(el("div", "hm-note", "\u{1F381} " + bonus[0]));

    const secs = el('div','hm-box',null,[el('h2',null,'② CHOISIS TON NIVEAU')]);
    levels.forEach(l => {
      const meta = SECTEURS[l.i] || { c: "#65e7ff", s: "" }, isNext = !guest && next && next.i === l.i && open.length > 1;
      const b = btn(l.i===4?"hm-sec survival-special":"hm-sec", null, () => press(new RegExp("Niveau " + (l.i + 1) + "\\b")), l.off);
      b.style.setProperty("--c", meta.c);
      b.append(el("span", "hm-num", String(l.i + 1)), el("span", null, null, [el("b", null, l.name), el("small", null, meta.s)]),
        el("span", "hm-tagb" + (l.locked ? " lock" : isNext ? " next" : ""), l.locked ? "VERROUILLÉ" : isNext ? "REPRENDRE" : "DISPONIBLE"));
      secs.appendChild(b);
    });
    const panel = el('section','hm-panel');
    if (!online) {
      const seg = el("div", "hm-seg"); const b1 = btn(duo ? "" : "on", "1 joueur", () => { if (duo) press(/joueurs/); });
      const b2 = btn(duo ? "on" : "", "2 joueurs · même clavier", () => { if (!duo) press(/1 joueur/); }); seg.append(b1, b2);
      panel.appendChild(el('div','hm-box hm-mode-section',null,[el('h2',null,'① CHOISIS TON MODE'),seg]));
    }
    panel.appendChild(secs);
    panel.appendChild(updateBox);
    const k = el("div", "hm-keys");
    (tactile ? [["Joystick", "se déplacer"], ["TIR", "vise tout seul les drones proches"], ["DASH", "foncer (5 s de recharge)"], ["VUE", "vue subjective"]]
      : [["Z Q S D", "se déplacer (ou les flèches)"], ["Clic", "tirer"], ["Maj", "dash (5 s de recharge)"], ["V", "vue subjective"], ["P", "pause · M : son"], ["E", "console de phase (niveau 4)"]])
      .forEach(([a, c]) => k.append(el("kbd", null, a), el("span", null, c)));
    const help=el('details','hm-box hm-updates-details');
    help.append(el('summary',null,'⌨️ Afficher les commandes'),el('div','hm-update-content',null,[k]));
    panel.appendChild(help);

    ui.replaceChildren(top, el("main", "hm-main", null, [hero, panel]), el("div", "hm-foot", "JOUER → MODE → NIVEAU · TES RECORDS RESTENT DISPONIBLES DANS SCORES"));
    const play = ui.querySelector("[data-play]"); if (play) play.focus({ preventScroll: true });
  }

  let queued = false; const refresh = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); };
  const mo = new MutationObserver(refresh);
  mo.observe(lv, { childList: true, subtree: true, characterData: true });
  mo.observe(title, { childList: true, characterData: true, subtree: true });
  mo.observe(ov, { attributes: true, attributeFilter: ["style"] });
  if ($("d")) mo.observe($("d"), { childList: true, characterData: true, subtree: true });
  render();
})();