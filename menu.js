/* Limbyrinth — accueil plein écran compact, sans défilement. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),ov=$('overlay'),lv=$('lv'),title=$('t');
  if(!ov||!lv||!title)return;
  const tactile=matchMedia('(pointer:coarse)').matches;
  const STAGES=[
    {name:'LABYRINTHE',subtitle:'Cryogénie',color:'#61cfff',hint:'Trouve les cristaux puis le portail.'},
    {name:'FONDERIE',subtitle:'Pression',color:'#ffaf6e',hint:'Survis aux murs en mouvement.'},
    {name:'LE NOYAU',subtitle:'Réacteur',color:'#ff697c',hint:'Atteins le cœur du complexe.'},
    {name:'ARCHIVES',subtitle:'CORE',color:'#9e9aff',hint:'Maîtrise les phases du labyrinthe.'},
    {name:'SURVIE',subtitle:'Infinie',color:'#ffbd62',hint:'Survis aux vagues et active les relais.'}
  ];
  const RANKS=[['Recrue',0],['Éclaireur',200],['Agent',600],['Élite',1500],['Légende',3500]];
  const css=document.createElement('style');
  css.textContent=`
#home #hm-settings{flex:1 1 175px;min-width:0}
#home #hm-settings>summary{display:flex;align-items:center;justify-content:center;min-height:42px;padding:10px 13px;border-radius:11px;border:2px solid #67d9ff;background:linear-gradient(120deg,#17436b,#0b2845);color:#fff;font-size:13px;font-weight:900;letter-spacing:.02em;white-space:normal;text-align:center;box-shadow:0 0 14px #35baff55;transition:background .2s,box-shadow .2s}
#home #hm-settings>summary:hover,#home #hm-settings>summary:focus-visible{background:#235b87;box-shadow:0 0 22px #42caffaa;outline:2px solid #c7f5ff;outline-offset:2px}
#home #hm-settings[open]>summary{background:#245f8e;border-color:#a8edff}
#home #hm-settings .hm-update-content{width:min(350px,90vw);font-size:13px;color:#e9f6ff;border:2px solid #66cfff;box-shadow:0 8px 32px #000b}
#home #hm-settings .hm-update-line{font-size:13px;line-height:1.5;color:#e9f6ff;cursor:pointer}
@media(max-width:650px){#home #hm-settings>summary{min-height:36px;font-size:11px;padding:7px 9px}}
html.hm-motion-reduced #home *,html.hm-motion-reduced #home *::before,html.hm-motion-reduced #home *::after{animation:none!important;transition:none!important}

#home,#home *{box-sizing:border-box}
#home{position:fixed;inset:0;z-index:5;display:none;overflow:hidden;color:#e6f0fc;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;background:#040913;isolation:isolate;user-select:none;-webkit-user-select:none}
#overlay.home-on{background:transparent!important;pointer-events:none}
#overlay.home-on>*{visibility:hidden!important}
.hm-scene{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:#040913 url("./file_00000000c11081f4a0824c4e15a0708b.png") center center / cover no-repeat}
.hm-scene::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,7,20,.88) 0%,rgba(2,7,20,.73) 42%,rgba(2,7,20,.46) 100%)}
.hm-scene::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(1,5,15,.7),transparent 28%,transparent 72%,rgba(1,5,15,.35))}
.hm-shell{height:100%;height:100dvh;width:min(1480px,100%);margin:0 auto;padding:
  calc(10px + env(safe-area-inset-top,0px))
  calc(18px + env(safe-area-inset-right,0px))
  calc(10px + env(safe-area-inset-bottom,0px))
  calc(18px + env(safe-area-inset-left,0px));
  display:grid;grid-template-rows:min-content minmax(0,1fr);gap:10px;min-width:0}
.hm-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;min-height:29px}
.hm-overline{font-size:10px;letter-spacing:.22em;color:#86a9c3;font-weight:800;white-space:nowrap}
.hm-meta{display:flex;gap:8px;justify-content:flex-end;min-width:0}
.hm-chip{white-space:nowrap;color:#a5c7d9;font-size:11px;font-weight:800;background:#071b2b99;border:1px solid #31536b9c;border-radius:999px;padding:5px 11px}
.hm-chip b{color:#ffce81}
.hm-main{display:grid;grid-template-columns:minmax(0,.83fr) minmax(0,1.17fr);gap:clamp(14px,2.3vw,35px);min-width:0;min-height:0;align-items:stretch}
.hm-hero{min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:clamp(7px,1.7vh,15px);position:relative;padding:clamp(4px,1.4vw,20px) 0}
.hm-eyebrow{font-size:clamp(9px,.85vw,12px);letter-spacing:.27em;color:#8de1ff;font-weight:900}
.hm-h1{font-family:system-ui,"Segoe UI",sans-serif;line-height:.94;margin:0;font-size:clamp(33px,5.15vw,78px);
  font-weight:950;letter-spacing:.015em;color:#eff9ff;text-shadow:0 1px 0 #fff5,0 7px 28px #1a78cf77}
.hm-h1 em{font-style:normal;color:#ffab6c}
.hm-tag{font-size:clamp(11px,1.04vw,14px);color:#a8bdce;margin:0;max-width:42ch}
.hm-preview{position:relative;display:flex;align-items:center;gap:12px;min-width:0;
  height:clamp(64px,16vh,180px);border:1px solid #4f7c936c;border-radius:13px;padding:12px 14px;
  background:linear-gradient(105deg,#081e31d9,#071321aa);overflow:hidden}
.hm-preview::before{content:"";position:absolute;width:clamp(85px,12vw,155px);aspect-ratio:1;right:6%;top:50%;transform:translateY(-50%) rotate(16deg);
 border:2px solid var(--accent,#59c8ff);border-radius:50%;opacity:.7;box-shadow:0 0 13px var(--accent),0 0 0 10px #8abbd510,0 0 0 24px #61bfee08,inset 0 0 25px #4db6fa22}
.hm-preview::after{content:"";position:absolute;width:clamp(24px,4.5vw,56px);aspect-ratio:1;right:calc(6% + clamp(30px,3.75vw,50px));top:50%;transform:translate(50%,-50%);
 background:radial-gradient(circle at 40% 30%,#f4fbff 0 5%,var(--accent) 18%,#0b2742 65%);border:2px solid #8ad1ee98;border-radius:44%;
 box-shadow:0 0 20px var(--accent);rotate:-15deg}
.hm-preview-copy{z-index:1;max-width:58%;display:flex;flex-direction:column;gap:4px;min-width:0}
.hm-kicker{font-size:10px;letter-spacing:.14em;font-weight:850;color:var(--accent)}
.hm-preview-name{font-size:clamp(18px,2.25vw,30px);font-weight:950;line-height:1;letter-spacing:.03em}
.hm-preview-description{color:#b0c6d5;font-size:11px;line-height:1.3}
.hm-play{width:100%;min-height:clamp(45px,8.2vh,72px);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;
 border:1px solid #ffcb91;border-radius:11px;margin:0;padding:8px 12px;cursor:pointer;
 background:linear-gradient(170deg,#ffc77d,#ff974c 45%,#ef6b33);color:#26130d;font:950 clamp(17px,1.8vw,24px)/1.1 system-ui,sans-serif;
 letter-spacing:.02em;box-shadow:0 5px 29px #ff81384b,inset 0 -3px 0 #9b361a8a}
.hm-play small{font-size:11px;line-height:1.2;font-weight:700;color:#5c2c1c;letter-spacing:0}
.hm-play:hover{filter:brightness(1.08)}#home button:focus-visible,#home summary:focus-visible{outline:3px solid #b2eeff;outline-offset:2px}
.hm-auth-hint{border-left:3px solid #e2a566;padding:3px 7px;margin:0;color:#ffdaaa;font-size:11px;font-weight:700}
.hm-auth-hint.ok{border-color:#47b89a;color:#abf6d5}
.hm-last-run{min-width:0;display:flex;align-items:center;gap:9px;border:1px solid #345a747c;background:#071b2cbc;border-radius:9px;padding:7px 10px}
.hm-last-run strong{font-size:11px;color:#8adfff;display:block}
.hm-last-run span{display:block;font-size:11px;color:#d2dde8;overflow:hidden;text-overflow:ellipsis}
.hm-survival-card{padding:7px 9px;background:linear-gradient(90deg,#4a28163b,#0b1b2c8c);border-left:2px solid #e6a14c;border-radius:4px;font-size:10px;color:#e6cda8;line-height:1.35}
.hm-survival-card b{color:#ffbf71}
.hm-panel{min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:clamp(7px,1.45vh,13px)}
.hm-panel-block{background:linear-gradient(140deg,#09192ce8,#071422d8);border:1px solid #2a4d6687;border-radius:12px;padding:clamp(8px,1.2vh,15px);min-width:0}
.hm-panel-title{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px;color:#8ad7f6;font-size:10px;font-weight:900;letter-spacing:.15em;line-height:1.25}
.hm-mode-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.hm-mode-options button{display:flex;gap:6px;align-items:center;justify-content:center;flex-direction:column;min-width:0;min-height:clamp(42px,9vh,76px);
 background:#0b2032;border:1px solid #32556e;border-radius:8px;color:#c9dfeb;margin:0;padding:7px 5px;cursor:pointer;font:800 12px system-ui,sans-serif;box-shadow:none}
.hm-mode-options button.on{background:linear-gradient(#343022,#281d21);border-color:#f0a75c;box-shadow:inset 0 0 20px #f29b3721;color:#ffdfa9}
.hm-mode-options button:disabled{opacity:.4;cursor:not-allowed}
.hm-mode-icon{font-size:clamp(14px,2vw,24px);line-height:1}.hm-mode-label{font-size:clamp(10px,.9vw,13px);white-space:nowrap}
.hm-mode-help{display:none}
.hm-level-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;min-width:0}
.hm-sec{display:flex;flex-direction:column;justify-content:space-between;align-items:stretch;gap:4px;min-width:0;min-height:clamp(93px,20vh,183px);
 border:1px solid #2f556d;border-radius:9px;padding:7px 5px;background:#0a1b2c;box-shadow:none;color:#dcecf4;margin:0;cursor:pointer;overflow:hidden}
.hm-sec.is-selected{border:2px solid #92dfff;background:#0b2a40;box-shadow:0 0 14px #5bd4f51b}
.hm-sec.survival-special{border-color:#c28b42;background:linear-gradient(160deg,#30261b,#141b29)}
.hm-sec.survival-special.is-selected{border:2px solid #ffbf66;box-shadow:0 0 15px #dc973b45}
.hm-sec:disabled{opacity:.53;cursor:not-allowed}
.hm-num{font-size:9px;letter-spacing:.07em;color:var(--accent);font-weight:950}
.hm-thumb{display:block;position:relative;flex:1;min-height:34px;max-height:92px;overflow:hidden;border-radius:5px;background:radial-gradient(circle at 47% 66%,var(--accent),transparent 52%),#0b2134;isolation:isolate}
.hm-thumb::before{content:"";position:absolute;inset:25% -10% -30%;background:repeating-linear-gradient(90deg,#071322 0 7px,#2b506b 8px 9px,#071a2b 10px 20px);transform:perspective(120px) rotateX(58deg)}
.hm-thumb::after{content:"";position:absolute;inset:20% 35% auto;aspect-ratio:1;border:3px solid var(--accent);border-radius:50%;box-shadow:0 0 15px var(--accent),inset 0 0 8px var(--accent)}
.hm-thumb-2{background:radial-gradient(circle at 46% 65%,#ffac55,#6c2e15 45%,#0a1c2c)}
.hm-thumb-3{background:radial-gradient(circle at 45% 51%,#ffde9c 0,#f45843 12%,transparent 45%),#131b32}
.hm-thumb-4{background:radial-gradient(circle at 45% 61%,#b577ff,#24115f 43%,#09152c)}
.hm-thumb-5{background:radial-gradient(circle at 50% 54%,#ffbc6b,#894616 28%,#221729)}
.hm-thumb-5::after{content:"∞";inset:10% 0 auto;aspect-ratio:auto;border:0;box-shadow:none;text-align:center;font-size:clamp(25px,3vw,48px);line-height:1;color:#ffe0a8;text-shadow:0 0 10px #ffac51}
.hm-sec b{font-size:clamp(10px,.93vw,14px);line-height:1.1;overflow-wrap:anywhere}
.hm-tagb{font-size:9px;color:#92b4ca;line-height:1.15;display:block}
.hm-tagb.next,.hm-tagb.chosen{color:#7febcc}
.hm-tagb.lock{color:#a5aeba}
.hm-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.hm-btn{min-width:0;min-height:clamp(37px,7vh,58px);padding:5px 7px;display:flex;align-items:center;justify-content:center;gap:6px;text-align:center;
 border:1px solid #315874;background:#0d253a;border-radius:8px;color:#dbedfa;cursor:pointer;font:800 11px/1.3 system-ui,sans-serif;margin:0;box-shadow:none}
.hm-btn:hover{background:#193851}.hm-btn.gold{color:#ffdfa9;border-color:#7e6845}.hm-btn.viol{color:#e5d2ff;border-color:#69558f}
.hm-actions-extra{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.hm-updates-details{border:0;position:relative;min-width:0;min-height:0}
.hm-updates-details>summary{cursor:pointer;list-style:none;color:#8aafc9;font-size:10px;padding:5px 0;white-space:nowrap;font-weight:700}
.hm-updates-details>summary::-webkit-details-marker{display:none}
.hm-updates-details>summary::before{content:"+";color:#7ecbef;margin-right:6px}
.hm-updates-details[open]>summary::before{content:"−"}
.hm-update-content{position:absolute;right:0;bottom:calc(100% + 5px);z-index:2;width:min(330px,70vw);padding:10px;
 display:flex;flex-direction:column;gap:7px;background:#081e32;border:1px solid #376989;border-radius:10px;box-shadow:0 10px 40px #000a}
.hm-update-content .hm-btn{min-height:30px}
.hm-update-line{color:#cbd9e6;font-size:11px}
.hm-fullscreen-button{min-height:29px;margin:0;border:1px solid #366a85;border-radius:7px;padding:5px 9px;background:#0d283d;color:#a7e2ff;box-shadow:none;font:800 10px system-ui}
.hm-foot{font-size:10px;color:#7ba1bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-height:670px) and (min-width:600px){
 .hm-shell{gap:5px;padding-top:calc(5px + env(safe-area-inset-top,0px));padding-bottom:calc(5px + env(safe-area-inset-bottom,0px))}
 .hm-top{min-height:23px}
 .hm-overline{font-size:9px}
 .hm-chip{padding:3px 8px;font-size:10px}
 .hm-hero{gap:6px;padding:0}
 .hm-h1{font-size:clamp(28px,4.4vw,56px)}
 .hm-tag{display:none}
 .hm-preview{height:clamp(48px,12vh,86px);padding:7px 10px}
 .hm-preview-description{font-size:10px}
 .hm-preview-name{font-size:clamp(15px,1.8vw,22px)}
 .hm-play{min-height:47px;padding:5px 8px;font-size:clamp(15px,1.8vw,20px)}
 .hm-play small{font-size:10px}
 .hm-auth-hint{font-size:10px}
 .hm-last-run{padding:5px 7px}.hm-last-run span,.hm-last-run strong{font-size:10px}
 .hm-survival-card{padding:5px 7px;font-size:9px}
 .hm-panel{gap:6px}
 .hm-panel-block{padding:7px}
 .hm-panel-title{margin:0 0 5px;font-size:9px}
 .hm-mode-options button{min-height:43px;padding:4px;gap:3px}
 .hm-mode-icon{font-size:14px}
 .hm-mode-label{font-size:10px}
 .hm-sec{min-height:clamp(77px,22vh,119px);padding:4px}
 .hm-thumb{min-height:24px}
 .hm-sec b{font-size:10px}
 .hm-row .hm-btn{min-height:37px;font-size:10px;padding:5px 2px}
 .hm-actions-extra{min-height:22px}
 .hm-updates-details>summary{font-size:9px}
}
@media (max-height:420px) and (min-width:600px){
 .hm-main{grid-template-columns:minmax(0,40fr) minmax(0,60fr);gap:10px}
 .hm-h1{font-size:clamp(26px,4vw,39px)}
 .hm-preview{height:53px}
 .hm-preview-description{display:none}
 .hm-play{min-height:44px}
 .hm-mode-options button{min-height:38px;padding:3px}
 .hm-sec{min-height:83px}
 .hm-thumb{max-height:39px}
 .hm-panel{gap:5px}
 .hm-panel-block{padding:6px}
 .hm-row .hm-btn{min-height:33px;font-size:9px}
 .hm-survival-card{font-size:9px;line-height:1.15}
 .hm-update-content{bottom:calc(100% + 2px)}
}
@media(max-width:599px) and (orientation:portrait){
 .hm-shell{gap:5px;padding:6px 9px;grid-template-rows:23px minmax(0,1fr)}
 .hm-main{grid-template-columns:1fr;grid-template-rows:min-content minmax(0,1fr);gap:7px}
 .hm-top{min-height:21px}
 .hm-overline{display:none}
 .hm-meta{margin-left:auto}
 .hm-hero{gap:6px;padding:0;justify-content:flex-start}
 .hm-h1{font-size:clamp(29px,9vw,46px)}
 .hm-tag,.hm-preview{display:none}
 .hm-play{min-height:42px;font-size:17px;padding:5px}
 .hm-play small{font-size:9px}
 .hm-auth-hint{font-size:10px}
 .hm-last-run{padding:4px 7px}.hm-last-run span,.hm-last-run strong{font-size:10px}
 .hm-survival-card{display:none}
 .hm-panel{justify-content:flex-start;gap:7px}
 .hm-panel-block{padding:7px}
 .hm-panel-title{margin-bottom:4px;font-size:9px}
 .hm-mode-options button{min-height:43px;padding:4px}
 .hm-mode-icon{font-size:15px}
 .hm-level-grid{gap:4px}
 .hm-sec{min-height:clamp(87px,15vh,110px);padding:4px 3px}
 .hm-sec b{font-size:9px}
 .hm-thumb{max-height:55px;min-height:25px}
 .hm-num,.hm-tagb{font-size:8px}
 .hm-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
 .hm-row .hm-btn{min-height:33px}
 .hm-actions-extra{min-height:21px}
 .hm-update-content{bottom:calc(100% + 3px);width:min(300px,95vw)}
}
@media(max-width:599px) and (orientation:landscape){.hm-h1{font-size:25px}.hm-main{grid-template-columns:1fr 1fr;gap:6px}.hm-preview{display:none}.hm-sec{min-height:74px}.hm-thumb{max-height:30px}.hm-hero{gap:3px}.hm-tag{display:none}.hm-panel{gap:3px}.hm-panel-block{padding:4px}.hm-row .hm-btn{min-height:28px;font-size:9px}.hm-mode-options button{min-height:36px}.hm-shell{padding:3px 6px;gap:4px}}
@media (prefers-reduced-motion:reduce){#home button{transition:none}.hm-scene::after{box-shadow:none}}
`;

  css.textContent += `
/* L'illustration du labyrinthe est réellement visible derrière une UI translucide. */
.hm-scene{background:
  linear-gradient(100deg,rgba(2,7,15,.29) 0%,rgba(2,7,15,.05) 47%,rgba(2,7,15,.26) 100%),
  url('./file_00000000c11081f4a0824c4e15a0708b.png') center 53%/cover no-repeat!important}
.hm-scene::before,.hm-scene::after{display:none!important}
.hm-panel-block{background:rgba(5,15,28,.69);backdrop-filter:blur(3px)}
.hm-preview{background:rgba(6,17,30,.49);backdrop-filter:blur(2px)}
.hm-hero{background:transparent}
.hm-last-run{background:rgba(5,17,29,.68)}
.hm-art-preview{margin:0;padding:4px 9px;min-height:27px;background:rgba(6,22,34,.72);border:1px solid #457995;border-radius:8px;color:#c0efff;font:750 10px system-ui;cursor:pointer}
#home.hm-art-only .hm-main,#home.hm-art-only .hm-meta,#home.hm-art-only .hm-overline{visibility:hidden;pointer-events:none}
#home.hm-art-only .hm-scene{background:
  url('./file_00000000c11081f4a0824c4e15a0708b.png') center center/cover no-repeat!important}
#home.hm-art-only .hm-art-preview{border-color:#fff;background:#10354b;color:#fff;box-shadow:0 0 16px #49aafc77}
.hm-scene{transition:opacity .2s}
.hm-kit{color:#c6b5ff;font-weight:700}
.hm-info-combined{display:flex;align-items:center;gap:6px}
.hm-info-combined>summary{border:1px solid #356580;border-radius:7px;background:rgba(5,19,33,.72);padding:7px 10px;color:#b7e7f7}
.hm-info-combined .hm-update-content{min-width:min(330px,78vw);z-index:20}
@media(max-height:430px) and (orientation:landscape){
 .hm-panel-block{background:rgba(5,15,27,.74)}
 .hm-art-preview{min-height:23px;font-size:9px;padding:3px 7px}
 .hm-info-combined>summary{padding:4px 8px;font-size:9px}
}
`;
  document.head.appendChild(css);
  const home=document.createElement('div');home.id='home';
  const scene=document.createElement('div');scene.className='hm-scene';
  const shell=document.createElement('div');shell.className='hm-shell';
  home.append(scene,shell);document.body.appendChild(home);
  const el=(tag,cls,txt,kids)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined && txt!==null)n.textContent=txt;if(kids)for(const k of kids)n.appendChild(k);return n};
  const btn=(cls,text,fn,disabled)=>{const b=el('button',cls,text);b.type='button';b.disabled=!!disabled;if(fn)b.addEventListener('click',fn);return b};
  const localSave=()=>{try{return JSON.parse(localStorage.getItem('cubeEscapeSave')||'{}')||{}}catch{return {}}};
  const oldButtons=()=>[...lv.querySelectorAll('button')];
  const press=reg=>{const b=oldButtons().find(x=>reg.test(x.textContent));if(b&&!b.disabled)b.click()};
  let selectedLevel=null,scheduled=false,showArt=true;
  async function landscapeFullscreen(){
    try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch{}
    try{if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch{}
  }
  function render(){
    const active=ov.style.display!=='none'&&title.textContent.trim()==='LIMBYRINTH';
    ov.classList.toggle('home-on',active);home.style.display=active?'block':'none';
    home.classList.toggle('hm-art-only',showArt);
    if(!active)return;
    const sv=localSave(),coins=+sv.coins||0,earned=+sv.earned||0;
    let rank=RANKS[0][0];for(const [name,threshold] of RANKS)if(earned>=threshold)rank=name;
    const buttons=oldButtons();
    const modeTxt=buttons.find(b=>/joueur|En ligne/.test(b.textContent)&&!/Jouer en ligne/.test(b.textContent))?.textContent||'';
    const online=/En ligne/.test(modeTxt)||buttons.some(b=>/Quitter le salon/.test(b.textContent));
    const duo=/^2 joueurs/.test(modeTxt);
    const levels=buttons.map(b=>{const m=b.textContent.match(/Niveau (\d+)\s*:\s*(.+)$/);return m?{i:+m[1]-1,name:m[2].trim(),locked:/🔒/.test(b.textContent),off:b.disabled}:null}).filter(Boolean);
    const unlocked=levels.filter(l=>!l.off);
    const next=unlocked.at(-1)||levels[0]||null;
    const chosen=(selectedLevel!==null?levels.find(l=>l.i===selectedLevel&&!l.off):null)||next;
    const guest=online && levels.length>0 && levels.every(l=>l.off) && !buttons.some(b=>/Boutique/.test(b.textContent));
    const hasPseudo=!!window.LimbyrinthFriends?.hasProfile?.();
    let hasToken=false;try{hasToken=!!localStorage.getItem('limbyrinthSocialTokenV1')}catch{}
    const stage=STAGES[chosen?.i||0];

    const header=el('header','hm-top',null,[
      el('span','hm-overline','CORE // TERMINAL D’ACCÈS'),
      btn('hm-art-preview',showArt?'◀ Retour au menu':'◉ Voir le fond',()=>{
        showArt=!showArt;home.classList.toggle('hm-art-only',showArt);
        const control=home.querySelector('.hm-art-preview');
        if(control)control.textContent=showArt?'◀ Retour au menu':'◉ Voir le fond';
      }),
      el('div','hm-meta',null,[
        el('span','hm-chip','◈ '+rank),
        el('span','hm-chip',null,[el('span',null,'PIÈCES '),el('b',null,String(coins))])
      ])
    ]);
    const hero=el('section','hm-hero',null,[
      el('span','hm-eyebrow','PROTOCOLE D’ÉVASION'),
      el('h1','hm-h1',null,[el('span',null,'LIMBY'),el('em',null,'RINTH')]),
      el('p','hm-tag',guest?'Partie en ligne : attends que ton ami lance la mission.':'Explore le complexe. Échappe à CORE. Survis aux vagues.')
    ]);
    const preview=el('div','hm-preview',null,[
      el('div','hm-preview-copy',null,[
        el('span','hm-kicker','SECTEUR '+((chosen?.i||0)+1)+' / 05'),
        el('strong','hm-preview-name',stage.name),
        el('span','hm-preview-description',stage.hint)
      ])
    ]);
    preview.style.setProperty('--accent',stage.color);
    hero.appendChild(preview);
    if(!guest && chosen){
      const play=btn('hm-play',null,()=>press(new RegExp('Niveau '+(chosen.i+1)+'\\b')));
      play.append(el('span',null,hasPseudo?'▶  JOUER':'▶  COMMENCER'),el('small',null,'Niveau '+(chosen.i+1)+' · '+(chosen.i===4?'Survie infinie':chosen.name)));
      play.dataset.play='1';hero.appendChild(play);
    }
    hero.appendChild(el('p','hm-auth-hint'+(hasPseudo?' ok':''),
      hasPseudo?'✓ Pseudo confirmé · prêt à jouer':hasToken?'Pseudo enregistré · vérification avant de jouer':'Pseudo obligatoire · crée ton profil pour jouer'));
    if(sv.lastRun&&typeof sv.lastRun.title==='string'){
      hero.appendChild(el('div','hm-last-run',null,[
        el('span',null,'◈'),
        el('div',null,null,[
          el('strong',null,'DERNIÈRE PARTIE · '+sv.lastRun.title),
          el('span',null,'Niveau '+sv.lastRun.level+' · '+sv.lastRun.score+' pts'+(sv.lastRun.details?' · '+sv.lastRun.details:''))
        ])
      ]));
    }
    const kit=window.LimbyrinthRobotKits?.[sv.robot||'rclassic'];
    hero.appendChild(el('div','hm-survival-card',null,[
      el('b',null,'♾ SURVIE · '),
      el('span',null,'Vague 50 : Spectre · Vague 100 : Souverain · Record '+(sv.survivalMaxWave||0)),
      ...(kit?[el('div','hm-kit','⚡ '+kit.basic+'  /  ULTI : '+kit.ulti)]:[])
    ]));
    const panel=el('section','hm-panel');
    const modeBlock=el('div','hm-panel-block hm-mode-section',null,[el('div','hm-panel-title','01  ·  CHOISIS TON MODE')]);
    if(!online){
      const seg=el('div','hm-mode-options hm-seg');
      const mode=(on,symbol,label,cb,disabled=false)=>{
        const b=btn(on?'on':'',null,cb,disabled);
        b.setAttribute('aria-pressed',String(on));
        b.append(el('span','hm-mode-icon',symbol),el('span','hm-mode-label',label));
        if(disabled)b.title='Nécessite un clavier à deux joueurs';
        return b;
      };
      seg.append(mode(!duo,'◉','SOLO',()=>{if(duo)press(/joueurs/)}),
        mode(duo,'◈','COOP LOCALE',()=>{if(!duo)press(/1 joueur/)},tactile),
        mode(false,'◎','EN LIGNE',()=>press(/Jouer en ligne/)));
      modeBlock.appendChild(seg);
    } else {
      modeBlock.appendChild(el('p','hm-auth-hint ok',guest?'Salon connecté · en attente de l’hôte':'Salon connecté · choisis ton niveau'));
    }
    panel.appendChild(modeBlock);
    const levelBlock=el('div','hm-panel-block',null,[el('div','hm-panel-title','02  ·  CHOISIS TON NIVEAU')]);
    const levelGrid=el('div','hm-level-grid');
    for(const lvInfo of levels){
      const st=STAGES[lvInfo.i]||STAGES[0],sel=chosen?.i===lvInfo.i;
      const node=btn('hm-sec'+(lvInfo.i===4?' survival-special':'')+(sel?' is-selected':''),null,()=>{
        selectedLevel=lvInfo.i;render();
      },lvInfo.off);
      node.style.setProperty('--accent',st.color);
      node.setAttribute('aria-pressed',String(!!sel));
      node.setAttribute('aria-label','Choisir niveau '+(lvInfo.i+1)+' : '+lvInfo.name);
      node.append(el('span','hm-num','NIV. '+(lvInfo.i+1)),
        el('span','hm-thumb hm-thumb-'+(lvInfo.i+1)),
        el('b',null,st.name),
        el('span','hm-tagb'+(lvInfo.locked?' lock':sel?' chosen':''),lvInfo.locked?'VERROUILLÉ':sel?'✓ CHOISI':'CHOISIR'));
      levelGrid.appendChild(node);
    }
    levelBlock.appendChild(levelGrid);panel.appendChild(levelBlock);
    const actionRow=el('nav','hm-row',null,[
      btn('hm-btn hm-friends-button','♙  Pseudo',()=>window.LimbyrinthFriends?.open()),
      btn('hm-btn hm-scores-button','🏆  Scores',()=>window.LimbyrinthScores?.open()),
      btn('hm-btn gold','◈  Boutique',()=>press(/Boutique/),guest),
      btn('hm-btn viol',online?'↩ Quitter salon':'◎  En ligne',
        ()=>press(online?/Quitter le salon/:/Jouer en ligne/))
    ]);
    panel.appendChild(actionRow);
    const extra=el('div','hm-actions-extra');
    const settings=el('details','hm-updates-details hm-update-box');
    settings.id='hm-settings';
    settings.appendChild(el('summary',null,'⚙ Paramètres d’affichage'));
    const settingsBody=el('div','hm-update-content');
    const motionLabel=el('label','hm-update-line');
    const motionToggle=document.createElement('input');
    motionToggle.type='checkbox';
    motionToggle.checked=localStorage.getItem('limbyrinth-reduce-motion')==='1';
    motionToggle.style.marginRight='10px';
    motionLabel.append(motionToggle,document.createTextNode('Réduire les animations du menu'));
    const applyMotion=()=>{document.documentElement.classList.toggle('hm-motion-reduced',motionToggle.checked);};
    motionToggle.addEventListener('change',()=>{localStorage.setItem('limbyrinth-reduce-motion',motionToggle.checked?'1':'0');applyMotion();});
    applyMotion();
    settingsBody.append(motionLabel,el('div','hm-update-line','Son : touche M pendant une partie · Pause : touche P'));
    settings.appendChild(settingsBody);
    extra.appendChild(settings);
    const details=el('details','hm-updates-details hm-update-box hm-info-combined');
    const keys=tactile?'Joystick : bouger · Tir : viser · DASH · ULTI · Vue':'ZQSD : bouger · Clic : tirer · Maj : dash · U : ulti · I : ulti du joueur 2';
    details.append(el('summary',null,'ⓘ Infos · Commandes · Donner mon avis'),
      el('div','hm-update-content',null,[
        el('div','hm-update-line','Niveau 5 · Survie infinie : relais tactiques, skins aux vagues 50 et 100.'),
        el('div','hm-update-line','Chaque robot possède un tir unique et une capacité ultime.'),
        el('div','hm-update-line',keys),
        btn('hm-btn hm-feedback-button','💬 Donner mon avis / signaler un bug',()=>window.LimbyrinthFeedback?.open('idea')),
        btn('hm-btn hm-feedback-card','▣ Répondre au sondage',()=>window.LimbyrinthFeedback?.open('poll'))
      ]));
    extra.append(details);
    if(tactile)extra.append(btn('hm-fullscreen-button','⛶ PAYSAGE',landscapeFullscreen));
    panel.appendChild(extra);
    shell.replaceChildren(header,el('main','hm-main',null,[hero,panel]));
  }
  const refresh=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render()})};
  const mo=new MutationObserver(refresh);
  mo.observe(lv,{childList:true,subtree:true,characterData:true});
  mo.observe(title,{childList:true,subtree:true,characterData:true});
  mo.observe(ov,{attributes:true,attributeFilter:['style']});
  if($('d'))mo.observe($('d'),{childList:true,subtree:true,characterData:true});
  render();
})();
