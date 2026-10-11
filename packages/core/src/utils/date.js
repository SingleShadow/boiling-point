/** 日期工具：统一使用本地时区 YYYY-MM-DD */

export function toDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

export function nowISO() {
  return new Date().toISOString();
}

/** 距今多少小时 */
export function hoursAgo(iso) {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}
