/**
 * Agent 感知层 —— 回答三个问题：
 *   1. 今天的数据到齐了吗？（报告是否存在、是否新鲜）
 *   2. 数据源还活着吗？（真实接口探测 + 历史可用率）
 *   3. 历史有没有缺口？（近 N 天缺失的日期）
 */
import * as douyin from '../../core/src/providers/douyin.js';
import * as custom from '../../core/src/providers/custom.js';
import { toDateKey, shiftDateKey } from '../../core/src/utils/date.js';
import { recall } from './memory.js';

function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 ${ms}ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/** 探测真实数据源可用性（不写库，只读） */
export async function probeLiveSource({ dateKey, limit = 10, metric = 'play', timeoutMs = 8000 } = {}) {
  const useCustom = custom.isConfigured();
  const hasKey = Boolean(process.env.DOUYIN_API_KEY || process.env.DOUYIN_API_BASE) || useCustom;
  if (!hasKey) {
    return { ok: false, available: false, reason: 'no-credentials', ms: 0, count: 0, detail: '未配置 DOUYIN_API_KEY / DOUYIN_API_BASE / CUSTOM_API_URL' };
  }
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      (useCustom ? custom : douyin).fetchTopVideos({ dateKey, limit, metric }),
      timeoutMs,
      useCustom ? '自定义数据源' : '抖音真实接口'
    );
    const count = (res.videos || []).length;
    return {
      ok: count > 0,
      available: true,
      ms: Date.now() - t0,
      count,
      source: res.source || (useCustom ? 'custom' : 'douyin'),
      channel: useCustom ? 'custom' : 'douyin',
      warnings: res.warnings || [],
      detail: count > 0 ? `返回 ${count} 条` : '返回空榜单',
    };
  } catch (e) {
    return {
      ok: false,
      available: true,
      reason: 'fetch-failed',
      ms: Date.now() - t0,
      count: 0,
      detail: e.message,
    };
  }
}

/** 近 days 天中缺失报告的日期（不含今天，今天由主流程判断） */
export function detectGaps(db, { days = 7, until = toDateKey() } = {}) {
  const missing = [];
  for (let i = days; i >= 1; i--) {
    const d = shiftDateKey(until, -i);
    const row = db.prepare('SELECT date_key FROM reports WHERE date_key=?').get(d);
    if (!row) missing.push(d);
  }
  return missing;
}

/** 某天是否已有报告，以及报告新鲜度（小时） */
export function readTodayState(db, dateKey) {
  const row = db.prepare('SELECT date_key, created_at, payload FROM reports WHERE date_key=?').get(dateKey);
  if (!row) return { hasReport: false, ageHours: null, createdAt: null };
  const created = new Date(row.created_at).getTime();
  const ageHours = Math.round(((Date.now() - created) / 3600000) * 10) / 10;
  return { hasReport: true, createdAt: row.created_at, ageHours };
}

/** 读取历史记忆中的关键经验 */
export function readExperience(db) {
  const keys = [
    'source:douyin:health',
    'source:douyin:consecutive_fail',
    'trend:topic_stability',
    'quality:baseline',
    'ops:last_success_date',
  ];
  const out = {};
  for (const k of keys) {
    const m = recall(db, k);
    if (m) out[k] = m.value;
  }
  return out;
}

/** 近 N 天的主导题材序列（用于判断趋势是否失真/僵化） */
export function readTopicHistory(db, { days = 7, until = toDateKey() } = {}) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = shiftDateKey(until, -i);
    const row = db.prepare('SELECT payload FROM reports WHERE date_key=?').get(d);
    if (!row) continue;
    try {
      const rep = JSON.parse(row.payload);
      out.push({ date: d, topic: rep?.audienceInsight?.topTopics?.[0]?.name || '', avgScore: rep?.audienceInsight?.avgBoilingScore || 0 });
    } catch {
      /* 跳过损坏记录 */
    }
  }
  return out;
}

/**
 * 汇总观测结果 —— Agent 的"眼睛"
 */
export async function observe(db, opts = {}) {
  const dateKey = opts.dateKey || toDateKey();
  const limit = opts.limit || 10;
  const metric = opts.metric || 'play';
  const days = opts.historyDays || 7;

  const [live, today, gaps, experience, topicHistory] = await Promise.all([
    probeLiveSource({ dateKey, limit, metric, timeoutMs: opts.probeTimeoutMs || 8000 }),
    Promise.resolve(readTodayState(db, dateKey)),
    Promise.resolve(detectGaps(db, { days, until: dateKey })),
    Promise.resolve(readExperience(db)),
    Promise.resolve(readTopicHistory(db, { days, until: dateKey })),
  ]);

  return {
    dateKey,
    limit,
    metric,
    today,
    live,
    gaps,
    experience,
    topicHistory,
    hasLiveKey: live.available,
    observedAt: new Date().toISOString(),
  };
}
