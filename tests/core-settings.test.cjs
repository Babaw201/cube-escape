const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../graphics-settings.js');
test('quality defaults and storage failure are safe on modest devices',()=>{
  assert.equal(create({coarse:true}).read(),'low');assert.equal(create().read(),'medium');
  assert.equal(create({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}}).read(),'medium');
});
test('persist only supported quality choices and notify without reloading gameplay',()=>{
  const values=new Map();let changed=0;
  const settings=create({storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},onChange:()=>changed++});
  assert.equal(settings.save('high'),true);assert.equal(settings.read(),'high');assert.equal(changed,1);
  assert.equal(settings.save('ultra'),false);assert.equal(settings.read(),'high');assert.equal(changed,1);
});
