(function (root) {
  'use strict';
  const BASE = 'https://www.beijingbobwealth.com.cn/bylc-api/product/';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const number = (value, optional = false) => {
    if (value == null && optional) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 1000 || Number(n.toFixed(6)) !== n) throw Error('官网净值格式异常，已停止显示');
    return n.toFixed(6);
  };
  const isoDate = value => {
    const s = String(value);
    if (!/^\d{8}$/.test(s)) throw Error('官网净值日期格式异常');
    const d = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    const t = Date.parse(d + 'T00:00:00Z');
    if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10) !== d) throw Error('官网净值日期无效');
    return d;
  };
  const todayInChina = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  function validateSnapshot(snapshot, code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(code) || snapshot?.product?.code !== code || !snapshot.product.name || !Array.isArray(snapshot.history) || !snapshot.history.length) throw Error('已采集数据的产品信息异常');
    const checked = Date.parse(snapshot.checked_at);
    if (!Number.isFinite(checked) || checked > Date.now() + 300000) throw Error('已采集数据的时间异常');
    const updateStatus = snapshot.update_status ?? 'success';
    if (!['success','failed'].includes(updateStatus)) throw Error('后台采集状态异常');
    const attempted = snapshot.attempted_at ? Date.parse(snapshot.attempted_at) : checked;
    if (!Number.isFinite(attempted) || attempted < checked || attempted > Date.now() + 300000) throw Error('后台检查时间异常');
    const asOf = todayInChina();
    const history = [];
    for (const item of snapshot.history) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.nav_date)) || isoDate(item.nav_date.replaceAll('-','')) !== item.nav_date || item.nav_date > asOf) throw Error('已采集数据日期异常');
      const unit = number(item.unit_nav), cumulative = number(item.cumulative_nav, true);
      if (cumulative !== null && Number(cumulative) < Number(unit)) throw Error('已采集数据数值异常');
      let url;
      try { url = new URL(item.source_url); } catch { throw Error('已采集数据来源异常'); }
      if (url.protocol !== 'https:' || url.hostname !== 'www.beijingbobwealth.com.cn' || url.pathname !== '/bylc-api/product/navlist' || url.searchParams.get('PROD_CODE') !== code) throw Error('已采集数据来源异常');
      const prev = history.at(-1);
      if (prev && item.nav_date <= prev.nav_date) throw Error('已采集数据重复或顺序异常');
      const change = prev ? (Number(unit) / Number(prev.unit_nav) - 1) * 100 : null;
      if (change !== null && Math.abs(change) > 5) throw Error('已采集数据波动异常，请人工核实');
      history.push({nav_date:item.nav_date, unit_nav:unit, cumulative_nav:cumulative, source_url:url.href, collected_at:snapshot.checked_at, previous_nav_date:prev?.nav_date, change_pct:change});
    }
    const latest = history.at(-1);
    if (snapshot.latest?.nav_date !== latest.nav_date || number(snapshot.latest.unit_nav) !== latest.unit_nav) throw Error('已采集数据的最新净值不一致');
    return { product:{code, name:String(snapshot.product.name)}, history, latest, checked_at:new Date(checked).toISOString(), attempted_at:new Date(attempted).toISOString(), update_status:updateStatus, as_of_date:asOf, source:'cloud' };
  }
  async function collect(code, fetchImpl = fetch) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(code)) throw Error('请输入有效的北银理财产品代码');
    let attempts = 0;
    async function request(name, params) {
      const url = BASE + name + '?' + new URLSearchParams(params).toString();
      let last;
      for (let i = 0; i < 3; i++) {
        attempts++;
        let retryAfter = 0;
        try {
          const res = await fetchImpl(url, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
          if (!res.ok) {
            if (![408,429,500,502,503,504].includes(res.status)) {
              const error = Error(`官网返回 ${res.status}`); error.noRetry = true; throw error;
            }
            if (res.status === 429) {
              const value = res.headers?.get('Retry-After') || '';
              let seconds = value ? Number(value) : 0;
              if (value && !Number.isFinite(seconds)) {
                const date = Date.parse(value);
                if (!Number.isFinite(date)) { const error = Error('官网要求稍后再试'); error.noRetry = true; throw error; }
                seconds = Math.max(0, Math.ceil((date-Date.now())/1000));
              }
              if (Number.isFinite(seconds) && seconds > 20) {
                const error = Error('官网要求稍后再试'); error.noRetry = true; throw error;
              }
              if (Number.isFinite(seconds) && seconds > 0) retryAfter = seconds * 1000;
            }
            throw Error('官网暂时不可用');
          }
          const json = await res.json();
          if (json?.state !== 'ok' || !json.data) { const error = Error('官网响应格式异常'); error.noRetry = true; throw error; }
          return { data: json.data, url };
        } catch (error) { last = error; if (error?.noRetry || i === 2) break; await sleep(Math.max(retryAfter,(i+1)*1500)); }
      }
      throw last || Error('官网连接失败');
    }
    const { data: info } = await request('info', { PROD_CODE: code });
    if (info.PROD_CODE !== code || info.TA_PROD_CODE !== code || info.MANAGER_NAME !== '北银理财有限责任公司' || !info.PROD_NAME) throw Error('官网产品身份与代码不一致');
    let page = 1, total = null, pages = null;
    const unique = new Map();
    const stamp = new Date().toISOString();
    const asOf = todayInChina();
    do {
      const { data, url } = await request('navlist', { PROD_CODE: code, pageSize: '100', pageNumber: String(page) });
      if (!Array.isArray(data.list) || data.pageNumber !== page || data.pageSize !== 100 || !Number.isInteger(data.totalRow) || !Number.isInteger(data.totalPage) || data.totalRow < 1 || data.totalRow > 5000 || data.totalPage < 1 || data.totalPage > 50) throw Error('官网历史净值分页异常');
      if (total === null) { total = data.totalRow; pages = data.totalPage; }
      else if (total !== data.totalRow || pages !== data.totalPage) throw Error('官网数据正在更新，请稍后重试');
      if (!data.list.length) throw Error('官网返回空的历史净值页面');
      for (const raw of data.list) {
        if (raw.PROD_CODE !== code) throw Error('官网净值记录代码不一致');
        const date = isoDate(raw.NAV_DATE), unit = number(raw.NAV), cumulative = number(raw.ACCUMULATIVE_NAV, true);
        if (date > asOf || (cumulative !== null && Number(cumulative) < Number(unit))) throw Error('官网净值记录异常');
        if (unique.has(date)) throw Error('官网净值日期重复，请稍后核实');
        unique.set(date, { nav_date: date, unit_nav: unit, cumulative_nav: cumulative, source_url: url, collected_at: stamp });
      }
      page++;
      if (page <= pages) await sleep(800);
    } while (page <= pages);
    if (unique.size !== total) throw Error('官网历史净值不完整');
    const rows = [...unique.values()].sort((a,b) => a.nav_date.localeCompare(b.nav_date));
    for (let i = 0; i < rows.length; i++) {
      const prev = rows[i-1];
      if (prev) {
        const change = (Number(rows[i].unit_nav) / Number(prev.unit_nav) - 1) * 100;
        if (Math.abs(change) > 5) throw Error('官网净值波动异常，请人工核实');
        rows[i].change_pct = change;
        rows[i].previous_nav_date = prev.nav_date;
      } else rows[i].change_pct = null;
    }
    const latest = rows.at(-1);
    if (isoDate(info.NAV_DATE) !== latest.nav_date || number(info.NAV) !== latest.unit_nav) throw Error('官网产品信息与历史净值暂不一致');
    return { product: {code, name: info.PROD_NAME}, history: rows, latest, checked_at: stamp, attempts, as_of_date: asOf, source:'official' };
  }
  root.WealthOSNav = { collect, validateSnapshot, todayInChina, isoDate, number };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WealthOSNav;
})(typeof window === 'undefined' ? globalThis : window);
