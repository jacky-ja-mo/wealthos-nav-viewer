'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parsePage,navDate,amount,collect}=require('./build-multi-source.cjs');
const html='<html><body>理财产品净值<table><tr><th>产品代码</th></tr>'
+'<tr><td>25112035A</td><td>华夏理财纯债日开35号A</td><td>1.023456</td><td>1.023456</td><td>0</td><td></td><td>0.01</td><td>2026/11/10 00:00:00</td></tr>'
+'<tr><td>TC3X00108B</td><td>平安理财天天成长3号8期B</td><td>1.0000</td><td>1.0000</td><td>0.123</td><td>1.01</td><td></td><td>2026/11/10 00:00:00</td></tr></table></body></html>';
test('two separate managers can be parsed, with exact share-class codes',()=>{
 const r=parsePage(html,'https://www.boc.cn/sourcedb/srfd6_2024/index.html');
 assert.equal(r.length,2);
 assert.equal(r[0].code,'25112035A');assert.equal(r[0].unit_nav,'1.023456');
 assert.equal(r[1].code,'TC3X00108B');assert.equal(r[1].nav_date,'2026-11-10');
 assert.equal(r.some(x=>x.code==='25112035B'),false);
});
test('reject dates and impossible NAV',()=>{
 assert.equal(navDate('2026/02/31 00:00:00'),null);
 assert.equal(amount('1001.01'),null);
 assert.equal(amount('=2+2'),null);
});
test('collection records partial source failures instead of inventing values',async()=>{
 const bytes=new TextEncoder().encode(html);
 const fake=async url=>url.endsWith('index.html')?
  ({ok:true,status:200,headers:{get:()=> 'text/html; charset=utf-8'},arrayBuffer:async()=>bytes.buffer}):
  ({ok:false,status:403,headers:{get:()=>null}});
 const data=await collect(fake,2);
 assert.equal(data.status,'partial');assert.equal(data.pages_succeeded,1);
 assert.equal(data.rows.length,2);assert.equal(data.error_codes[0].error,'source_http_403');
});
