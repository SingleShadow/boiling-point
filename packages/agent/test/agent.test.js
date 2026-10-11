import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';

import { getDb } from '../../core/src/store/db.js';
import { evaluateReport } from '../src/evaluate.js';
import { planActions, planRepair } from '../src/plan.js';
import {
  runAgent, planOnly, ensureAgentSchema, learn,
  remember, recall, listMemory, addFinding, listFindings, getAgentStats, getSnapshot,
} from '../src/agent.js';

const DB_PATH = 'data/agent-test.db';
let db;

before(() => {
  rmSync(DB_PATH, { force: true });
  rmSync(`${DB_PATH}-shm`, { force: true });
  rmSync(`${DB_PATH}-wal`, { force: true });
  db = getDb(DB_PATH);
  ensureAgentSchema(db);
});

after(() => {
  try { db?.close(); } catch { /* 已关闭 */ }
  for (const f of [DB_PATH, `${DB_PATH}-shm`, `${DB_PATH}-wal`]) rmSync(f, { force: true });
});

/* ---------------- 质检层 ---------------- */

function fakeReport(n = 10, topicNames = ['剧情演绎', '美食探店', '知识科普']) {
  const top10 = Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    id: `v${i}`,
    title: `标题${i}`,
    boilingScore: 95 - i * 3,
    dimensions: {
      topic: { primary: { id: `t${i % topicNames.length}`, name: topicNames[i % topicNames.length] }, tags: [{ id: 'x', name: 'x', confidence: 0.9 }], summary: '' },
      copy: { tags: [{ id: 'y', name: 'y', confidence: 0.8 }], summary: '' },
      rhythm: { tags: [{ id: 'z', name: 'z', confidence: 0.8 }], summary: '' },
      craft: { tags: [{ id: 'w', name: 'w', confidence: 0.8 }], summary: '' },
    },
  }));
  return {
    date: '2026-01-01',
    source: 'douyin',
    generatedAt: new Date().toISOString(),
    top10,
    directions: [
      { title: 'a', hookTemplate: 'x', angle: 'y', durationAdvice: 'z' },
      { title: 'b', hookTemplate: 'x', angle: 'y', durationAdvice: 'z' },
      { title: 'c', hookTemplate: 'x', angle: 'y', durationAdvice: 'z' },
    ],
    tagFrequencies: [{ tagId: 't1', name: '剧情演绎', count: 3, prevCount: 1, delta: 2 }],
    audienceInsight: { topTopics: [{ name: '剧情演绎', share: 0.4 }], avgBoilingScore: 80 },
  };
}

test('质检：完整真实数据应判为 A 级满分', () => {
  const qa = evaluateReport({ report: fakeReport(), expected: 10, source: 'douyin' });
  assert.equal(qa.score, 100);
  assert.equal(qa.grade, 'A');
  assert.equal(qa.issues.length, 0);
});

test('质检：样本不足 / 维度缺失 / 题材单一 均要扣分', () => {
  const rep = fakeReport(6, ['剧情演绎']);
  rep.top10[0].dimensions.copy.tags = [];
  const qa = evaluateReport({ report: rep, expected: 10, source: 'douyin' });
  const codes = qa.issues.map((i) => i.code);
  assert.ok(codes.includes('sample_incomplete'), '应检出样本不足');
  assert.ok(codes.includes('dimension_missing'), '应检出维度缺失');
  assert.ok(codes.includes('diversity_low'), '应检出题材单一');
  assert.ok(qa.score < 70);
});

test('质检：仿真数据应被标为非真实来源', () => {
  const qa = evaluateReport({ report: fakeReport(), expected: 10, source: 'simulated' });
  assert.ok(qa.issues.some((i) => i.code === 'not_live_data'));
  assert.equal(qa.score, 85);
});

test('质检：无报告直接 0 分 D 级', () => {
  const qa = evaluateReport({ report: null, expected: 10 });
  assert.equal(qa.score, 0);
  assert.equal(qa.grade, 'D');
});

/* ---------------- 规划层 ---------------- */

const baseObs = {
  dateKey: '2026-01-01',
  limit: 10,
  metric: 'play',
  today: { hasReport: false, ageHours: null },
  live: { ok: false, available: false, detail: '未配置凭据' },
  gaps: [],
  experience: {},
  topicHistory: [],
};

test('规划：今日无报告时执行抓取，未配置数据源时登记告警', () => {
  const p = planActions(baseObs, { dateKey: '2026-01-01' });
  assert.ok(p.actions.some((a) => a.type === 'run_daily'));
  assert.ok(p.actions.some((a) => a.type === 'alert' && a.category === 'data-source'));
  assert.equal(p.mode, 'simulated');
  assert.ok(p.rationale.length >= 2, '决策必须给出理由');
});

test('规划：已有报告时改为复检，不重复抓取', () => {
  const obs = { ...baseObs, today: { hasReport: true, ageHours: 2 } };
  const p = planActions(obs, { dateKey: '2026-01-01' });
  assert.ok(p.actions.some((a) => a.type === 'verify'));
  assert.ok(!p.actions.some((a) => a.type === 'run_daily'));
});

test('规划：历史缺口一次最多补 3 天', () => {
  const obs = { ...baseObs, gaps: ['2025-12-25', '2025-12-26', '2025-12-27', '2025-12-28', '2025-12-29'] };
  const p = planActions(obs, { dateKey: '2026-01-01' });
  const bf = p.actions.filter((a) => a.type === 'backfill_gap');
  assert.equal(bf.length, 3);
  assert.ok(p.actions.some((a) => a.type === 'alert' && a.category === 'history'));
});

test('规划：连续 3 天题材不变要登记趋势僵化预警', () => {
  const obs = { ...baseObs, topicHistory: [{ topic: '萌宠' }, { topic: '萌宠' }, { topic: '萌宠' }] };
  const p = planActions(obs, { dateKey: '2026-01-01' });
  assert.ok(p.actions.some((a) => a.category === 'trend' && a.severity === 'warn'));
});

test('规划：修复动作只在重跑确实能改善时才产生', () => {
  const qaGood = { score: 70, issues: [{ code: 'not_live_data', severity: 'warn' }] };
  assert.equal(planRepair(qaGood, baseObs, { dateKey: '2026-01-01' }), null, '数据源问题重跑无意义');

  const qaBad = { score: 70, issues: [{ code: 'diversity_low', severity: 'warn' }] };
  const rep = planRepair(qaBad, baseObs, { dateKey: '2026-01-01', limit: 10 });
  assert.ok(rep, '样本质量问题应触发修复');
  assert.equal(rep.actions[0].limit, 15, '应扩大候选池');
  assert.equal(rep.actions[0].metric, 'interaction', '应切换排序指标');
});

/* ---------------- 记忆层 ---------------- */

test('记忆：写入、读取、置信度融合与命中计数', () => {
  remember(db, { key: 'test:key', value: { a: 1 }, category: 'test', confidence: 0.5 });
  const m1 = recall(db, 'test:key');
  assert.deepEqual(m1.value, { a: 1 });
  assert.equal(m1.hits, 1);

  remember(db, { key: 'test:key', value: { a: 2 }, category: 'test', confidence: 1 });
  const m2 = recall(db, 'test:key');
  assert.deepEqual(m2.value, { a: 2 });
  assert.equal(m2.hits, 2);
  assert.equal(m2.confidence, 0.7, '置信度应按 0.6/0.4 加权融合');
});

test('记忆：findings 可按严重级别过滤', () => {
  addFinding(db, { dateKey: '2026-01-01', category: 'test', severity: 'info', title: '提示' });
  addFinding(db, { dateKey: '2026-01-01', category: 'test', severity: 'error', title: '错误' });
  const all = listFindings(db, { limit: 50 });
  const errs = listFindings(db, { limit: 50, minSeverity: 'error' });
  assert.ok(all.length >= 2);
  assert.ok(errs.every((f) => f.severity === 'error' || f.severity === 'critical'));
});

test('学习：连续失败计数会随成功清零', () => {
  const obsFail = { live: { ok: false, available: true, detail: '超时' }, topicHistory: [], metric: 'play' };
  learn(db, { dateKey: '2026-01-01', obs: obsFail, qa: { score: 60 }, source: 'simulated' });
  const s1 = Number(recall(db, 'source:douyin:consecutive_fail').value);
  learn(db, { dateKey: '2026-01-02', obs: obsFail, qa: { score: 60 }, source: 'simulated' });
  const s2 = Number(recall(db, 'source:douyin:consecutive_fail').value);
  assert.equal(s2, s1 + 1, '连续失败应累加');

  learn(db, { dateKey: '2026-01-03', obs: { ...obsFail, live: { ok: true, available: true } }, qa: { score: 90 }, source: 'douyin' });
  assert.equal(Number(recall(db, 'source:douyin:consecutive_fail').value), 0, '成功后应清零');
});

test('学习：质量基线记录滑动平均分', () => {
  learn(db, { dateKey: '2026-02-01', obs: { live: { ok: true, available: true }, topicHistory: [] }, qa: { score: 100 }, source: 'douyin', report: { audienceInsight: { topTopics: [{ name: '美食' }] } } });
  const base = recall(db, 'quality:baseline').value;
  assert.ok(base.samples >= 1);
  assert.ok(base.avg > 0);
  assert.equal(recall(db, 'ops:last_success_date').value, '2026-02-01');
});

/* ---------------- 端到端 ---------------- */

test('端到端：完整值守跑通（仿真模式）', async () => {
  const r = await runAgent({ db, dateKey: '2026-03-01', limit: 10, mode: 'simulated', metric: 'play' });
  assert.equal(r.dateKey, '2026-03-01');
  assert.ok(r.actions.length > 0, '应产生执行动作');
  assert.ok(r.report, '应产出报告');
  assert.ok(r.report.top10.length >= 10, `榜单应含 10 条，实际 ${r.report.top10?.length}`);
  assert.ok(r.healthScore > 0 && r.healthScore <= 100);
  assert.ok(r.brief.markdown.includes('Agent 值守简报'));
  assert.ok(['ok', 'degraded', 'failed'].includes(r.status));
  assert.equal(r.source, 'simulated');
});

test('端到端：复检模式不重复抓取', async () => {
  const r = await runAgent({ db, dateKey: '2026-03-01', limit: 10, mode: 'simulated' });
  assert.ok(r.actions.some((a) => a.type === 'verify'), '已有报告应进入复检');
  assert.ok(!r.actions.some((a) => a.type === 'run_daily'));
});

test('端到端：planOnly 不写库且给出决策理由', async () => {
  const { observation, plan } = await planOnly({ db, dateKey: '2026-03-02', limit: 10 });
  assert.equal(observation.dateKey, '2026-03-02');
  assert.ok(plan.rationale.length > 0);
  const rep = db.prepare('SELECT date_key FROM reports WHERE date_key=?').get('2026-03-02');
  assert.equal(rep, undefined, 'planOnly 不应产生报告');
});

test('快照：KPI 与记忆可被读取', () => {
  const s = getSnapshot(db, { dateKey: '2026-03-01' });
  assert.ok(s.today, '应能取到今日值守记录');
  assert.equal(s.today.dateKey, '2026-03-01');
  assert.ok(s.stats.total >= 1);
  assert.ok(Array.isArray(s.memory));
  assert.ok(s.memory.length > 0);
  assert.ok(listMemory(db).length > 0);
  assert.ok(typeof getAgentStats(db).successRate === 'number');
});
