/**
 * 沸点创意 · 内容情报 Agent
 *
 * 职责（一句话）：对「每天产出一份可信的抖音爆款趋势报告」这件事负全责。
 *
 * 闭环：感知 → 规划 → 执行 → 质检 →（不合格则修复重跑）→ 沉淀记忆 → 出简报
 * 与定时脚本的区别：它会判断环境、解释自己的决策、给自己打分、失败会补救、经验会累积。
 */
import { getDb, getReport } from '../../core/src/store/db.js';
import { toDateKey, shiftDateKey } from '../../core/src/utils/date.js';
import { observe, probeLiveSource } from './sense.js';
import { planActions, planRepair, REPAIR_THRESHOLD } from './plan.js';
import { executePlan } from './act.js';
import { evaluateReport } from './evaluate.js';
import { buildBrief } from './brief.js';
import {
  ensureAgentSchema, startAgentRun, finishAgentRun, remember, recall,
  listMemory, listFindings, listAgentRuns, latestAgentRun, getAgentStats, addFinding,
} from './memory.js';

/** 只感知与规划，不执行 —— 用于展示「Agent 现在在想什么」 */
export async function planOnly(opts = {}) {
  const db = opts.db || getDb();
  ensureAgentSchema(db);
  const obs = await observe(db, opts);
  const plan = planActions(obs, opts);
  return { observation: obs, plan };
}

/**
 * 执行一次完整值守
 */
export async function runAgent(opts = {}) {
  const db = opts.db || getDb();
  ensureAgentSchema(db);
  const dateKey = opts.dateKey || toDateKey();
  const limit = Number(opts.limit || 10);
  const metric = opts.metric || 'play';
  const t0 = Date.now();

  const runId = startAgentRun(db, { dateKey });

  /* 1. 感知 */
  const obs = await observe(db, { dateKey, limit, metric });

  /* 2. 规划 */
  const plan = planActions(obs, { dateKey, limit, metric, force: opts.force, mode: opts.mode });

  /* 3. 执行 */
  const exec = await executePlan(db, plan.actions, { dateKey, limit, metric, mode: plan.mode });
  let report = exec.report;
  let source = exec.source;
  let actions = exec.results;
  let repaired = false;

  /* 4. 质检 */
  let qa = evaluateReport({ report, expected: limit, source });

  /* 5. 不合格则修复重跑（至多一轮，避免死循环） */
  if (qa.score < REPAIR_THRESHOLD && report) {
    const repair = planRepair(qa, obs, { dateKey, limit });
    if (repair) {
      const re = await executePlan(db, repair.actions, { dateKey, limit, metric });
      const qa2 = evaluateReport({ report: re.report, expected: limit, source: re.source });
      actions = actions.concat(re.results.map((r) => ({ ...r, reason: repair.actions[0]?.reason || '修复跑' })));
      if (qa2.score >= qa.score) {
        report = re.report || report;
        source = re.source || source;
        qa = qa2;
      }
      repaired = true;
      addFinding(db, {
        dateKey,
        category: 'quality',
        severity: qa.score >= REPAIR_THRESHOLD ? 'info' : 'warn',
        title: `质检触发修复跑：${qa.score} 分`,
        detail: repair.rationale.join('；'),
      });
    }
  }

  /* 6. 沉淀记忆 */
  learn(db, { dateKey, obs, qa, source: source || report?.source, report, repaired });

  /* 7. 出简报 */
  const brief = buildBrief({ dateKey, observation: obs, plan, actions, qa, report, source, durationMs: Date.now() - t0, repaired });

  const status = brief.status;
  finishAgentRun(db, runId, {
    status,
    healthScore: qa.score,
    grade: qa.grade,
    source: source || report?.source || '',
    sampleSize: qa.metrics?.sampleSize || 0,
    durationMs: Date.now() - t0,
    observation: obs,
    plan,
    actions,
    issues: qa.issues,
    brief,
    message: brief.headline,
  });

  return {
    dateKey,
    runId,
    status,
    healthScore: qa.score,
    grade: qa.grade,
    source: source || report?.source || '',
    observation: obs,
    plan,
    actions,
    qa,
    repaired,
    report,
    brief,
    durationMs: Date.now() - t0,
  };
}

/* ---------------- 学习与进化 ---------------- */

export function learn(db, { dateKey, obs, qa, source, report, repaired }) {
  /* 数据源健康度：累计成功/失败，用于连续失败升级告警 */
  const health = recall(db, 'source:douyin:health')?.value || { ok: 0, fail: 0, lastError: '' };
  const liveOk = Boolean(obs?.live?.ok);
  const nextHealth = {
    ok: (health.ok || 0) + (liveOk ? 1 : 0),
    fail: (health.fail || 0) + (obs?.live?.available && !liveOk ? 1 : 0),
    lastOkAt: liveOk ? dateKey : (health.lastOkAt || ''),
    lastError: liveOk ? '' : (obs?.live?.detail || health.lastError || ''),
  };
  remember(db, { key: 'source:douyin:health', value: nextHealth, category: 'data-source', confidence: 0.9 });

  /* 连续失败计数 */
  const streak = Number(recall(db, 'source:douyin:consecutive_fail')?.value || 0);
  const nextStreak = obs?.live?.available ? (liveOk ? 0 : streak + 1) : streak;
  remember(db, { key: 'source:douyin:consecutive_fail', value: nextStreak, category: 'data-source', confidence: 0.8 });

  /* 质量基线：滑动平均 */
  const base = recall(db, 'quality:baseline')?.value || { avg: 0, samples: 0, best: 0, worst: 100 };
  const samples = (base.samples || 0) + 1;
  const avg = Math.round(((base.avg || 0) * (samples - 1) + qa.score) / samples * 10) / 10;
  remember(db, {
    key: 'quality:baseline',
    value: { avg, samples, best: Math.max(base.best || 0, qa.score), worst: Math.min(base.worst ?? 100, qa.score) },
    category: 'quality',
    confidence: 0.85,
  });

  /* 题材稳定性 */
  const series = (obs?.topicHistory || []).map((t) => t.topic).filter(Boolean);
  const current = report?.audienceInsight?.topTopics?.[0]?.name;
  if (current) series.push(current);
  const tail = series.slice(-7);
  let repeat = 1;
  for (let i = tail.length - 1; i > 0; i--) {
    if (tail[i] === tail[i - 1]) repeat++;
    else break;
  }
  remember(db, {
    key: 'trend:topic_stability',
    value: { recent: tail, repeatedDays: repeat, dominant: tail[tail.length - 1] || '' },
    category: 'trend',
    confidence: 0.8,
  });

  /* 运营节点 */
  if (qa.score > 0 && report) {
    remember(db, { key: 'ops:last_success_date', value: dateKey, category: 'ops', confidence: 1 });
  }

  /* 经验条目：把"今天做对了什么/做错了什么"变成可检索的知识 */
  if (qa.score >= 95) {
    remember(db, {
      key: `insight:healthy:${dateKey}`,
      value: { score: qa.score, source, sampleSize: qa.metrics?.sampleSize ?? 0, metric: obs?.metric },
      category: 'insight',
      confidence: 0.7,
    });
  }
  if (repaired) {
    remember(db, {
      key: `insight:repaired:${dateKey}`,
      value: { finalScore: qa.score, issues: qa.issues.map((i) => i.code) },
      category: 'insight',
      confidence: 0.75,
    });
  }
}

/* ---------------- 快照 ---------------- */

export function getSnapshot(db, { dateKey } = {}) {
  const dbh = db || getDb();
  ensureAgentSchema(dbh);
  const day = dateKey || toDateKey();
  return {
    dateKey: day,
    today: latestAgentRun(dbh, day),
    latest: latestAgentRun(dbh),
    report: getReport(dbh, day),
    stats: getAgentStats(dbh),
    memory: listMemory(dbh),
    findings: listFindings(dbh, { limit: 20 }),
    runs: listAgentRuns(dbh, 7),
  };
}

/** 守护模式：周期性检查，缺数据就值守一次 */
export async function startDaemon(opts = {}) {
  const intervalMs = Number(opts.intervalMs || 30 * 60 * 1000);
  const hour = Number(opts.hour ?? 9);
  let timer = null;
  let running = false;
  let lastRunDateKey = null;

  const tick = async () => {
    if (running) return;
    const today = toDateKey();
    const hourNow = new Date().getHours();
    if (lastRunDateKey === today) return;
    if (hourNow < hour) return;
    running = true;
    try {
      const r = await runAgent({ ...opts, dateKey: today });
      lastRunDateKey = today;
      console.log(`[agent] ${today} 值守完成：健康分 ${r.healthScore}（${r.grade}），数据源 ${r.source}`);
      if (r.brief?.nextActions?.length) {
        for (const a of r.brief.nextActions) console.log(`[agent] 下一步：${a}`);
      }
    } catch (e) {
      console.error(`[agent] 值守失败：${e.message}`);
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  await tick();
  return {
    stop: () => { if (timer) clearInterval(timer); timer = null; },
    tick,
    intervalMs,
    hour,
  };
}

export {
  observe, probeLiveSource, planActions, planRepair, executePlan, evaluateReport, buildBrief,
  ensureAgentSchema, remember, recall, listMemory, listFindings, listAgentRuns, latestAgentRun,
  getAgentStats, addFinding, shiftDateKey,
};
