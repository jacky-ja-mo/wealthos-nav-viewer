(function(root){
  'use strict';
  const KEY='wealthos_public_watchlist_v1';
  const KINDS=Object.freeze({wealth:'银行理财',fund:'公募基金',etf:'ETF',other:'其他'});
  const BUILTIN=Object.freeze({name:'诚享7天持有29号A',code:'YJ01251204A',kind:'wealth',manager:'北银理财',platform:'微众银行',sourceUrl:'https://www.beijingbobwealth.com.cn/xxpl/cpgg/jzgg/index.html?PROD_CODE=YJ01251204A'});
  const clean=(v,max)=>String(v??'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
  function normalize(p){
    p=p||{};
    const name=clean(p.name,90),code=clean(p.code,60).toUpperCase().replace(/\s/g,'');
    const kind=Object.hasOwn(KINDS,p.kind)?p.kind:'other';
    if(!name)throw Error('请输入产品名称');
    if(code&&!/^[A-Z0-9_-]{2,60}$/.test(code))throw Error('产品代码只能包含字母、数字、横线和下划线');
    let sourceUrl='';
    if(p.sourceUrl&&String(p.sourceUrl).trim()){
      let url;
      try{url=new URL(String(p.sourceUrl).trim());}catch{throw Error('官网链接格式无效');}
      if(url.protocol!=='https:'||url.username||url.password||!url.hostname)throw Error('官网链接只能使用 HTTPS 且不能包含账号密码');
      url.hash='';sourceUrl=url.href;
    }
    return {name,code,kind,manager:clean(p.manager,80),platform:clean(p.platform,80),sourceUrl};
  }
  function identity(p){
    const x=normalize(p);
    return [x.kind,x.manager.toLocaleLowerCase('zh-CN'),x.code||x.name.toLocaleLowerCase('zh-CN')].join('|');
  }
  function mode(p){
    const x=normalize(p);
    if(x.code===BUILTIN.code&&x.manager.includes('北银'))return 'auto';
    if(x.code&&x.manager.includes('北银理财'))return 'on_demand';
    return 'pending';
  }
  function add(entries,input){
    const p=normalize(input);
    if(!Array.isArray(entries))throw Error('关注列表格式异常');
    if(entries.length>=60)throw Error('最多关注 60 款产品');
    if(identity(p)===identity(BUILTIN)||entries.some(item=>identity(item)===identity(p)))throw Error('该产品已经在关注列表中');
    return [...entries,p];
  }
  function load(storage){
    try{
      const raw=storage.getItem(KEY);
      if(!raw)return [];
      if(raw.length>100000)throw Error('关注列表过大');
      const entries=JSON.parse(raw);
      if(!Array.isArray(entries)||entries.length>60)throw Error('关注列表格式异常');
      return entries.map(normalize);
    }catch{throw Error('本机关注列表读取失败，原数据未被覆盖');}
  }
  function save(storage,entries){
    if(!Array.isArray(entries)||entries.length>60)throw Error('关注列表格式异常');
    storage.setItem(KEY,JSON.stringify(entries.map(normalize)));
  }
  root.WealthOSWatchlist={KEY,KINDS,BUILTIN,normalize,identity,mode,add,load,save};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WealthOSWatchlist;
})(typeof window==='undefined'?globalThis:window);
