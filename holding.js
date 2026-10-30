(function(root){
  'use strict';
  const limit=999999999999;
  function estimate(shares,cost,latest,previous){
    shares=String(shares??'').trim();cost=String(cost??'').trim();
    if(shares==='')return {status:'no_shares'};
    const s=Number(shares),c=cost===''?null:Number(cost),nav=Number(latest?.unit_nav);
    if(!Number.isFinite(s)||s<0||s>limit||(c!==null&&(!Number.isFinite(c)||c<0||c>limit)))return {status:'invalid'};
    if(!Number.isFinite(nav)||nav<=0)return {status:'no_data'};
    const prior=Number(previous?.unit_nav);
    // The validated official NAVs have six decimals. Subtract integer millionths
    // before multiplying, so tiny daily movements don't suffer cancellation.
    const periodProfit=Number.isFinite(prior)&&prior>0
      ? s*(Math.round(nav*1e6)-Math.round(prior*1e6))/1e6 : null;
    const asset=s*nav;
    return {status:'ok',asset,profit:c===null?null:asset-c,periodProfit};
  }
  function money(value){
    const rounded=Number(value.toFixed(2));
    return '¥ '+(Object.is(rounded,-0)?0:rounded).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  root.WealthOSHolding={estimate,money};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WealthOSHolding;
})(typeof window==='undefined'?globalThis:window);
