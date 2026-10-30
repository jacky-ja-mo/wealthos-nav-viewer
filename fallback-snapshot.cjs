'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {validateSnapshot} = require('./nav.js');

function fallback(previous, code, attemptedAt = new Date().toISOString()) {
  const old = validateSnapshot(previous, code);
  const snapshot = {product:old.product, history:old.history, latest:old.latest,
    checked_at:old.checked_at, attempted_at:attemptedAt, update_status:'failed'};
  validateSnapshot(snapshot, code);
  return snapshot;
}
async function main() {
  const code=String(process.env.NAV_PRODUCT_CODE || '').trim().toUpperCase();
  const repo=String(process.env.NAV_PUBLIC_REPOSITORY || process.env.GITHUB_REPOSITORY || '');
  const target=process.argv[2];
  if (!/^[A-Z0-9]{6,32}$/.test(code) || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo) || !target) throw Error('fallback configuration invalid');
  const [owner, name]=repo.split('/');
  const url=`https://${owner.toLowerCase()}.github.io/${name}/snapshots/${code}.json?fresh=${Date.now()}`;
  const res=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if (!res.ok) throw Error('previous verified NAV snapshot not available');
  const value=fallback(await res.json(),code);
  fs.mkdirSync(target,{recursive:true});
  const dest=path.join(target,code+'.json'),temp=dest+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(value)); fs.renameSync(temp,dest);
  console.log('Retained previous verified official data; latest background check failed.');
}
if (require.main===module) main().catch(error=>{console.error(error.message||'fallback_failed');process.exitCode=1;});
module.exports={fallback};
