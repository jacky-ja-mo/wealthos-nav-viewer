(function(){
  'use strict';
  const api=window.WealthOSWatchlist;
  const byId=id=>document.getElementById(id);
  const holder=byId('watchItems'),form=byId('watchForm'),note=byId('watchStatus');
  let entries=[],available=true;
  try{entries=api.load(localStorage);}catch(err){available=false;note.textContent=err.message;}
  function el(tag,cls,value){
    const x=document.createElement(tag);if(cls)x.className=cls;
    if(value!=null)x.textContent=value;return x;
  }
  function status(s,error=false){note.textContent=s;note.className=error?'watch-status error':'watch-status';}
  const labels={auto:'每日自动采集',on_demand:'北银官网按需查询',pending:'自动数据源未接入'};
  function render(){
    holder.replaceChildren();
    byId('watchCount').textContent='已登记 '+(entries.length+1)+' 款 · 自动采集 1 款';
    const shown=[{...api.BUILTIN,pinned:true},...entries.map((p,index)=>({...p,index}))];
    for(const p of shown){
      const capability=api.mode(p);
      const card=el('article','watch-card'),main=el('div','watch-main'),actions=el('div','watch-actions');
      main.append(
        el('strong','watch-name',p.name),
        el('p','watch-details',[api.KINDS[p.kind]||api.KINDS.other,p.manager||'管理人待填写',p.platform||'销售平台未填写',p.code||'未填写代码'].join(' · ')),
        el('span','watch-flag '+capability,labels[capability])
      );
      if(capability!=='pending'){
        const open=el('button','watch-action','查看净值');
        open.type='button';open.addEventListener('click',()=>{
          byId('code').value=p.code;
          byId('productForm').requestSubmit();
          byId('notice').scrollIntoView({behavior:'smooth',block:'nearest'});
        });
        actions.append(open);
      }
      if(p.sourceUrl){
        const link=el('a','watch-link','打开官网');link.href=p.sourceUrl;
        link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.target='_blank';
        actions.append(link);
      }
      if(!p.pinned){
        const remove=el('button','watch-delete','移除');remove.type='button';
        remove.addEventListener('click',()=>{
          if(!window.confirm('从关注列表中移除“'+p.name+'”？'))return;
          const updated=entries.filter((_,i)=>i!==p.index);
          try{api.save(localStorage,updated);entries=updated;render();status('已从本机关注列表移除。');}
          catch(err){status(err.message,true);}
        });
        actions.append(remove);
      }
      card.append(main,actions);holder.append(card);
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!available){status('浏览器存储不可用，无法保存关注列表。请检查隐私设置。',true);return;}
    try{
      const input={name:byId('watchName').value,code:byId('watchCode').value,kind:byId('watchKind').value,
        manager:byId('watchManager').value,platform:byId('watchPlatform').value,sourceUrl:byId('watchSource').value};
      const updated=api.add(entries,input);
      api.save(localStorage,updated);entries=updated;form.reset();render();
      status('已加入本机关注列表。未接入的数据源不会显示虚构净值，也不会自动更新。');
    }catch(err){status(err.message,true);}
  });
  render();
})();
