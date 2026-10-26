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

  // UI v3: style de la maquette, mais chaque élément est un vrai contrôle HTML.
  css.textContent += `
.hm-ui{box-sizing:border-box}
#home{background:radial-gradient(ellipse at 24% 8%,#1e3955 0,transparent 45%),linear-gradient(118deg,rgba(5,14,29,.92),rgba(2,10,22,.97) 55%,#030b17);scrollbar-color:#386179 #081320;scrollbar-width:thin}
.hm-bg{position:fixed;inset:0;z-index:0;opacity:.75}
.hm-bg::before{content:"";position:absolute;inset:-5% 0 0;background:radial-gradient(circle at 29% 16%,transparent 0 4%,#349aff33 4.4%,transparent 5.5%,transparent 7%,#267fe922 7.3%,transparent 8.2%),linear-gradient(140deg,transparent 25%,#193b53aa 25.2% 27%,transparent 27.3% 52%,#091d31bb 52.2% 54%,transparent 54.5%),repeating-linear-gradient(90deg,transparent 0 65px,#2e4d6427 66px 69px,transparent 70px 138px)}
.hm-bg::after{content:"";position:absolute;inset:50% -10% -8%;background:repeating-linear-gradient(98deg,transparent 0 40px,#ff772d28 41px 43px,transparent 46px 99px),repeating-linear-gradient(0deg,#081d30 0 30px,#142a3b 31px 35px,#030b19 36px 75px);transform:perspective(420px) rotateX(64deg);opacity:.62;mask-image:linear-gradient(transparent,#000 25%)}
.hm-grid{opacity:.20}
.hm-dot{background:#ff9448;box-shadow:0 0 12px #ff9448}
.hm-main{grid-template-columns:minmax(270px,.82fr) minmax(440px,1.18fr);align-items:start;gap:clamp(18px,3vw,44px)}
.hm-h1{font-size:clamp(40px,6.2vw,94px);color:transparent;background:linear-gradient(180deg,#f2faff 10%,#a8cde7 47%,#f7a263 75%,#ff6f35 95%);-webkit-background-clip:text;background-clip:text;text-shadow:0 8px 30px #1d4d9970;filter:drop-shadow(0 0 10px #206ba633);letter-spacing:.1em}
.hm-eye{color:#92c6e8;letter-spacing:.32em;font-size:10px}
.hm-tag{max-width:31em;color:#b5cee3;margin:12px 0 16px}
.hm-play{background:linear-gradient(175deg,#ffdda0 0%,#ffa748 28%,#ff7826 68%,#bd481e 100%);color:#1b120e;border:2px solid #ffd28c;border-radius:12px;box-shadow:0 0 20px #ff842f88,0 0 45px #ff842f35,inset 0 -4px 0 #6b2a1a6f;text-shadow:0 1px 0 #ffe5b2;letter-spacing:.06em;align-items:center;text-align:center;min-height:64px}
.hm-play:hover{box-shadow:0 0 32px #ff923ab3,0 0 60px #ff9a3950;transform:translateY(-2px)}
.hm-play small{font-size:12px;color:#4c2418;letter-spacing:.02em}
.hm-chip{background:#081a2cbb;border-color:#315a79;box-shadow:inset 0 0 10px #1c65801a}
.hm-btn{margin:0;min-height:44px;background:#07192cdd;border-color:#315c80;border-radius:9px;box-shadow:inset 0 0 14px #2773a21f}
.hm-btn:hover:not(:disabled){background:#15344e}
.hm-btn.gold{border-color:#b98d43;color:#ffdea0;box-shadow:inset 0 0 16px #e7a75121}
.hm-btn.viol{border-color:#8c62c7;color:#e7d2ff}
.hm-auth-hint{padding:10px 12px;border:1px solid #315d81;border-radius:10px;background:rgba(4,21,38,.84);margin:10px 0 0;font-weight:700}
.hm-auth-hint.ok{border-color:#1a927e;color:#a3ffdf}
.hm-last-run{background:linear-gradient(125deg,#0b2138db,#081729f0);border:1px solid #397ba5;border-radius:12px;margin-top:13px}
.hm-last-run strong{color:#7ce7ff;letter-spacing:.07em}
.hm-survival-card{background:linear-gradient(130deg,#3d2718cc,#0e1b2edb);border-color:#b87931;box-shadow:inset 0 0 24px #bb722522;padding:10px 13px;margin-top:10px}
.hm-survival-card h2{color:#ffcc75;letter-spacing:.06em;font-size:14px}
.hm-survival-card p{color:#f0d1af;font-size:11px}
.hm-box{border-color:#235578;background:linear-gradient(145deg,#071a2ee8,#041223e8);box-shadow:0 10px 30px #0003;border-radius:13px}
.hm-box h2{font:800 14px/1.3 system-ui;letter-spacing:.10em;color:#6cd5ff}
.hm-mode-section{border-color:#235578}
.hm-seg.hm-mode-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border:0;border-radius:0;overflow:visible}
.hm-seg.hm-mode-options button{margin:0;padding:12px 6px;min-height:86px;background:#081b30e8;border:1px solid #365b80;border-radius:9px;color:#e2f0ff;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;text-align:center;box-shadow:inset 0 0 18px #1c538116;transition:background .15s,transform .15s}
.hm-seg.hm-mode-options button .hm-mode-icon{font-size:21px;color:#94cfff;line-height:1.2}
.hm-seg.hm-mode-options button .hm-mode-label{font-size:13px;font-weight:800}
.hm-seg.hm-mode-options button .hm-mode-help{font-size:10px;color:#9aafc4;font-weight:500}
.hm-seg.hm-mode-options button.on{background:linear-gradient(155deg,#3c291c,#1c2637);border:2px solid #ff9d46;color:#fff1cf;box-shadow:0 0 15px #ff832d52}
.hm-seg.hm-mode-options button.on .hm-mode-icon{color:#ffb865}
.hm-seg.hm-mode-options button:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}

.hm-seg.hm-mode-options button:focus-visible,.hm-sec:focus-visible{outline:3px solid #a5eeff;outline-offset:2px}
.hm-level-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.hm-level-grid .hm-sec{display:flex;flex-direction:column;align-items:stretch;position:relative;gap:4px;min-width:0;margin:0;padding:7px;color:#ecf4ff;border:1px solid #305e7f;border-radius:9px;background:linear-gradient(#0b253e,#071828);text-align:center;overflow:hidden}
.hm-level-grid .hm-sec:hover:not(:disabled){transform:translateY(-2px);background:#133551}
.hm-level-grid .hm-sec.is-selected{border:2px solid #76e2fa;box-shadow:0 0 15px #52c6e055}
.hm-level-grid .hm-sec.survival-special{background:linear-gradient(#352617,#171a29);border-color:#efa349;box-shadow:0 0 16px #ff983955}
.hm-level-grid .hm-sec.survival-special.is-selected{box-shadow:0 0 24px #ff983988;border-width:2px}
.hm-level-grid .hm-sec .hm-num{font-size:10px;min-width:0;color:var(--c);font-weight:800;letter-spacing:.05em}
.hm-level-grid .hm-sec b{font-size:11px;line-height:1.2;min-height:25px;display:flex;align-items:center;justify-content:center}
.hm-level-grid .hm-sec small{display:none}
.hm-level-grid .hm-sec .hm-tagb{font-size:9px;margin:auto 0 0;padding:2px 4px;white-space:normal;border:0;color:#a6e1ef}
.hm-level-grid .hm-sec .hm-tagb.lock{color:#9ca9bb}
.hm-level-grid .hm-sec .hm-tagb.next{color:#9cead0}
.hm-thumb{position:relative;display:block;height:95px;width:100%;flex:none;overflow:hidden;border:1px solid #255678;border-radius:6px;background:radial-gradient(ellipse at 50% 76%,var(--c),transparent 62%),linear-gradient(150deg,#081626,#1a3a53)}
.hm-thumb::before{content:"";position:absolute;inset:18% -30% -10%;background:repeating-linear-gradient(90deg,#091525 0 9px,#31516d 10px 12px,#0b1d31 13px 27px);transform:perspective(100px) rotateX(42deg);box-shadow:0 -8px 27px var(--c);opacity:.9}
.hm-thumb::after{content:"";position:absolute;left:31%;top:17%;width:37%;height:40%;border:5px solid var(--c);border-radius:50%;box-shadow:0 0 24px var(--c),inset 0 0 12px var(--c);opacity:.62}
.hm-thumb-1{background:radial-gradient(circle at 38% 75%,#5083b8aa,transparent 50%),linear-gradient(#0a223e,#06111f)}
.hm-thumb-2{background:radial-gradient(ellipse at 50% 85%,#d1642088,transparent 60%),linear-gradient(#4b2619,#0b0d19)}
.hm-thumb-3{background:radial-gradient(circle at 50% 44%,#ffb04e,#c65416 15%,transparent 38%),linear-gradient(#14223b,#060a17)}
.hm-thumb-4{background:radial-gradient(circle at 65% 60%,#703fdd99,transparent 65%),linear-gradient(#1e1545,#070b22)}
.hm-thumb-5{background:radial-gradient(circle at 50% 55%,#ffd174dd,#9d560b 18%,transparent 55%),linear-gradient(#35200b,#0d0f20)}
.hm-thumb-5::after{content:"∞";font:800 42px/1 system-ui;color:#ffe3a3;border:0;box-shadow:none;left:0;top:24%;width:100%;height:auto;opacity:1;text-shadow:0 0 15px #f5a03f}
.hm-survival-card{border:1px solid #b87931}
.hm-updates-details summary{min-height:26px;display:list-item}
.hm-foot{color:#7f9bb3}
.hm-landscape-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:7px}
.hm-fullscreen-button{border:1px solid #337a98;background:#09243b;color:#a8e8fb;font-size:12px;min-height:38px;margin:0;padding:8px 12px;box-shadow:none;border-radius:8px}
.hm-turn-hint{font-size:11px;color:#ffc286}
@media (max-width:1020px){.hm-main{grid-template-columns:minmax(240px,.78fr) minmax(410px,1.22fr);gap:14px}.hm-ui{padding-left:14px;padding-right:14px}}
@media(max-width:700px) and (orientation:portrait){.hm-main{grid-template-columns:1fr}.hm-level-grid{grid-template-columns:repeat(5,minmax(105px,1fr));overflow-x:auto;padding-bottom:7px}.hm-thumb{height:74px}.hm-h1{font-size:clamp(36px,11vw,64px)}}
@media (orientation:landscape) and (max-height:600px){
  .hm-ui{padding:7px calc(10px + env(safe-area-inset-right,0px)) 9px calc(10px + env(safe-area-inset-left,0px))}
  .hm-main{grid-template-columns:minmax(210px,38fr) minmax(370px,62fr);gap:12px;padding:3px 0;align-items:start}
  .hm-top{min-height:21px;gap:5px;justify-content:flex-end}
  .hm-chip{padding:3px 9px;font-size:10px}
  .hm-chip:has(.hm-bar){display:none}
  .hm-cubewrap,.hm-tag{display:none}
  .hm-h1{font-size:clamp(27px,4vw,44px);margin:3px 0 10px}
  .hm-eye{font-size:8px;letter-spacing:.18em;margin:0}
  .hm-play{min-height:54px;padding:9px;font-size:17px}
  .hm-play small{font-size:10px}
  .hm-auth-hint{font-size:10px;margin:7px 0;padding:6px 8px}
  .hm-row{gap:5px;margin-top:7px}
  .hm-row .hm-btn{min-height:37px;padding:5px;font-size:10px}
  .hm-last-run{margin-top:6px;padding:6px 8px;font-size:10px}
  .hm-last-run strong{font-size:10px}
  .hm-survival-card{margin-top:7px;padding:6px 9px}
  .hm-survival-card h2{font-size:11px;margin:0 0 4px}
  .hm-survival-card p{font-size:10px;line-height:1.2}
  .hm-panel{gap:6px}
  .hm-box{padding:7px 8px}
  .hm-box h2{font-size:10px;margin:0 0 6px}
  .hm-seg.hm-mode-options{gap:5px}
  .hm-seg.hm-mode-options button{min-height:52px;padding:4px 2px;gap:2px}
  .hm-seg.hm-mode-options button .hm-mode-icon{font-size:13px}
  .hm-seg.hm-mode-options button .hm-mode-label{font-size:10px}
  .hm-seg.hm-mode-options button .hm-mode-help{display:none}
  .hm-level-grid{gap:4px}
  .hm-level-grid .hm-sec{padding:4px;gap:3px}
  .hm-level-grid .hm-sec b{font-size:9px;min-height:20px}
  .hm-level-grid .hm-sec .hm-num{font-size:9px}
  .hm-level-grid .hm-sec .hm-tagb{font-size:8px}
  .hm-thumb{height:61px}
  .hm-updates-details summary{min-height:0;padding:6px 8px;font-size:10px}
  .hm-updates-details .hm-update-content{padding:0 8px 6px}
  .hm-foot{display:none}
  .hm-landscape-tools{margin-top:4px}
  .hm-fullscreen-button{padding:4px 8px;min-height:32px;font-size:10px}
}
@media (orientation:landscape) and (max-height:400px){
  .hm-main{grid-template-columns:minmax(195px,36fr) minmax(370px,64fr)}
  .hm-thumb{height:46px}
  .hm-level-grid .hm-sec b{font-size:9px}
  .hm-h1{margin-bottom:6px}
  .hm-seg.hm-mode-options button{min-height:43px}
}
@media (prefers-reduced-motion:reduce){.hm-sec.survival-special{animation:none}}
`;
  let selectedLevel=null;
  async function landscapeFullscreen() {
    try {
      if(!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    }catch(e){ /* les navigateurs peuvent refuser le plein écran */ }
    try {
      if(screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    }catch(e){ /* tourner le téléphone reste possible manuellement */ }
  }
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
    const choice = selectedLevel!==null ? levels.find(l=>l.i===selectedLevel && !l.off) : null;
    const selected = choice || next;
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
      const p=btn("hm-play",hasPseudo?"▶ COMMENCER À JOUER":"▶ CRÉER TON PSEUDO ET JOUER",
        ()=>press(new RegExp("Niveau "+(selected.i+1)+"\\b")));
      p.appendChild(el('small',null,'Niveau '+(selected.i+1)+' · '+selected.name));
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
    if(tactile){
      const landscapeActions=el('div','hm-landscape-tools',null,[
        btn('hm-fullscreen-button','⛶ Plein écran · paysage',landscapeFullscreen),
        el('span','hm-turn-hint','↻ Tourne ton téléphone à l’horizontale pour jouer.')
      ]);
      hero.appendChild(landscapeActions);
    }
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
    const levelGrid=el('div','hm-level-grid');
    levels.forEach(l => {
      const meta = SECTEURS[l.i] || { c: "#65e7ff", s: "" }, isNext = !guest && next && next.i === l.i && open.length > 1;
      const chosen=selected && selected.i===l.i;
      const b = btn((l.i===4?"hm-sec survival-special":"hm-sec")+(chosen?" is-selected":""), null, () => {
        selectedLevel=l.i;render();
      }, l.off);
      b.style.setProperty("--c", meta.c);
      b.setAttribute('aria-pressed',String(!!chosen));
      b.setAttribute('aria-label','Choisir niveau '+(l.i+1)+' : '+l.name);
      b.append(el('span','hm-num','NIVEAU '+(l.i+1)),
        el('span','hm-thumb hm-thumb-'+(l.i+1)),
        el('span',null,null,[el('b',null,l.i===4?'Survie infinie':l.name),el('small',null,meta.s)]),
        el('span','hm-tagb'+(l.locked?' lock':isNext?' next':''),l.locked?'🔒 VERROUILLÉ':chosen?'✓ CHOISI':isNext?'REPRENDRE':'CHOISIR'));
      levelGrid.appendChild(b);
    });
    secs.appendChild(levelGrid);
    const panel = el('section','hm-panel');
    if (!online) {
      const seg=el('div','hm-seg hm-mode-options');
      const modeButton=(on,icon,name,help,cb,disabled=false)=>{
        const b=btn('hm-mode-card'+(on?' on':''),null,cb,disabled);
        b.setAttribute('aria-pressed',String(on));
        if(disabled)b.title='La coopération locale utilise deux joueurs au clavier. Sur téléphone, privilégie le jeu en ligne.';
        b.append(el('span','hm-mode-icon',icon),el('span','hm-mode-label',name),el('span','hm-mode-help',help));
        return b;
      };
      seg.append(
        modeButton(!duo,'👤','Solo','1 joueur',()=>{if(duo)press(/joueurs/);}),
        modeButton(duo,'👥','Coop locale',tactile?'Clavier requis':'2 joueurs · clavier',()=>{if(!duo)press(/1 joueur/);},tactile),
        modeButton(false,'🌐','En ligne','Avec un ami',()=>press(/Jouer en ligne/))
      );
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

  let queued = false; const refresh = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; render(); }); };
  const mo = new MutationObserver(refresh);
  mo.observe(lv, { childList: true, subtree: true, characterData: true });
  mo.observe(title, { childList: true, characterData: true, subtree: true });
  mo.observe(ov, { attributes: true, attributeFilter: ["style"] });
  if ($("d")) mo.observe($("d"), { childList: true, characterData: true, subtree: true });
  render();
})();