'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { collect, validateSnapshot } = require('./nav.js');
const code = String(process.env.NAV_PRODUCT_CODE || '').trim().toUpperCase();
const target = process.argv[2];
if (!/^[A-Z0-9]{6,32}$/.test(code) || !target) throw Error('Product code or output directory missing');
async function main() {
  const data = await collect(code);
  // Only public official product data: no user holdings, costs or secrets.
  const snapshot = { product:data.product, history:data.history, latest:data.latest, checked_at:data.checked_at, attempted_at:data.checked_at, update_status:'success' };
  validateSnapshot(snapshot, code);
  fs.mkdirSync(target, {recursive:true});
  const dest = path.join(target, code + '.json');
  const temp = dest + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(snapshot));
  fs.renameSync(temp, dest);
  console.log(JSON.stringify({ records:data.history.length, latest_date:data.latest.nav_date, checked_at:data.checked_at }));
}
main().catch(error => { console.error(error.message || 'official_collection_failed', error.cause?.code || ''); process.exitCode=1; });
