(function (root) {
  'use strict';
  const time = value => {
    const n = Date.parse(value || '');
    return Number.isFinite(n) ? n : -Infinity;
  };
  function pickBest(candidates) {
    if (!Array.isArray(candidates)) return null;
    const available = candidates.filter(x => x && x.latest && /^\d{4}-\d{2}-\d{2}$/.test(String(x.latest.nav_date)) && Number.isFinite(time(x.checked_at)));
    if (!available.length) return null;
    available.sort((a,b) => b.latest.nav_date.localeCompare(a.latest.nav_date)
      || time(b.checked_at) - time(a.checked_at)
      || Number(b.channel === '云端净值库') - Number(a.channel === '云端净值库'));
    const result = {...available[0]};
    const recentFailure = available.filter(x => x.update_status === 'failed')
      .sort((a,b) => time(b.attempted_at) - time(a.attempted_at))[0];
    if (recentFailure && time(recentFailure.attempted_at) > time(result.checked_at)) {
      result.update_status = 'failed';
      result.attempted_at = recentFailure.attempted_at;
    }
    return result;
  }
  function toCSV(history) {
    if (!Array.isArray(history) || history.length === 0) throw Error('没有可导出的净值');
    const lines = [['净值日期','单位净值','累计净值','相邻披露日涨跌幅(%)']];
    const numeric = (v,optional=false) => {
      if (optional && v == null) return '';
      if (!/^[0-9]{1,8}(\.[0-9]{1,12})?$/.test(String(v))) throw Error('净值格式异常');
      return String(v);
    };
    for (const row of history) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.nav_date))) throw Error('日期格式异常');
      const change = row.change_pct == null ? '' : Number(row.change_pct).toFixed(6);
      if (change && !/^-?[0-9]{1,8}\.[0-9]{6}$/.test(change)) throw Error('涨跌幅格式异常');
      lines.push([row.nav_date,numeric(row.unit_nav),numeric(row.cumulative_nav,true),change]);
    }
    return '\uFEFF' + lines.map(columns => columns.join(',')).join('\r\n') + '\r\n';
  }
  root.WealthOSFeed = {pickBest,toCSV};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WealthOSFeed;
})(typeof window === 'undefined' ? globalThis : window);
