/* Limbyrinth - anonymous feedback form, no personal information requested. */
(function(){
  "use strict";
  const API="https://limbyrinth-online.baptiste-werner.workers.dev/feedback";
  const kinds={poll:"Sondage",idea:"Amélioration",bug:"Signaler un bug"};
  const topics=[["niveau5","Nouveaux niveaux"],["murs","Conception des murs"],["ennemis","Drones et ennemis"],["cooperation","Coopération en ligne"],["autre","Autre"]];
  const css=document.createElement("style");
  css.textContent=[
    "#feedback-screen[hidden]{display:none!important}",
    "#feedback-screen{position:fixed;inset:0;z-index:35;overflow:auto;background:radial-gradient(ellipse at 15% 0%,#173c58,#091421 48%,#04080f);color:#e7f5ff;font-family:Trebuchet MS,Segoe UI,system-ui,sans-serif}",
    "#feedback-screen *{box-sizing:border-box}",
    ".fb-container{max-width:650px;margin:0 auto;padding:calc(24px + env(safe-area-inset-top,0px)) 16px calc(35px + env(safe-area-inset-bottom,0px))}",
    ".fb-top{display:flex;justify-content:space-between;gap:16px;align-items:center}",
    ".fb-title{font-size:clamp(28px,6vw,42px);margin:0;color:#8ff3ff}",
    ".fb-card{padding:19px;border-radius:18px;border:1px solid #335b76;background:#0b2233;margin-top:22px}",
    ".fb-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.fb-tabs button{flex:1;min-width:125px}",
    ".fb-btn{padding:12px 16px;border:1px solid #46728d;border-radius:11px;background:#153b53;color:#e7f5ff;font:700 14px system-ui;cursor:pointer;margin:0;box-shadow:none}",
    ".fb-btn:hover:not(:disabled){background:#275a73;transform:none}.fb-btn:focus-visible{outline:2px solid #8ff3ff;outline-offset:2px}",
    ".fb-btn:disabled{opacity:.45}.fb-btn.on,.fb-primary{background:#2a9a7e;color:#05251d;border-color:#59ddae}",
    ".fb-description{font-size:14px;color:#b5d0e1;line-height:1.65}",
    ".fb-field{display:block;font-size:13px;font-weight:bold;margin:17px 0 7px}",
    ".fb-select,.fb-text{width:100%;border:1px solid #4c7890;border-radius:11px;background:#091a2b;color:#e7f5ff;padding:13px;font:15px system-ui;outline-offset:3px}",
    ".fb-text{min-height:132px;resize:vertical;-webkit-user-select:text;user-select:text}",
    ".fb-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:17px}",
    ".fb-status{font-size:14px;min-height:25px;color:#8ff3ff}.fb-error{color:#ffb6c6}",
    ".fb-hint{font-size:12px;line-height:1.65;color:#9cbbcd}"
  ].join("\n");
  document.head.appendChild(css);
  const root=document.createElement("section");
  root.id="feedback-screen";root.hidden=true;
  root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Sondages et suggestions");
  document.body.appendChild(root);
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const button=(txt,fn,cls="fb-btn")=>{const b=el("button",cls,txt);b.type="button";if(fn)b.addEventListener("click",fn);return b;};
  let kind="poll",lastFocus=null,busy=false;
  function close(){root.hidden=true;if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});}
  function open(next="poll"){kind=Object.hasOwn(kinds,next)?next:"poll";if(root.hidden)lastFocus=document.activeElement;root.hidden=false;render();}
  function render(){
    const wrap=el("div","fb-container"),top=el("div","fb-top");
    top.append(el("h1","fb-title","TON AVIS COMPTE"),button("← Retour",close));
    const card=el("div","fb-card"),tabs=el("div","fb-tabs");
    for(const [id,text] of [["poll","📊 Sondage"],["idea","💡 Idée"],["bug","🐛 Bug"]]){
      const b=button(text,()=>{if(!busy){kind=id;render();}},"fb-btn"+(kind===id?" on":""));
      b.setAttribute("aria-pressed",String(kind===id));tabs.appendChild(b);
    }
    card.append(tabs,el("h2","",kinds[kind]));
    card.appendChild(el("p","fb-description",kind==="poll"?"Quelle amélioration aimerais-tu voir en priorité ?":kind==="bug"?"Sur quel niveau, comment reproduire le problème ?":"Décris une amélioration que tu aimerais voir dans le jeu."));
    const form=el("form"),topicLabel=el("label","fb-field","Sujet");
    topicLabel.setAttribute("for","fb-topic");
    const select=el("select","fb-select");select.id="fb-topic";
    for(const [value,text] of topics){const opt=el("option","",text);opt.value=value;select.appendChild(opt);}
    const commentLabel=el("label","fb-field",kind==="poll"?"Commentaire (facultatif)":"Ton message");
    commentLabel.setAttribute("for","fb-comment");
    const comment=el("textarea","fb-text");comment.id="fb-comment";comment.maxLength=kind==="poll"?300:1200;
    comment.required=kind!=="poll";comment.minLength=kind==="poll"?0:10;
    comment.placeholder=kind==="bug"?"Décris ce qui s’est passé et comment reproduire le bug.":kind==="idea"?"Décris ton idée en quelques phrases…":"Pourquoi ce choix ? (facultatif)";
    form.append(topicLabel,select,commentLabel,comment);
    const actions=el("div","fb-actions"),send=button("Envoyer",null,"fb-btn fb-primary");send.type="submit";
    const status=el("p","fb-status","");status.setAttribute("role","status");actions.append(send);form.append(actions,status);
    form.addEventListener("submit",async e=>{
      e.preventDefault();if(busy)return;
      const message=comment.value.trim();
      if(kind!=="poll"&&message.length<10){status.textContent="Écris au moins 10 caractères.";return;}
      busy=true;send.disabled=true;status.textContent="Envoi…";
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
      try{
        const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,topic:select.value,message}),signal:controller.signal,cache:"no-store"});
        const data=await res.json();if(!res.ok)throw Error(data.error||"Envoi impossible.");
        status.classList.remove("fb-error");status.textContent="✅ Merci, ton retour est transmis au créateur de Limbyrinth.";comment.value="";
      }catch(err){status.classList.add("fb-error");status.textContent=err.name==="AbortError"?"Le serveur met trop de temps à répondre.":(err.message||"Erreur réseau.");}
      finally{clearTimeout(timeout);busy=false;send.disabled=false;}
    });
    card.append(form,el("p","fb-hint","N’indique pas ton vrai nom, ton adresse ni tes coordonnées. Tes réponses sont transmises au créateur ; les bugs peuvent aussi être copiés dans son salon Discord privé pour le prévenir."));
    wrap.append(top,card);root.replaceChildren(wrap);
    const selected=root.querySelector(".fb-tabs .on");if(selected)selected.focus({preventScroll:true});
  }
  root.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();close();}});
  window.LimbyrinthFeedback={open,close};
})();