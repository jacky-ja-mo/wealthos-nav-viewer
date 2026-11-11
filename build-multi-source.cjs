'use strict';
/*
  BOC public distributor NAV index (a multi-manager source).
  Read-only. Never accesses banking accounts or private holding data.
  A search hit only proves a matching sales-class code was found in this
  specific public disclosure; it is not proof of availability to purchase.
*/
const fs=require('node:fs');
const path=require('node:path');
const ROOT='https://www.boc.cn/sourcedb/srfd6_2024/';
const PAGE_LIMIT=12; // recent public disclosure pages, NOT the entire catalog
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const decodeEntities=s=>s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const cellText=html=>decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<[^>]+>/g,' ').replace(/[\u00a0\s]+/g,' ').trim());
const amount=s=>/^\d{1,4}(?:\.\d{1,9})?$/.test(s)&&Number(s)>0&&Number(s)<1000?s:null;
function navDate(input) {
  const match=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+\d{2}:\d{2}:\d{2})?$/.exec(input);
  if(!match)return null;
  const date=match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');
  const parsed=new Date(date+'T00:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&date>='2020-01-01'?date:null;
}
function parsePage(html,sourceUrl) {
  if(typeof html!=='string'||html.length<100)throw Error('empty_html');
  if(!html.includes('净值')&&!html.toLowerCase().includes('net'))throw Error('unexpected_boc_page');
  const records=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>cellText(x[1]));
    if(cells.length<8)continue;
    const [code,name,unit,cumulative,, , ,dateText]=cells;
    if(!/^[A-Za-z0-9]{3,32}$/.test(code)||!name||name.length>160)continue;
    const nav_date=navDate(dateText);
    const unit_nav=amount(unit);
    if(!nav_date||!unit_nav)continue;
    // This feed displays many cash products with units of 1 and separate 10k yield fields.
    // Yield fields must never be reinterpreted as NAV.
    const cumulative_nav=cumulative?amount(cumulative):null;
    if(cumulative&&!cumulative_nav)continue;
    records.push({code:code.toUpperCase(),name,unit_nav,cumulative_nav,nav_date,source_url:sourceUrl});
  }
  return records;
}
async function fetchHTML(url,fetchImpl=fetch) {
  const res=await fetchImpl(url,{headers:{Accept:'text/html','User-Agent':'WealthOS/1.0 personal public disclosure reader'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('source_http_'+res.status);
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength>2000000)throw Error('source_too_large');
  const type=res.headers.get('content-type')||'';
  const data=new Uint8Array(bytes);
  // Bank of China disclosure pages have used GB-family encodings as well as UTF-8.
  let decoded=new TextDecoder(/gb2312|gbk|gb18030/i.test(type)?'gb18030':'utf-8').decode(data);
  if(decoded.includes('\ufffd')&&/charset\s*=\s*['"]?gb(?:2312|k|18030)/i.test(decoded.slice(0,2048)))
    decoded=new TextDecoder('gb18030').decode(data);
  return decoded;
}
async function collect(fetchImpl=fetch,maxPages=PAGE_LIMIT) {
  const records=new Map(),errors=[];
  for(let i=0;i<Math.min(maxPages,40);i++){
    if(i)await delay(350);
    const url=ROOT+(i?'index_'+i+'.html':'index.html');
    try{
      const html=await fetchHTML(url,fetchImpl);
      const parsed=parsePage(html,url);
      if(!parsed.length)throw Error('no_valid_table_rows');
      for(const r of parsed){
        const existing=records.get(r.code);
        if(!existing||r.nav_date>existing.nav_date)records.set(r.code,r);
      }
    }catch(error){errors.push({page:i,error:String(error.message||'unknown').slice(0,70)});}
  }
  const rows=[...records.values()].sort((a,b)=>a.code.localeCompare(b.code));
  const status=rows.length===0?'unavailable':errors.length?'partial':'ok';
  return {schema_version:1,source:'中国银行公开代销理财净值',source_root:ROOT,
    checked_at:new Date().toISOString(),scope:'部分近期披露页面，非全部在售产品',
    pages_requested:Math.min(maxPages,40),pages_succeeded:Math.min(maxPages,40)-errors.length,
    status,rows,error_codes:errors.slice(0,5)};
}
async function main(){
  const dest=process.argv[2]||'sources';
  fs.mkdirSync(dest,{recursive:true});
  const result=await collect();
  const filename=path.join(dest,'boc-public-nav.json');
  fs.writeFileSync(filename,JSON.stringify(result));
  process.stdout.write('BOC public NAV: '+result.rows.length+' records, '+result.pages_succeeded+'/'+result.pages_requested+' pages, status='+result.status+'\n');
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1});
module.exports={parsePage,navDate,amount,collect};
