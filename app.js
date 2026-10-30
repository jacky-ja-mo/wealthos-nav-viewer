'use strict';
const $ = id => document.getElementById(id);
const set = (id, value) => $(id).textContent = value;
const pct = n => n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(4)}%`;
const clock = x => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date(x));
const codeKey = 'wealthos_public_product_code';
let data = null, days = 30, page = 0, busy = false;
$('shares').value = '';
$('cost').value = '';
try { $('code').value = localStorage.getItem(codeKey) || ''; } catch {}

async function load(code) {
  if (busy) return;
  busy = true;
  $('refresh').disabled = true;
  $('notice').className = 'notice';
  set('notice', '正在读取已采集的官网净值，请稍候…');
  try {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(code)) throw Error('请输入有效的北银理财产品代码');
    let result;
    try {
      const cached = await fetch(`snapshots/${encodeURIComponent(code)}.json`, {credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!cached.ok) throw Error('no_snapshot');
      result = WealthOSNav.validateSnapshot(await cached.json(), code);
    } catch (snapshotError) {
      // A bad snapshot must not be presented as real; products without a
      // published snapshot may still be queried directly from the bank.
      if (snapshotError?.message !== 'no_snapshot') throw Error('已采集数据暂时无法读取，请稍后重试');
      result = await WealthOSNav.collect(code);
    }
    if (data && data.product.code !== result.product.code) {
      $('shares').value = '';
      $('cost').value = '';
    }
    data = result; page = 0;
    try { localStorage.setItem(codeKey, result.product.code); } catch {}
    $('dashboard').hidden = false;
    $('refresh').disabled = false;
    const isStale = result.source === 'cloud' && Date.now()-Date.parse(result.checked_at) > 36*3600000;
    const failed = result.source === 'cloud' && result.update_status === 'failed';
    if (isStale || failed) $('notice').className = 'notice error';
    const state = isStale ? '后台已超过36小时未成功采集，当前显示上次记录' : failed ? '后台最近一次连接官网失败，当前显示上次成功记录' : result.source === 'cloud' ? '已读取后台采集结果' : '官网查询成功';
    set('notice', `${state} · 最近成功采集：北京时间 ${clock(result.checked_at)}${failed ? `；失败检查：${clock(result.attempted_at)}` : ''}。如当日尚未披露，显示最近一条真实记录。`);
    render();
  } catch (error) {
    $('notice').className = 'notice error';
    const message = error instanceof TypeError ? '当前网络暂时无法连接北银理财官网' : error?.name === 'TimeoutError' ? '官网连接超时' : (error.message || '官网连接失败');
    set('notice', `${message}。请稍后重试；已有结果不会被替换。`);
    $('refresh').disabled = !data;
  } finally { busy = false; }
}

function render() {
  const { product, latest, history } = data;
  set('name', product.name); set('productCode', product.code);
  $('source').href = 'https://www.beijingbobwealth.com.cn/xxpl/cpgg/jzgg/index.html?PROD_CODE=' + encodeURIComponent(product.code);
  set('nav', latest.unit_nav); set('date', latest.nav_date); set('change', pct(latest.change_pct));
  set('interval', latest.previous_nav_date ? `${latest.previous_nav_date} → ${latest.nav_date}` : '暂无前一条记录');
  set('disclosure', latest.nav_date === data.as_of_date ? '当日净值已披露' : '当日净值未披露，显示最近记录');
  set('count', String(history.length)); set('checked', (data.source === 'cloud' ? '后台采集：' : '本次查询：') + clock(data.checked_at));
  renderChart(); renderTable(); calculate();
}
function svg(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v));
  if (text != null) n.textContent = text;
  return n;
}
function renderChart() {
  const chart = $('chart'); chart.replaceChildren();
  const end = Date.parse(data.as_of_date+'T00:00:00Z'), start = end - (days-1)*86400000;
  const rows = data.history.filter(r => { const x=Date.parse(r.nav_date+'T00:00:00Z'); return x>=start && x<=end; });
  set('chartNote', `${new Date(start).toISOString().slice(0,10)} — ${data.as_of_date} · ${rows.length} 条真实记录`);
  if (!rows.length) { chart.append(svg('text',{x:360,y:110,'text-anchor':'middle',fill:'#82918a'},'该时间范围暂无公开净值')); return; }
  const nums=rows.map(r=>Number(r.unit_nav)); let min=Math.min(...nums), max=Math.max(...nums);
  const pad=Math.max((max-min)*.2,.00003); min-=pad; max+=pad;
  const x=r=>64+(Date.parse(r.nav_date+'T00:00:00Z')-start)/(Math.max(1,end-start))*630;
  const y=v=>20+(max-v)/(max-min)*155;
  for (let i=0;i<4;i++) {
    const v=min+(max-min)*i/3, py=y(v);
    chart.append(svg('line',{x1:64,y1:py,x2:694,y2:py,stroke:'#e8ede6'}));
    chart.append(svg('text',{x:55,y:py+4,'text-anchor':'end',fill:'#85948d','font-size':11},v.toFixed(6)));
  }
  const d=rows.map((r,i)=>`${i?'L':'M'}${x(r).toFixed(2)} ${y(Number(r.unit_nav)).toFixed(2)}`).join(' ');
  if(rows.length>1)chart.append(svg('path',{d,fill:'none',stroke:'#3c8068','stroke-width':3}));
  for(const r of rows){const dot=svg('circle',{cx:x(r),cy:y(Number(r.unit_nav)),r:2.5,fill:'#3c8068'});dot.append(svg('title',{},`${r.nav_date} · ${r.unit_nav}`));chart.append(dot);}
  chart.setAttribute('aria-label',`${days}天内有${rows.length}条公开净值；精确数值见历史表格`);
}
function renderTable() {
  const list=[...data.history].reverse(), max=Math.max(1,Math.ceil(list.length/15)); page=Math.min(Math.max(page,0),max-1);
  $('rows').replaceChildren();
  for (const row of list.slice(page*15,(page+1)*15)) {
    const tr=document.createElement('tr');
    for(const val of [row.nav_date,row.unit_nav,row.cumulative_nav??'—',pct(row.change_pct)]) { const td=document.createElement('td');td.textContent=val;tr.append(td); }
    const td=document.createElement('td'),a=document.createElement('a');
    a.textContent='官网 ↗';a.href=row.source_url;a.target='_blank';a.rel='noopener noreferrer';td.append(a);tr.append(td);$('rows').append(tr);
  }
  set('pages',`共 ${list.length} 条 · 第 ${page+1} / ${max} 页`);$('prev').disabled=page===0;$('next').disabled=page===max-1;
}
// Input never leaves the browser or appears in the public page's source.
function calculate() {
  const shares=$('shares').value, cost=$('cost').value;
  if(!data || shares===''){set('asset','不计入资产');set('profit','—');return;}
  const s=Number(shares), c=cost===''?null:Number(cost), value=s*Number(data.latest.unit_nav);
  if(!Number.isFinite(s)||s<0||s>1e12||(c!==null&&(!Number.isFinite(c)||c<0||c>1e12))){set('asset','输入无效');set('profit','—');return;}
  set('asset','¥ '+value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}));
  set('profit',c===null?'—':'¥ '+(value-c).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}));
}
$('productForm').addEventListener('submit',event=>{event.preventDefault();load($('code').value);});
$('refresh').addEventListener('click',()=>load(data?.product.code||$('code').value));
$('holdingForm').addEventListener('submit',event=>{event.preventDefault();calculate();});
$('prev').addEventListener('click',()=>{page--;renderTable();});
$('next').addEventListener('click',()=>{page++;renderTable();});
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));renderChart();}));
if ($('code').value) load($('code').value);
