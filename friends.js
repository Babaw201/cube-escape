/* Limbyrinth: pseudonyms + friends backed by Cloudflare. */
(function () {
  'use strict';
  const BASE='https://limbyrinth-online.baptiste-werner.workers.dev';
  const AUTH='limbyrinthSocialTokenV1';
  const ui=document.createElement('section');
  ui.id='friends-screen';ui.hidden=true;
  ui.setAttribute('role','dialog');ui.setAttribute('aria-modal','true');ui.setAttribute('aria-label','Profil et amis');
  const css=document.createElement('style');
  css.textContent=[
    '#friends-screen[hidden]{display:none!important}',
    '#friends-screen{position:fixed;inset:0;z-index:30;overflow:auto;background:radial-gradient(ellipse at 30% 0%,#1a4053,#081422 55%,#04070d);color:#e6f4ff;font-family:Trebuchet MS,Segoe UI,system-ui,sans-serif}',
    '#friends-screen *{box-sizing:border-box}',
    '.fr-wrap{width:min(960px,100%);margin:0 auto;padding:calc(24px + env(safe-area-inset-top,0px)) 15px calc(35px + env(safe-area-inset-bottom,0px))}',
    '.fr-top,.fr-actions,.fr-line,.fr-form{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}',
    '.fr-top{margin-bottom:20px}.fr-title{font-size:clamp(29px,6vw,52px);color:#8ff3ff;margin:0;letter-spacing:.07em}',
    '.fr-sub{font-size:13px;color:#9abbd0;line-height:1.55}',
    '.fr-card{background:rgba(11,31,47,.85);border:1px solid #345d74;padding:18px;border-radius:16px;margin:14px 0}',
    '.fr-card h2{margin:0 0 14px;font-size:17px;color:#b8e8fa}',
    '.fr-form{justify-content:flex-start}.fr-form input{background:#0c2335;border:1px solid #43728c;border-radius:10px;color:#fff;padding:12px;font-size:16px;min-width:160px;width:min(100%,260px);-webkit-user-select:text;user-select:text}',
    '.fr-btn{margin:0;padding:10px 14px;background:#1c4f64;color:#e6f4ff;border:1px solid #4d8294;border-radius:10px;font:700 13px system-ui,sans-serif;box-shadow:none;cursor:pointer}',
    '.fr-btn:hover{background:#286b81;transform:none}.fr-btn:focus-visible{outline:2px solid #90f9d9;outline-offset:2px}',
    '.fr-primary{background:#2a9676;border-color:#57cba5;color:#081d17}.fr-danger{background:#583047;border-color:#a15c79}',
    '.fr-line{border-top:1px solid #21435b;padding:11px 0;justify-content:space-between}.fr-line:first-of-type{border-top:0}',
    '.fr-player{font-weight:700;overflow-wrap:anywhere}.fr-hint{font-size:12px;color:#8eaec0;line-height:1.5}',
    '.fr-status{min-height:22px;color:#8ff3ff;font-size:14px}.fr-error{color:#ffbac6}.fr-empty{font-size:13px;color:#a1b9c8;padding:5px 0}',
    '.fr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
    '@media(max-width:700px){.fr-grid{grid-template-columns:1fr}.fr-card{padding:14px}.fr-line{align-items:flex-start;flex-direction:column}}'
  ].join('\n');
  document.head.appendChild(css);document.body.appendChild(ui);
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const button=(txt,fn,cls='fr-btn')=>{const b=el('button',cls,txt);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
  const box=(title)=>{const b=el('div','fr-card');b.appendChild(el('h2','',title));return b;};
  const token=()=>{try{return localStorage.getItem(AUTH)||'';}catch{return '';}};
  let profile=null,busy=false,lastFocus=null,notice='',isError=false;
  let pendingPlay=null, checkingProfile=null;
  async function api(path,method='GET',body=null,hasAuth=true,authOverride) {
    const headers={'Accept':'application/json'};
    if(body!==null)headers['Content-Type']='application/json';
    if(hasAuth)headers.Authorization='Bearer '+(authOverride===undefined?token():authOverride);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const res=await fetch(BASE+'/social/'+path,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Action indisponible.');
      return data;
    }finally{clearTimeout(timeout);}
  }
  function alertMessage(message,err=false){notice=message;isError=err;const status=document.getElementById('fr-status');if(status){status.textContent=notice;status.classList.toggle('fr-error',err);}}
  async function act(path,body,message) {
    if(busy)return;busy=true;alertMessage('Enregistrement…');
    try{await api(path,'POST',body);notice=message;isError=false;await refresh(false);}
    catch(err){alertMessage(err.message||'Connexion impossible.',true);}
    finally{busy=false;}
  }
  async function refresh(notify=true) {
    if(!token()){profile=null;render();return;}
    try{profile=await api('me');if(notify){notice='Liste actualisée.';isError=false;}render();}
    catch(err){profile=null;notice=err.message||'Service des amis indisponible.';isError=true;render();}
  }
  function close(){ui.hidden=true;if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});}
  function open(){if(ui.hidden)lastFocus=document.activeElement;ui.hidden=false;render();if(token()&&!profile)void refresh(false);}
  // Une clé d'accès est le jeton aléatoire émis lors de la création du pseudo.
  // Elle n'est JAMAIS envoyée en dehors du service d'authentification.
  const validAccessKey=value=>/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(value);
  async function restoreAccount(accessKey){
    if(busy)return;
    const code=accessKey.trim();
    if(!validAccessKey(code)){alertMessage('Code d’accès invalide. Recopie la clé entière fournie lors de la sauvegarde.',true);return;}
    busy=true;alertMessage('Vérification du compte…');
    try{
      // Le code est validé AVANT son enregistrement local : personne ne peut
      // reprendre un pseudo simplement en le tapant.
      const verified=await api('me','GET',null,true,code);
      if(!verified || typeof verified.pseudo!=='string')throw Error('Profil non reconnu.');
      localStorage.setItem(AUTH,code);
      profile=verified;notice='Compte '+verified.pseudo+' reconnecté !';isError=false;
      render();continuePending();
    }catch(err){alertMessage(err.message||'Code refusé ou connexion indisponible.',true);}
    finally{busy=false;}
  }
  function recoveryForm(){
    const card=box('🔑 Retrouver mon ancien pseudo');
    const form=el('form','fr-form'),field=el('input');
    field.type='password';field.autocomplete='off';field.placeholder='Code d’accès sauvegardé';
    field.setAttribute('aria-label','Code de reconnexion');
    const submit=button('Se reconnecter',null,'fr-btn fr-primary');submit.type='submit';
    form.append(field,submit);form.addEventListener('submit',e=>{e.preventDefault();void restoreAccount(field.value);});
    card.append(form,el('p','fr-hint','Le pseudo seul ne suffit pas : il faut la clé enregistrée depuis le compte. Ne partage jamais cette clé. Si elle a été perdue, la récupération automatique de cet ancien compte n’est pas possible.'));
    return card;
  }
  function backupAccess(){
    const card=box('🔐 Garder l’accès à ton pseudo');
    const field=el('input');field.type='password';field.readOnly=true;field.autocomplete='off';
    field.value=token();field.setAttribute('aria-label','Ta clé secrète de reconnexion');
    field.style.cssText='width:min(100%,500px);font:12px monospace;overflow:hidden';
    const reveal=button('Afficher / masquer',()=>{field.type=field.type==='password'?'text':'password';});
    const copy=button('Copier mon code d’accès',async()=>{
      try {
        if(!navigator.clipboard?.writeText)throw Error();
        await navigator.clipboard.writeText(token());
        alertMessage('Clé copiée. Conserve-la dans un gestionnaire de mots de passe et ne la partage pas.');
      }catch(e){
        field.type='text';field.focus();field.select();
        alertMessage('Copie la clé sélectionnée avec Ctrl+C, puis conserve-la en lieu sûr.');
      }
    },'fr-btn fr-primary');
    const actions=el('div','fr-actions');actions.append(copy,reveal);
    card.append(el('p','fr-hint','Ce code permet de te reconnecter sur un autre navigateur ou après une déconnexion. Il donne accès à ton compte : ne le partage jamais.'),field,actions);
    return card;
  }
  function hasProfile(){return !!(token() && profile && typeof profile.pseudo==='string' && profile.pseudo.trim());}
  // Un compte avec un pseudo actif est obligatoire pour commencer une partie.
  // L'ancienne connexion est revérifiée côté serveur au premier lancement.
  function continuePending(){
    if(!hasProfile() || !pendingPlay) return;
    const action=pendingPlay;pendingPlay=null;close();action();
  }
  function requireProfile(action){
    if(hasProfile()){action();return true;}
    pendingPlay=action;
    if(!token()){
      notice='Pour jouer, reconnecte ton ancien pseudo avec son code d’accès ou crée un nouveau profil.';
      isError=false;open();return false;
    }
    if(checkingProfile)return false;
    checkingProfile=(async()=>{
      try{
        profile=await api('me');
        if(hasProfile()){continuePending();return;}
        notice='Ton profil est introuvable. Crée un nouveau pseudo.';isError=true;
      }catch(error){
        profile=null;notice='Profil à vérifier : '+(error.message||'connexion impossible')+'.';
        isError=true;
      }finally{
        checkingProfile=null;
        if(!hasProfile())open();
      }
    })();
    return false;
  }
  function playersSection(title,items,kind) {
    const b=box(title);
    if(!items.length)b.appendChild(el('p','fr-empty','Aucun joueur pour le moment.'));
    for(const item of items){
      const name=typeof item==='string'?item:item.pseudo;
      const row=el('div','fr-line'),label=el('span','fr-player',name),actions=el('div','fr-actions');
      if(kind==='friend'){
        actions.append(button('🎮 Inviter',()=>inviteFriend(name),'fr-btn fr-primary'));
        actions.append(button('Retirer',()=>act('remove',{pseudo:name},name+' retiré de tes amis.')));
        actions.append(button('Bloquer',()=>{if(confirm('Bloquer '+name+' ?'))act('block',{pseudo:name},name+' bloqué.');},'fr-btn fr-danger'));
      }
      if(kind==='incoming'){
        actions.append(button('Accepter',()=>act('respond',{pseudo:name,accept:true},name+' ajouté à tes amis.'),'fr-btn fr-primary'));
        actions.append(button('Refuser',()=>act('respond',{pseudo:name,accept:false},'Demande refusée.')));
        actions.append(button('Bloquer',()=>act('block',{pseudo:name},name+' bloqué.'),'fr-btn fr-danger'));
      }
      if(kind==='outgoing')actions.append(button('Annuler',()=>act('cancel',{pseudo:name},'Demande annulée.')));
      if(kind==='blocked')actions.append(button('Débloquer',()=>act('unblock',{pseudo:name},name+' débloqué.')));
      if(kind==='invite'){
        label.textContent=name+' t’invite à jouer';
        actions.append(button('Rejoindre',()=>{
          if(!window.LimbyrinthJoinFromFriends){alertMessage('Le jeu en ligne est indisponible.',true);return;}
          if(!window.LimbyrinthJoinFromFriends(item.room)){alertMessage('Quitte ton salon actuel avant de rejoindre ton ami.',true);return;}
          close();
        },'fr-btn fr-primary'));
      }
      row.append(label,actions);b.appendChild(row);
    }
    return b;
  }
  function render() {
    const wrap=el('div','fr-wrap'),top=el('div','fr-top'),heading=el('div');
    heading.append(el('h1','fr-title','AMIS & PROFIL'),el('p','fr-sub','Un pseudo unique pour jouer et retrouver tes amis.'));
    const actions=el('div','fr-actions');actions.append(button('← Retour',close),button('↻ Actualiser',()=>refresh()));
    top.append(heading,actions);wrap.appendChild(top);
    const status=el('p','fr-status'+(isError?' fr-error':''),notice);
    status.id='fr-status';status.setAttribute('role','status');wrap.appendChild(status);
    if(!profile){
      if(token()){
        const waiting=box('Connexion à ton ancien profil');
        waiting.append(el('p','fr-hint','Une clé de compte est déjà enregistrée ici. Ne crée pas un autre pseudo : réessaie la connexion. Si Internet est indisponible, tes données restent intactes.'));
        waiting.append(button('↻ Réessayer ma connexion',()=>void refresh(false),'fr-btn fr-primary'));
        waiting.append(button('Changer de compte (déconnexion)',()=>{
          if(confirm('Attention : le pseudo précédent deviendra inaccessible sans son code d’accès sauvegardé. Continuer ?')){
            localStorage.removeItem(AUTH);profile=null;notice='Compte déconnecté. Reconnecte-le avec sa clé sauvegardée.';isError=false;render();
          }
        },'fr-btn fr-danger'));
        wrap.appendChild(waiting);ui.replaceChildren(wrap);return;
      }
      wrap.appendChild(recoveryForm());
      const reg=box('Créer un NOUVEAU profil'),form=el('form','fr-form'),field=el('input');
      field.placeholder='Pseudo (ex. Robot32)';field.maxLength=16;field.minLength=3;field.required=true;
      field.pattern='[A-Za-z][A-Za-z0-9_]{2,15}';field.autocomplete='off';field.setAttribute('aria-label','Ton pseudo');
      const submit=button('Créer mon pseudo',null,'fr-btn fr-primary');submit.type='submit';
      form.append(field,submit);
      form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy)return;busy=true;
        try{
          const created=await api('register','POST',{pseudo:field.value.trim()},false);
          localStorage.setItem(AUTH,created.token);notice='Bienvenue '+created.pseudo+' ! Pense à sauvegarder ta clé de reconnexion.';isError=false;await refresh(false);continuePending();
        }catch(err){alertMessage(err.message||'Impossible de créer ton profil.',true);}
        finally{busy=false;}
      });
      reg.append(form,el('p','fr-hint','Si tu avais déjà un pseudo, utilise « Retrouver mon ancien pseudo » au-dessus : ce formulaire crée un compte différent. N’utilise pas ton vrai nom.'));
      wrap.appendChild(reg);ui.replaceChildren(wrap);return;
    }
    const me=box('Mon profil');
    const own=el('p','fr-player','👤 '+profile.pseudo);
    const rename=el('form','fr-form'),input=el('input');
    input.placeholder='Nouveau pseudo';input.maxLength=16;input.minLength=3;input.pattern='[A-Za-z][A-Za-z0-9_]{2,15}';input.setAttribute('aria-label','Nouveau pseudo');
    const renameSubmit=button('Modifier',null);renameSubmit.type='submit';rename.append(input,renameSubmit);
    rename.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim())act('rename',{pseudo:input.value.trim()},'Pseudo modifié.');});
    me.append(own,rename,el('p','fr-hint','Ne communique pas ton vrai nom ou tes coordonnées. Sauvegarde ton code d’accès pour retrouver ce profil.'));
    const add=el('form','fr-form'),target=el('input');target.placeholder='Pseudo exact';target.maxLength=16;target.setAttribute('aria-label','Pseudo de l’ami à ajouter');
    const submit=button('Envoyer une demande',null,'fr-btn fr-primary');submit.type='submit';
    add.append(target,submit);add.addEventListener('submit',e=>{e.preventDefault();if(target.value.trim())act('request',{pseudo:target.value.trim()},'Demande envoyée à '+target.value.trim()+'.');});
    me.append(el('h2','','Ajouter un ami'),add,el('p','fr-hint','Recherche par pseudo exact, sans annuaire public. Ton ami doit accepter.'));
    wrap.appendChild(me);
    const grid=el('div','fr-grid');
    grid.append(playersSection('👥 Mes amis ('+profile.friends.length+')',profile.friends,'friend'),
      playersSection('📨 Demandes reçues ('+profile.incoming.length+')',profile.incoming,'incoming'),
      playersSection('⏳ En attente ('+profile.outgoing.length+')',profile.outgoing,'outgoing'),
      playersSection('🎮 Invitations ('+profile.invites.length+')',profile.invites,'invite'));
    wrap.appendChild(grid);
    wrap.appendChild(backupAccess());
    const extra=box('Sécurité et compte');
    if(profile.blocked.length)extra.appendChild(playersSection('Joueurs bloqués',profile.blocked,'blocked'));
    extra.appendChild(button('Déconnecter cet appareil',()=>{
      if(confirm('Retirer la connexion ? Sauvegarde d’abord ton code d’accès ci-dessus, sinon tu pourrais perdre définitivement cet ancien pseudo.')){localStorage.removeItem(AUTH);profile=null;notice='Déconnecté. Tu peux te reconnecter avec ta clé sauvegardée.';render();}
    },'fr-btn fr-danger'));
    extra.appendChild(el('p','fr-hint','Pas d’annuaire public ni de messagerie privée. Les invitations expirent après 15 minutes.'));
    wrap.appendChild(extra);ui.replaceChildren(wrap);
  }
  async function inviteFriend(pseudo) {
    if(!window.LimbyrinthFriendsLaunch){alertMessage('Le multijoueur est indisponible.',true);return;}
    if(!window.LimbyrinthFriendsLaunch(pseudo)){alertMessage('Quitte ton salon avant d’en créer un autre.',true);return;}
    close();
  }
  async function sendInvite(pseudo,room) {
    try{await api('invite','POST',{pseudo,room});return true;}
    catch(err){alertMessage('Salon créé, mais invitation non envoyée : '+err.message,true);return false;}
  }
  ui.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();}});
  window.LimbyrinthFriends={open,close,refresh,sendInvite,hasProfile,requireProfile};
  // Précharge la session sauvegardée au lieu de redemander un pseudo à chaque visite.
  if(token())void refresh(false);
})();