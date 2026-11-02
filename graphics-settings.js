/* Quality preferences are independent from saves, accounts and network packets. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else{
    let storage;try{storage=root.localStorage;}catch(_){}
    root.LimbyrinthGraphics=factory({storage,document:root.document,coarse:root.matchMedia('(pointer:coarse)').matches,
      onChange:value=>root.dispatchEvent(new CustomEvent('corequalitychange',{detail:value}))});
  }
})(typeof window!=='undefined'?window:globalThis,function createGraphics({storage,document,coarse=false,onChange=()=>{}}={}){
  const key='limbyrinthCoreQualityV1',valid=['low','medium','high'];let current=coarse?'low':'medium';
  try{const saved=storage?.getItem(key);if(valid.includes(saved))current=saved;}catch(_){}
  function read(){return current;}
  function save(value){
    if(!valid.includes(value))return false;
    current=value;try{storage?.setItem(key,value);}catch(_){}
    onChange(value);return true;
  }
  function createControl(){
    const label=document.createElement('label');label.className='hm-quality';
    const caption=document.createElement('span');caption.textContent='Qualité';label.appendChild(caption);
    const select=document.createElement('select');select.setAttribute('aria-label','Qualité graphique');
    for(const [value,title]of [['low','Faible'],['medium','Moyen'],['high','Élevé']]){
      const option=document.createElement('option');option.value=value;option.textContent=title;select.appendChild(option);
    }
    select.value=read();select.addEventListener('change',()=>save(select.value));label.appendChild(select);return label;
  }
  return {read,save,createControl};
});
