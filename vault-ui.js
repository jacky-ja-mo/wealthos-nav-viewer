(function() {
  'use strict';
  const $=id=>document.getElementById(id), storageKey='wealthos_encrypted_holdings_v1';
  let unlocked=null,selectedCode='',busy=false;
  function readStored(){try{return localStorage.getItem(storageKey);}catch{throw Error('浏览器禁止本机保存，请检查浏览器设置');}}
  function writeStored(value){try{localStorage.setItem(storageKey,JSON.stringify(value));}catch{throw Error('保存失败，请检查浏览器存储空间和设置');}}
  function message(text,error=false){$('vaultStatus').textContent=text;$('vaultStatus').className='vault-status'+(error?' error':'');}
  function controls(){
    let exists=false;try{exists=!!readStored();}catch(e){message(e.message,true);$('vaultCreate').disabled=true;$('vaultUnlock').disabled=true;return;}
    $('vaultPasswordArea').hidden=!!unlocked;
    $('vaultConfirmArea').hidden=exists;
    $('vaultCreate').hidden=exists||!!unlocked;
    $('vaultUnlock').hidden=!exists||!!unlocked;
    $('vaultSave').hidden=!unlocked;
    $('vaultLock').hidden=!unlocked;
    $('vaultExport').hidden=!exists;
    if(unlocked)message('已解锁；修改份额后请点“保存持仓更改”。');
    else if(exists)message('本机已有加密持仓，请输入保存密码解锁。');
    else message('本机尚未保存持仓；填写份额后可创建保存密码。');
  }
  function refreshEstimate(){window.dispatchEvent(new Event('wealthos:holdingchange'));}
  function restore(){
    const entry=unlocked?.entries?.[selectedCode];
    $('shares').value=entry?.shares||'';$('cost').value=entry?.cost_amount||'';
    refreshEstimate();
  }
  function entry(){
    if(!selectedCode)throw Error('请先查询产品');
    return WealthOSVault.normalizeEntries({[selectedCode]:{shares:$('shares').value,cost_amount:$('cost').value}})[selectedCode];
  }
  async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){message(e.message||'操作失败，请稍后重试',true);}finally{busy=false;}}
  $('vaultCreate').addEventListener('click',()=>run(async()=>{
    if(readStored())throw Error('已有加密资料，请先解锁');
    const record=entry(),password=$('vaultPassword').value,confirm=$('vaultConfirm').value;
    $('vaultPassword').value='';$('vaultConfirm').value='';
    if(password!==confirm)throw Error('两次输入的密码不一致');
    const created=await WealthOSVault.create(password,{[selectedCode]:record});
    writeStored(created.envelope);unlocked=created;controls();message('已加密保存到当前浏览器。请妥善保存密码和加密备份。');
  }));
  $('vaultUnlock').addEventListener('click',()=>run(async()=>{
    const stored=readStored();if(!stored)throw Error('本机没有已保存的加密资料');
    const password=$('vaultPassword').value;$('vaultPassword').value='';
    unlocked=await WealthOSVault.open(stored,password);restore();controls();message('已解锁并读取本机持仓。');
  }));
  $('vaultSave').addEventListener('click',()=>run(async()=>{
    if(!unlocked)throw Error('请先解锁本机资料');
    const entries={...unlocked.entries,[selectedCode]:entry()};
    const envelope=await WealthOSVault.seal(unlocked.key,unlocked.salt,entries);
    writeStored(envelope);unlocked.entries=WealthOSVault.normalizeEntries(entries);controls();message('已加密保存到当前浏览器。');
  }));
  $('vaultLock').addEventListener('click',()=>{
    if(!window.confirm('锁定后，未保存的修改会丢失。确定锁定吗？'))return;
    unlocked=null;$('shares').value='';$('cost').value='';refreshEstimate();controls();message('已锁定本机持仓。');
  });
  $('vaultExport').addEventListener('click',()=>run(async()=>{
    const raw=readStored();if(!raw)throw Error('本机没有可导出的加密资料');
    WealthOSVault.parseEnvelope(raw);
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='WealthOS-encrypted-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('已导出加密备份；请妥善保存备份文件和密码。');
  }));
  $('vaultImport').addEventListener('click',()=>run(async()=>{
    const file=$('vaultFile').files?.[0];if(!file||file.size>100000)throw Error('请选择不超过 100KB 的加密备份文件');
    const password=$('backupPassword').value;$('backupPassword').value='';
    const raw=await file.text();const imported=await WealthOSVault.open(raw,password);
    if(readStored()&&!window.confirm('导入会替换当前浏览器已有的加密持仓，确定继续吗？'))return;
    const parsed=JSON.parse(raw);
    const clean={format:parsed.format,version:parsed.version,kdf:parsed.kdf,iterations:parsed.iterations,cipher:parsed.cipher,salt:parsed.salt,iv:parsed.iv,ciphertext:parsed.ciphertext};
    writeStored(clean);unlocked=imported;$('vaultFile').value='';restore();controls();message('加密备份已导入并解锁。');
  }));
  $('vaultDelete').addEventListener('click',()=>{
    if(!window.confirm('这会删除当前浏览器的加密持仓。请先确认已备份；删除后无法撤销。确定删除吗？'))return;
    try{localStorage.removeItem(storageKey);unlocked=null;$('shares').value='';$('cost').value='';refreshEstimate();controls();message('已清除当前浏览器的加密资料。');}catch{message('清除失败，请检查浏览器设置',true);}
  });
  window.addEventListener('wealthos:product',event=>{
    const code=event.detail?.code||'';if(code===selectedCode)return;
    selectedCode=code;if(unlocked)restore();
  });
  controls();
})();
