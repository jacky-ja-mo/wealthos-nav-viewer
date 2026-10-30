const test=require('node:test');
const assert=require('node:assert/strict');
const {estimate,money}=require('./holding.js');
const old={nav_date:'2026-10-28',unit_nav:'1.015553'};
const latest={nav_date:'2026-10-29',unit_nav:'1.015555'};
test('estimates only the interval between two real NAVs using the current shares',()=>{
  const r=estimate('10000','10000',latest,old);
  assert.equal(r.status,'ok');assert.equal(money(r.asset),'¥ 10,155.55');
  assert.equal(money(r.profit),'¥ 155.55');assert.equal(money(r.periodProfit),'¥ 0.02');
});
test('does not invent a period result without an earlier NAV',()=>{
  const r=estimate('10000','',latest,null);
  assert.equal(r.periodProfit,null);assert.equal(r.profit,null);
});
test('no shares does not count a watched product as an asset',()=>{
  assert.equal(estimate('','',latest,old).status,'no_shares');
  assert.equal(money(estimate('0','',latest,old).asset),'¥ 0.00');
});
test('rejects invalid shares and cost and handles falling NAV',()=>{
  assert.equal(estimate('-1','',latest,old).status,'invalid');
  assert.equal(estimate('1','-1',latest,old).status,'invalid');
  assert.equal(estimate('Infinity','',latest,old).status,'invalid');
  assert.equal(estimate('1','',null,old).status,'no_data');
  assert.equal(money(estimate('10000','',old,latest).periodProfit),'¥ -0.02');
  assert.equal(money(-0.001),'¥ 0.00');
});
