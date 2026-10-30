const test=require('node:test');const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');globalThis.crypto ||= webcrypto;
const vault=require('./vault.js');
const password='test-only-password-928';
const holdings={YJ01251204A:{shares:'81234.5678',cost_amount:'76543.21'}};

test('encrypted holdings survive reload and contain no plaintext values',async()=>{
  const created=await vault.create(password,holdings),text=JSON.stringify(created.envelope);
  assert.ok(!text.includes('81234.5678'));assert.ok(!text.includes('76543.21'));assert.ok(!text.includes('YJ01251204A'));
  const opened=await vault.open(text,password);assert.deepEqual({...opened.entries},holdings);
  const second=await vault.seal(opened.key,opened.salt,opened.entries);
  assert.notEqual(second.iv,created.envelope.iv);assert.deepEqual({...((await vault.open(second,password)).entries)},holdings);
});
test('wrong passwords and modified ciphertext cannot unlock a vault',async()=>{
  const created=await vault.create(password,holdings);
  await assert.rejects(()=>vault.open(created.envelope,'incorrect-password-123'),/密码不正确/);
  const bad={...created.envelope,ciphertext:'A'+created.envelope.ciphertext.slice(1)};
  await assert.rejects(()=>vault.open(bad,password),/密码不正确/);
});
test('import rejects malicious parameters and invalid holding data',async()=>{
  const created=await vault.create(password,holdings);
  await assert.rejects(()=>vault.open({...created.envelope,iterations:999999999},password),/格式不正确/);
  assert.throws(()=>vault.normalizeEntries({'../x':{shares:'100'}}),/格式/);
  assert.throws(()=>vault.normalizeEntries({YJ01251204A:{shares:'',cost_amount:'100'}}),/先输入/);
  await assert.rejects(()=>vault.create('weak',holdings),/12 至 128/);
});
