// 数字 / 日期格式化工具

// 大数格式化：>=1亿 显示「x.xx亿」，>=1万 显示「x.x万」，否则原值
export function formatCount(n) {
  if (n === null || n === undefined || n === '') return '-'
  const num = Number(n)
  if (isNaN(num)) return '-'
  if (num >= 1e8) return trimZero(num / 1e8) + '亿'
  if (num >= 1e4) return trimZero(num / 1e4) + '万'
  return String(num)
}

// 带一位小数的紧凑格式（用于播放量等），亿/万
export function formatPlay(n) {
  return formatCount(n)
}

function trimZero(v) {
  return v
    .toFixed(2)
    .replace(/\.?0+$/, '')
}

// 标题/作者等文本兜底
export function text(v, fallback = '-') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

// 日期：'YYYY-MM-DD' -> 'MM月DD日'
export function formatDateCN(d) {
  if (!d) return ''
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(d))
  if (!m) return String(d)
  return `${Number(m[2])}月${Number(m[3])}日`
}

// 星期中文
export function weekdayCN(d) {
  const map = ['日', '一', '二', '三', '四', '五', '六']
  const dt = new Date(String(d).replace(/-/g, '/'))
  if (isNaN(dt.getTime())) return ''
  return '周' + map[dt.getDay()]
}

// 最近 N 天日期列表（含今天，倒序 -> 由新到旧）
export function recentDates(n = 7) {
  const list = []
  const base = new Date()
  for (let i = 0; i < n; i++) {
    const dt = new Date(base)
    dt.setDate(base.getDate() - i)
    list.push(toDateKey(dt))
  }
  return list
}

export function toDateKey(dt) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 百分比（置信度 0-1 -> 整数%）
export function pct(v) {
  const num = Number(v)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

// 时长秒 -> 'm分s秒' 或 'ss秒'
export function formatDuration(sec) {
  const s = Number(sec)
  if (isNaN(s)) return '-'
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}分${r}秒` : `${m}分`
}

// 大数字千分位（用于 stats 明细）
export function thousands(n) {
  const num = Number(n)
  if (isNaN(num)) return '-'
  return num.toLocaleString('en-US')
}
