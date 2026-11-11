const test = require('node:test');
const assert = require('node:assert/strict');
const {pickBest,toCSV} = require('./feed.js');
const sample = (date,checked_at,channel,extra={}) => ({product:{code:'YJ01251204A'},latest:{nav_date:date,unit_nav:'1.015574'},checked_at,attempted_at:checked_at,channel,update_status:'success',...extra});
test('latest disclosed NAV wins even when old snapshot was checked later',()=>{
  const cache=sample('2026-11-09','2026-11-11T12:00:00Z','网页缓存');
  const cloud=sample('2026-11-10','2026-11-11T01:35:00Z','云端净值库');
  assert.equal(pickBest([cache,cloud]).latest.nav_date,'2026-11-10');
});
test('prefer latest verification and cloud on ties',()=>{
  const cache=sample('2026-11-10','2026-11-11T01:35:00Z','网页缓存');
  const cloud=sample('2026-11-10','2026-11-11T01:35:00Z','云端净值库');
  assert.equal(pickBest([cache,cloud]).channel,'云端净值库');
  assert.equal(pickBest([cache,sample('2026-11-10','2026-11-11T02:35:00Z','云端净值库')]).channel,'云端净值库');
});
test('recent failed attempt remains visible over an older successful snapshot',()=>{
  const failure=sample('2026-11-09','2026-11-11T01:00:00Z','网页缓存',{update_status:'failed',attempted_at:'2026-11-11T03:00:00Z'});
  const cloud=sample('2026-11-10','2026-11-11T02:00:00Z','云端净值库');
  const result=pickBest([failure,cloud]);
  assert.equal(result.latest.nav_date,'2026-11-10');
  assert.equal(result.update_status,'failed');
});
test('CSV contains only disclosed numerical data and uses UTF-8 BOM',()=>{
  const csv=toCSV([{nav_date:'2026-11-10',unit_nav:'1.015574',cumulative_nav:'1.015574',change_pct:0.00049}]);
  assert.equal(csv.charCodeAt(0),0xfeff);
  assert.match(csv,/2026-11-10,1.015574,1.015574,0.000490/);
  assert.throws(()=>toCSV([{nav_date:'2026-11-10',unit_nav:'=SUM(1,2)',change_pct:1}]),/净值格式异常/);
});
