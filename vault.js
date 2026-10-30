(function(root) {
  'use strict';
  const ITERATIONS=600000, AAD=new TextEncoder().encode('WealthOS encrypted holdings v1');
  const encoder=new TextEncoder(), decoder=new TextDecoder();
  function b64(bytes) {
    let s=''; for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(s);
  }
  function un64(s,max) {
    if(typeof s!=='string'||s.length>max||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('加密备份格式不正确');
    try { const raw=atob(s); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
    catch { throw Error('加密备份格式不正确'); }
  }
  function passwordCheck(password) {
    if(typeof password!=='string'||[...password].length<12||[...password].length>128)throw Error('请设置 12 至 128 个字符的保存密码');
  }
  function normalizeEntries(value) {
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>100)throw Error('持仓资料格式不正确');
    const clean=Object.create(null);
    for(const [code,entry] of Object.entries(value)) {
      if(!/^[A-Z0-9]{6,32}$/.test(code)||!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('持仓资料格式不正确');
      const shares=String(entry.shares??''), cost=entry.cost_amount==null?'':String(entry.cost_amount);
      if(shares!==''&&!/^\d{1,12}(\.\d{1,8})?$/.test(shares))throw Error('请输入有效的非负持有份额');
      if(cost!==''&&!/^\d{1,12}(\.\d{1,2})?$/.test(cost))throw Error('请输入有效的非负持仓成本');
      if(shares===''&&cost!=='')throw Error('请先输入持有份额');
      clean[code]={shares,cost_amount:cost};
    }
    return clean;
  }
  function parseEnvelope(input) {
    let v;try{v=typeof input==='string'?JSON.parse(input):input;}catch{throw Error('加密备份格式不正确');}
    if(!v||v.format!=='wealthos-vault'||v.version!==1||v.kdf!=='PBKDF2-SHA256'||v.iterations!==ITERATIONS||v.cipher!=='AES-256-GCM')throw Error('加密备份格式不正确');
    const salt=un64(v.salt,64),iv=un64(v.iv,64),ciphertext=un64(v.ciphertext,100000);
    if(salt.length!==16||iv.length!==12||ciphertext.length<16)throw Error('加密备份格式不正确');
    return {salt,iv,ciphertext};
  }
  async function derive(password,salt) {
    passwordCheck(password);
    const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function seal(key,salt,entries) {
    const holdings=normalizeEntries(entries),iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=encoder.encode(JSON.stringify({version:1,holdings}));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},key,plain);
    return {format:'wealthos-vault',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
  }
  async function create(password,entries) {
    const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive(password,salt);
    return {key,salt,entries:normalizeEntries(entries),envelope:await seal(key,salt,entries)};
  }
  async function open(input,password) {
    const {salt,iv,ciphertext}=parseEnvelope(input),key=await derive(password,salt);
    let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD},key,ciphertext);}
    catch {throw Error('密码不正确或加密资料已损坏');}
    let decoded;try{decoded=JSON.parse(decoder.decode(plain));}catch{throw Error('加密资料已损坏');}
    if(decoded?.version!==1)throw Error('加密资料格式不正确');
    return {key,salt,entries:normalizeEntries(decoded.holdings)};
  }
  root.WealthOSVault={create,open,seal,parseEnvelope,normalizeEntries};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WealthOSVault;
})(typeof window==='undefined'?globalThis:window);
