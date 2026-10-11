#!/usr/bin/env node
/**
 * 沸点创意 API 服务（Node 22 内置 http + node:sqlite，零第三方依赖）
 * 端口 8787（可用 PORT 覆盖）
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDb, getReport, getLatestDateKey, listReports, getDayVideos, getDayTags, getTagTrend, getStats, listRuns, saveSubscriber, listSubscribers, countSubscribers } from '../../packages/core/src/store/db.js';
import { fetchTopVideos } from '../../packages/core/src/providers/composite.js';
import { buildBaseline, scoreTitle, similarTitles } from '../../packages/core/src/scorer/title.js';
import { exportTaxonomy } from '../../packages/core/src/taxonomy/taxonomy.js';
import { runDaily } from '../../packages/core/src/pipeline.js';
import { fetchHotWords } from '../../packages/core/src/providers/douyin.js';
import { toDateKey, shiftDateKey } from '../../packages/core/src/utils/date.js';
import { serveStatic, serveSpa } from './static.js';
import {
  runAgent, planOnly, getSnapshot, ensureAgentSchema,
  listMemory, listFindings, listAgentRuns, getAgentStats,
} from '../../packages/agent/src/agent.js';
import { loadEnv } from '../../packages/core/src/env.js';

loadEnv();

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '../..');
const PORT = Number(process.env.PORT || 8787);
const DB_PATH = process.env.BOILING_DB || join(ROOT, 'data/boiling.db');
const DEFAULT_LIMIT = Number(process.env.BOILING_TOP_N || 10);
const METRIC = process.env.BOILING_METRIC || 'play';
const CRON_HOUR = Number(process.env.BOILING_CRON_HOUR ?? 9);

const db = getDb(DB_PATH);
ensureAgentSchema(db);

/* ---------------- utils ---------------- */

const json = (res, data, code = 200) => {
  const body = Buffer.from(JSON.stringify(data), 'utf-8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(body);
};
const ok = (res, data) => json(res, { ok: true, data });
const fail = (res, message, code = 400) => json(res, { ok: false, error: { code, message } }, code);

function readBody(req) {
  return new Promise((resv) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        resv(s ? JSON.parse(s) : {});
      } catch {
        resv({});
      }
    });
  });
}

/** 确保某天有数据（没有就现场跑一次） */
async function ensureDate(dateKey, { force = false } = {}) {
  if (!force) {
    const rep = getReport(db, dateKey);
    if (rep) return { report: rep, generated: false };
  }
  const r = await runDaily({ db, dateKey, limit: DEFAULT_LIMIT, metric: METRIC });
  lastRunAt = new Date().toISOString();
  return { report: r.report, generated: true, warnings: r.warnings };
}

/* ---------------- routes ---------------- */

let lastRunAt = null;

/* ---------------- 标题打分器的基准库 ---------------- */

let baselineCache = { at: 0, data: null };
const BASELINE_TTL_MS = 60 * 60 * 1000; // 热门写法一天内不会突变，缓存 1 小时

/**
 * 构建「当下热门标题」基准：优先用库里近 7 天的真实标题，不足 30 条时实时抓当前热门补齐。
 * 打分器的一切结论都来自这里——所以它必须是真实数据，不能用仿真。
 */
async function getTitleBaseline() {
  if (baselineCache.data && Date.now() - baselineCache.at < BASELINE_TTL_MS) return baselineCache.data;

  const since = shiftDateKey(toDateKey(), -7);
  let pool = [];
  try {
    pool = db
      .prepare('SELECT title, play, author FROM videos WHERE date_key >= ? ORDER BY play DESC LIMIT 200')
      .all(since)
      .map((r) => ({ title: r.title, play: r.play, author: r.author }))
      .filter((x) => x.title);
  } catch {
    pool = [];
  }

  let source = 'history';
  if (pool.length < 30) {
    try {
      const res = await fetchTopVideos({ limit: 50 });
      const seen = new Set(pool.map((p) => p.title));
      const live = (res.videos || [])
        .map((v) => ({ title: v.title, play: v.play, author: v.author }))
        .filter((v) => v.title && !seen.has(v.title));
      pool = pool.concat(live);
      source = pool.length > seen.size ? 'history+live' : 'live';
    } catch (e) {
      console.warn('[baseline] 实时热门抓取失败，只用历史样本：', e.message);
    }
  }

  baselineCache = {
    at: Date.now(),
    data: {
      baseline: buildBaseline(pool.map((p) => p.title)),
      pool,
      fetchedAt: new Date().toISOString(),
      source,
    },
  };
  return baselineCache.data;
}

const routes = {
  'GET /api/health': async () => ({
    service: 'boiling-point-api',
    version: '1.0.0',
    time: new Date().toISOString(),
    today: toDateKey(),
    dataMode: process.env.BOILING_DATA_MODE || 'auto',
    metric: METRIC,
    topN: DEFAULT_LIMIT,
    lastRunAt,
    cronHour: CRON_HOUR,
    stats: getStats(db),
    hasLiveKey: Boolean(process.env.DOUYIN_API_KEY || process.env.DOUYIN_API_BASE),
  }),

  'GET /api/today': async (u) => {
    const dateKey = u.searchParams.get('date') || toDateKey();
    const { report, generated, warnings } = await ensureDate(dateKey, { force: u.searchParams.get('force') === '1' });
    return { ...report, _generated: generated, _warnings: warnings || [] };
  },

  'GET /api/report': async (u) => {
    const dateKey = u.searchParams.get('date') || getLatestDateKey(db) || toDateKey();
    const report = getReport(db, dateKey);
    if (!report) return null;
    return report;
  },

  'GET /api/reports': async (u) => {
    const limit = Number(u.searchParams.get('limit') || 30);
    return listReports(db, limit).map((r) => {
      const rep = getReport(db, r.date_key);
      return {
        date: r.date_key,
        createdAt: r.created_at,
        avgBoilingScore: rep?.audienceInsight?.avgBoilingScore || 0,
        topTopic: rep?.audienceInsight?.topTopics?.[0]?.name || '',
        sampleSize: rep?.audienceInsight?.sampleSize || 0,
      };
    });
  },

  'GET /api/videos': async (u) => {
    const dateKey = u.searchParams.get('date') || getLatestDateKey(db) || toDateKey();
    const limit = Number(u.searchParams.get('limit') || 50);
    return getDayVideos(db, dateKey).slice(0, limit);
  },

  'GET /api/tags': async () => exportTaxonomy(),

  'GET /api/trends': async (u) => {
    const days = Number(u.searchParams.get('days') || 7);
    const dateKey = u.searchParams.get('date') || getLatestDateKey(db) || toDateKey();
    const top = getDayTags(db, dateKey).slice(0, 10);
    return top.map((t) => ({
      tagId: t.tag_id,
      name: t.name,
      dimension: t.dimension,
      series: getTagTrend(db, t.tag_id, days),
    }));
  },

  'GET /api/runs': async (u) => listRuns(db, Number(u.searchParams.get('limit') || 20)),

  'GET /api/stats': async () => getStats(db),

  'POST /api/run': async (u, body) => {
    const dateKey = body.date || u.searchParams.get('date') || toDateKey();
    const r = await runDaily({
      db,
      dateKey,
      limit: Number(body.limit || DEFAULT_LIMIT),
      metric: body.metric || METRIC,
      mode: body.mode,
    });
    lastRunAt = new Date().toISOString();
    return {
      date: r.dateKey,
      source: r.source,
      count: r.entries.length,
      warnings: r.warnings,
      avgBoilingScore: r.report.audienceInsight.avgBoilingScore,
    };
  },

  /* ---------------- 免费工具：标题打分器（获客入口） ---------------- */

  'GET /api/score-title': async (u) => {
    const title = String(u.searchParams.get('title') || '').slice(0, 200);
    const bl = await getTitleBaseline();
    const r = scoreTitle(title, bl.baseline);
    return {
      ...r,
      similar: title ? similarTitles(title, bl.pool, 3) : [],
      baseline: { ...(r.baseline || {}), fetchedAt: bl.fetchedAt, source: bl.source },
    };
  },

  'GET /api/score-title/baseline': async () => {
    const bl = await getTitleBaseline();
    return {
      size: bl.baseline.size,
      rate: bl.baseline.rate,
      length: bl.baseline.length,
      fetchedAt: bl.fetchedAt,
      source: bl.source,
    };
  },

  /** 留资：免费工具换邮箱。验证期不发确认邮件、不做密码 */
  'POST /api/subscribe': async (u, body) => {
    const r = saveSubscriber(db, { email: body.email, source: body.source || 'title-tool', note: body.note || '' });
    return { ...r, total: countSubscribers(db) };
  },

  'GET /api/subscribers': async () => ({ total: countSubscribers(db), items: listSubscribers(db, 50) }),

  /* ---------------- 内容情报 Agent ---------------- */

  /** Agent 状态快照：今日值守记录 + KPI + 记忆 + 问题 */
  /** 抖音官方热搜词榜（免 Key 真实数据，实时抓取不走缓存） */
  'GET /api/hotwords': async (u) => fetchHotWords({ limit: Number(u.searchParams.get('limit') || 20) }),

  'GET /api/agent/status': async (u) => getSnapshot(db, { dateKey: u.searchParams.get('date') || undefined }),

  /** 只感知与规划，不执行 —— 展示 Agent 的思考过程 */
  'GET /api/agent/plan': async (u) => planOnly({
    db,
    dateKey: u.searchParams.get('date') || undefined,
    limit: Number(u.searchParams.get('limit') || DEFAULT_LIMIT),
  }),

  /** 触发一次完整值守（感知→规划→执行→质检→修复→记忆→简报） */
  'POST /api/agent/run': async (u, body) => {
    const r = await runAgent({
      db,
      dateKey: body.date || u.searchParams.get('date') || undefined,
      force: Boolean(body.force),
      mode: body.mode,
      metric: body.metric || METRIC,
      limit: Number(body.limit || DEFAULT_LIMIT),
    });
    lastRunAt = new Date().toISOString();
    return {
      dateKey: r.dateKey,
      runId: r.runId,
      status: r.status,
      healthScore: r.healthScore,
      grade: r.grade,
      source: r.source,
      repaired: r.repaired,
      durationMs: r.durationMs,
      plan: r.plan,
      actions: r.actions,
      issues: r.qa.issues,
      brief: r.brief,
    };
  },

  'GET /api/agent/brief': async (u) => {
    const dateKey = u.searchParams.get('date') || getLatestDateKey(db) || toDateKey();
    const run = getSnapshot(db, { dateKey })?.today;
    if (!run) return null;
    return run.brief;
  },

  'GET /api/agent/memory': async (u) => listMemory(db, u.searchParams.get('category') || undefined),

  'GET /api/agent/findings': async (u) => listFindings(db, {
    limit: Number(u.searchParams.get('limit') || 20),
    dateKey: u.searchParams.get('date') || undefined,
    minSeverity: u.searchParams.get('minSeverity') || undefined,
  }),

  'GET /api/agent/runs': async (u) => listAgentRuns(db, Number(u.searchParams.get('limit') || 10)),

  'GET /api/agent/stats': async () => getAgentStats(db),

  /** 回溯生成最近 N 天（用于演示趋势曲线） */
  'POST /api/backfill': async (u, body) => {
    const days = Number(body.days || 7);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dateKey = shiftDateKey(toDateKey(), -i);
      const r = await runDaily({ db, dateKey, limit: DEFAULT_LIMIT, metric: METRIC, mode: body.mode || 'simulated' });
      out.push({ date: dateKey, count: r.entries.length, topTopic: r.report.audienceInsight.topTopics[0]?.name });
    }
    lastRunAt = new Date().toISOString();
    return out;
  },
};

/* ---------------- server ---------------- */

// 每个站点可配置多个候选产物目录（前端构建工具换了目录时不用改代码）
const STATIC_MAP = [
  { prefix: '/agent', dirs: [join(ROOT, 'agent-console')], spa: false },
  { prefix: '/app', dirs: [join(ROOT, 'apps/mobile/dist'), join(ROOT, 'apps/mobile/dist/build/h5')], spa: true },
  { prefix: '/web', dirs: [join(ROOT, 'apps/web/dist')], spa: true },
  { prefix: '/tool', dirs: [join(ROOT, 'tools/title-score')], spa: false },
];
for (const m of STATIC_MAP) m.dir = m.dirs.find((d) => existsSync(d)) || null;

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // 静态站点
  for (const m of STATIC_MAP) {
    if ((path === m.prefix || path.startsWith(`${m.prefix}/`)) && existsSync(m.dir)) {
      const sub = path.slice(m.prefix.length) || '/';
      const hit = m.spa ? await serveSpa(m.dir, sub) : await serveStatic(m.dir, sub);
      if (hit) {
        res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'no-cache' });
        return res.end(hit.body);
      }
      return fail(res, '静态资源未找到', 404);
    }
  }

  // API
  const key = `${req.method} ${path}`;
  const handler = routes[key];
  if (!handler) {
    if (path === '/') {
      return json(res, {
        ok: true,
        service: '沸点创意 Boiling Point API',
        endpoints: Object.keys(routes),
        sites: STATIC_MAP.filter((m) => existsSync(m.dir)).map((m) => m.prefix),
      });
    }
    return fail(res, `未找到路由 ${key}`, 404);
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const data = await handler(u, body);
    if (data === null || data === undefined) return fail(res, '暂无数据', 404);
    return ok(res, data);
  } catch (e) {
    return fail(res, e.message, e.status || 500);
  }
});

/* ---------------- 每日定时 ---------------- */

function msUntilNextRun(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

let cronTimer = null;
function scheduleDaily() {
  if (cronTimer) clearTimeout(cronTimer);
  const delay = msUntilNextRun(CRON_HOUR);
  cronTimer = setTimeout(async () => {
    try {
      const r = await runAgent({ db, dateKey: toDateKey(), limit: DEFAULT_LIMIT, metric: METRIC });
      lastRunAt = new Date().toISOString();
      console.log(`[cron] ${toDateKey()} Agent 值守完成：健康分 ${r.healthScore}（${r.grade}），数据源 ${r.source}`);
      for (const a of r.brief.nextActions) console.log(`[cron] 下一步：${a}`);
    } catch (e) {
      console.error('[cron] Agent 值守失败:', e.message);
    }
    scheduleDaily();
  }, delay);
  console.log(`[cron] 下次执行：${new Date(Date.now() + delay).toLocaleString('zh-CN')}（每天 ${CRON_HOUR}:00，由 Agent 值守）`);
}

/* ---------------- boot ---------------- */

async function boot() {
  // 启动时为今天补一次（若无数据）
  try {
    const today = toDateKey();
    if (!getReport(db, today)) {
      console.log('[boot] 今日无数据，Agent 开始值守…');
      const r = await runAgent({ db, dateKey: today, limit: DEFAULT_LIMIT, metric: METRIC });
      lastRunAt = new Date().toISOString();
      console.log(`[boot] ${today} 值守完成：${r.qa.metrics.sampleSize} 条，健康分 ${r.healthScore}（${r.grade}），数据源 ${r.source}`);
    }
  } catch (e) {
    console.error('[boot] 生成失败:', e.message);
  }
  scheduleDaily();
  server.listen(PORT, () => {
    console.log(`\n  沸点创意 API 已启动  →  http://localhost:${PORT}`);
    console.log(`  数据文件: ${DB_PATH}`);
    console.log(`  数据模式: ${process.env.BOILING_DATA_MODE || 'auto'}（auto=真实优先，失败降级仿真）\n`);
  });
}

boot();

export { server, db };
