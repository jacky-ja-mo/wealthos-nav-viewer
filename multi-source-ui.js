(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const status=$('multiStatus'),out=$('multiResults'),q=$('multiQuery');
 let feed=null;
 function node(tag,cl,text){
   const el=document.createElement(tag);if(cl)el.className=cl;
   if(text!=null)el.textContent=text;return el;
 }
 function announce(message,error=false){status.textContent=message;status.className=error?'multi-status error':'multi-status';}
 function validate(raw){
   if(!raw||raw.schema_version!==1||!['ok','partial','unavailable'].includes(raw.status)||
       !Array.isArray(raw.rows)||raw.rows.length>20000||!Number.isFinite(Date.parse(raw.checked_at)))throw Error('数据索引格式异常');
   return raw;
 }
 async function load(){
   const res=await fetch('sources/boc-public-nav.json?fresh='+Date.now(),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
   if(!res.ok)throw Error('公开净值索引未生成或暂不可用');
   return validate(await res.json());
 }
 function renderMatches(matches){
   out.replaceChildren();
   if(!matches.length)return;
   for(const r of matches.slice(0,20)){
     const card=node('article','multi-hit');
     const detail=node('div','multi-hit-main');
     detail.append(node('strong','multi-hit-name',r.name),
       node('p','multi-hit-detail','产品代码 '+r.code+' · 官方披露日期 '+r.nav_date),
       node('div','multi-hit-nav','单位净值 '+r.unit_nav+' 元/份 · 累计净值 '+(r.cumulative_nav||'未披露')));
     const actions=node('div','multi-hit-actions');
     const link=node('a','watch-link','官方数据页');
     link.href=r.source_url;link.rel='noopener noreferrer';link.target='_blank';link.referrerPolicy='no-referrer';
     const add=node('button','watch-action','加入关注');
     add.type='button';
     add.addEventListener('click',()=>{
       $('watchName').value=r.name;$('watchCode').value=r.code;$('watchKind').value='wealth';
       $('watchManager').value=''; // Never infer manager from distributor alone.
       $('watchPlatform').value='中国银行（披露来源）';$('watchSource').value=r.source_url;
       $('watchForm').requestSubmit();
       $('watchItems').scrollIntoView({behavior:'smooth',block:'nearest'});
     });
     actions.append(link,add);card.append(detail,actions);out.append(card);
   }
 }
 async function search(event){
   if(event)event.preventDefault();
   out.replaceChildren();
   const term=q.value.trim().toUpperCase();
   if(term.length<2){announce('请输入至少 2 个字符的产品名称或代码。',true);return;}
   announce('正在查询已采集的官方公开资料…');
   try{
     if(!feed)feed=await load();
     if(feed.status==='unavailable'||feed.rows.length===0){
       announce('中国银行公开数据索引当前不可用。没有找到不代表产品不存在；请稍后重试。',true);return;
     }
     const candidates=feed.rows.filter(r=>typeof r.name==='string'&&typeof r.code==='string'&&
       (r.code.toUpperCase().includes(term)||r.name.toUpperCase().includes(term)));
     const exact=candidates.filter(r=>r.code.toUpperCase()===term);
     const sorted=[...exact,...candidates.filter(r=>r.code.toUpperCase()!==term)].slice(0,20);
     renderMatches(sorted);
     const checked=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(feed.checked_at));
     const scope='仅检查中国银行公开代销理财净值列表的前 '+feed.pages_requested+' 页，成功 '+feed.pages_succeeded+' 页；不是全市场搜索。';
     const warning=feed.status==='partial'?'其中部分页面采集失败。':'';
     announce(sorted.length?'找到 '+candidates.length+' 条匹配记录（最多显示 20 条）。索引检查时间：'+checked+'。'+warning+scope:
      '未在当前索引中找到匹配产品。可能未由中国银行代销、未在当前披露页或代码不一致；不能据此判定产品不存在。'+warning+scope);
   }catch(error){feed=null;announce((error.message||'检索失败')+'。请稍后重试。',true);}
 }
 $('multiForm').addEventListener('submit',search);
 $('multiRefresh').addEventListener('click',()=>{feed=null;search();});
})();
