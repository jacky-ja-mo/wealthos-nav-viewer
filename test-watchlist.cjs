const test=require('node:test');
const assert=require('node:assert/strict');
const w=require('./watchlist.js');
const base={name:'某行稳健理财',code:'TEST123',kind:'wealth',manager:'某某理财公司',platform:'某银行'};
test('cross-manager products can be followed without false automatic coverage',()=>{
  const items=w.add([],base);
  assert.equal(items.length,1);assert.equal(w.mode(items[0]),'pending');
  assert.equal(w.mode(w.BUILTIN),'auto');
  assert.equal(w.mode({...base,manager:'北银理财有限责任公司'}),'on_demand');
});
test('name-only fund products are accepted',()=>{
  assert.equal(w.add([],{name:'示例基金',kind:'fund'}).length,1);
});
test('duplicate identity uses manager rather than sales platform',()=>{
  const first=w.add([],base);
  assert.throws(()=>w.add(first,{...base,platform:'另一销售银行'}),/已经/);
  assert.equal(w.add(first,{...base,manager:'另一家公司'}).length,2);
});
test('unsafe official links and malformed codes are rejected',()=>{
  assert.throws(()=>w.normalize({...base,sourceUrl:'javascript:alert(1)'}),/HTTPS/);
  assert.throws(()=>w.normalize({...base,sourceUrl:'https://bob:secret@example.com'}),/HTTPS/);
  assert.throws(()=>w.normalize({...base,code:'<script>'}),/代码/);
});
test('only public identity metadata gets persisted',()=>{
  const memory=new Map();
  const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const list=w.add([],{...base,shares:1000,costAmount:2000,token:'secret'});
  w.save(storage,list);
  assert.deepEqual(w.load(storage),list);
  assert.doesNotMatch(memory.get(w.KEY),/shares|costAmount|secret/);
});
test('corrupt local storage is not overwritten by a failed load',()=>{
  const memory=new Map([[w.KEY,'{not json']]);
  const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  assert.throws(()=>w.load(storage),/读取失败/);
  assert.equal(memory.get(w.KEY),'{not json');
});
