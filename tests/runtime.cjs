// The game and all Three.js geometry run unchanged. Only the DOM and GPU boundary
// are replaced when Chromium cannot create sockets in the execution sandbox.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');
function runtime(initialSave = {}) {
  const THREE = { ...require('../vendor/three.min.js') };
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.style = {setProperty(k,v){this[k]=v;}}; this.classList = {toggle(){},add(){},remove(){}}; this.attrs={}; this.innerHTML=''; this.textContent=''; this.listeners={}; }
    appendChild(e){this.children.push(e);return e;} prepend(e){this.children.unshift(e);} append(...es){this.children.push(...es);} remove(){} replaceChildren(...es){this.children=es;}
    addEventListener(k,fn){(this.listeners[k] ||= []).push(fn);} setAttribute(k,v){this.attrs[k]=v;} getAttribute(k){return this.attrs[k];} focus(){} setPointerCapture(){}
    querySelector(s){return this.children.find(e=>e.id===s.slice(1)) || (this.children.push(Object.assign(new Element(), {id:s.slice(1)})), this.children.at(-1));}
    querySelectorAll(s){if(s==='i')return Array.from({length:3},()=>new Element('i'));return [];}
    cloneNode(){return new Element();} getBoundingClientRect(){return {left:0,top:0,width:256,height:200};}
  }
  const warnings=[];
  const elements = new Map();
  const document={body:new Element('body'),getElementById(id){if(!elements.has(id))elements.set(id,Object.assign(new Element(),{id}));return elements.get(id);},createElement(tag){if(tag==='canvas'){const el=new Element(tag); const canvas=createCanvas(256,256);el.getContext=()=>canvas.getContext('2d');return el;}return new Element(tag);}};
  const radar=createCanvas(112,112);document.getElementById('mm').getContext=()=>radar.getContext('2d');
  THREE.WebGLRenderer=class{constructor(){this.domElement=document.createElement('canvas');this.info={memory:{geometries:0,textures:0},render:{calls:0}};}setPixelRatio(){}setSize(){}render(){}setClearColor(){}dispose(){} };
  const storage=new Map(Object.entries(initialSave)); const listeners={};
  const context=vm.createContext({THREE,document,console:{...console,warn:(...args)=>warnings.push(args.join(" ")),error:(...args)=>warnings.push(args.join(" "))},innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance,Math,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame(){},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},addEventListener(k,f){(listeners[k] ||= []).push(f);},dispatchEvent(e){for(const f of listeners[e.type]||[])f({...e,target:e.target||document.body,preventDefault(){}});},KeyboardEvent:class{constructor(type,opts){this.type=type;Object.assign(this,opts);}},AudioContext:class{constructor(){throw Error('audio disabled in tests');}}});
  context.window=context;
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1].replace('loop();\n})();','window.gameEval = code => eval(code); loop();\n})();');
  vm.runInContext(source,context,{filename:'index.html'});
  return {run:code=>{const data=context.gameEval(code);return data===undefined?undefined:JSON.parse(JSON.stringify(data));},context,storage,radar,warnings};
}
module.exports={runtime};
