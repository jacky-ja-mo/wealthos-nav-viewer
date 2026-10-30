const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');
const fs=require('node:fs');const path=require('node:path');const {webcrypto}=require('node:crypto');
const dir=__dirname;
const ids=['shares','cost','vaultStatus','vaultPasswordArea','vaultConfirmArea','vaultCreate','vaultUnlock','vaultSave','vaultLock','vaultExport','vaultPassword','vaultConfirm','vaultFile','backupPassword','vaultImport','vaultDelete'];
function harness(storageMap=new Map()){
  const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',hidden:false,className:'',textContent:'',files:[],listeners:{},
    addEventListener(name,fn){this.listeners[name]=fn;},async fire(name){return this.listeners[name]?.({target:this});}}]));
  const listeners={};let blob;
  const storage={getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
  const window={confirm:()=>true,addEventListener(name,fn){listeners[name]=fn;},dispatchEvent(e){return listeners[e.type]?.(e);}};
  const document={getElementById:id=>elements[id],createElement:()=>({click(){}})};
  const URL={createObjectURL:b=>(blob=b,'blob:backup'),revokeObjectURL(){}};
  const ctx={window,document,localStorage:storage,crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Blob,URL,setTimeout,Event:class {constructor(type){this.type=type;}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(dir,'vault.js'),'utf8'),ctx);ctx.WealthOSVault=window.WealthOSVault;
  vm.runInContext(fs.readFileSync(path.join(dir,'vault-ui.js'),'utf8'),ctx);
  return {elements,storageMap,window,backup:()=>blob};
}
const code='YJ01251204A',pass='temporary-test-password-1';
function select(h){h.window.dispatchEvent({type:'wealthos:product',detail:{code}});}
test('create, reload, reject wrong password, unlock and save edited holding',async()=>{
 const h=harness();select(h);h.elements.shares.value='81234.5678';h.elements.cost.value='76543.21';
 h.elements.vaultPassword.value=pass;h.elements.vaultConfirm.value=pass;await h.elements.vaultCreate.fire('click');
 const raw=[...h.storageMap.values()][0];assert.ok(raw&&!raw.includes('81234.5678')&&!raw.includes('76543.21'));
 assert.equal(h.elements.vaultSave.hidden,false);assert.match(h.elements.vaultStatus.textContent,/已加密保存/);
 const h2=harness(h.storageMap);select(h2);assert.equal(h2.elements.shares.value,'');
 h2.elements.vaultPassword.value='wrong-password-000';await h2.elements.vaultUnlock.fire('click');
 assert.match(h2.elements.vaultStatus.textContent,/密码不正确/);assert.equal(h2.elements.shares.value,'');
 h2.elements.vaultPassword.value=pass;await h2.elements.vaultUnlock.fire('click');assert.equal(h2.elements.shares.value,'81234.5678');
 h2.elements.shares.value='99';await h2.elements.vaultSave.fire('click');
 const h3=harness(h.storageMap);select(h3);h3.elements.vaultPassword.value=pass;await h3.elements.vaultUnlock.fire('click');assert.equal(h3.elements.shares.value,'99');
 await h3.elements.vaultLock.fire('click');assert.equal(h3.elements.shares.value,'');assert.equal(h3.elements.vaultUnlock.hidden,false);
});
test('encrypted backup imports on a second device and bad passwords preserve existing data',async()=>{
 const a=harness();select(a);a.elements.shares.value='1234.56';a.elements.vaultPassword.value=pass;a.elements.vaultConfirm.value=pass;await a.elements.vaultCreate.fire('click');
 await a.elements.vaultExport.fire('click');const raw=await a.backup().text();assert.ok(!raw.includes('1234.56'));
 const b=harness();select(b);b.elements.vaultFile.files=[{size:raw.length,text:async()=>raw}];b.elements.backupPassword.value=pass;await b.elements.vaultImport.fire('click');
 assert.equal(b.elements.shares.value,'1234.56');const old=[...b.storageMap.values()][0];
 b.elements.vaultFile.files=[{size:raw.length,text:async()=>raw}];b.elements.backupPassword.value='wrong-password-000';await b.elements.vaultImport.fire('click');
 assert.equal([...b.storageMap.values()][0],old);assert.match(b.elements.vaultStatus.textContent,/密码不正确/);
});
