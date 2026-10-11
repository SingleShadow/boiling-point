import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb, closeDb, getReport, getDayVideos, getStats } from '../src/store/db.js';
import { runDaily } from '../src/pipeline.js';

let dir;
let db;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'boiling-test-'));
  db = getDb(join(dir, 'test.db'));
});

after(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

test('runDaily 完成抓取->分析->出报->落库', async () => {
  const r = await runDaily({ db, dateKey: '2026-09-15', limit: 10, mode: 'simulated' });
  assert.equal(r.entries.length, 10);
  assert.equal(r.report.date, '2026-09-15');
  assert.ok(r.report.markdown.includes('沸点创意'));
  assert.ok(r.report.audienceInsight.summaryText.length > 20);
  assert.ok(r.report.directions.length >= 1);

  const stored = getDayVideos(db, '2026-09-15');
  assert.equal(stored.length, 10);
  assert.ok(stored[0].analysis, 'analysis 应已落库');

  const rep = getReport(db, '2026-09-15');
  assert.equal(rep.date, '2026-09-15');
  assert.equal(rep.top10.length, 10);
});

test('第二天运行时能计算标签环比', async () => {
  await runDaily({ db, dateKey: '2026-09-16', limit: 10, mode: 'simulated' });
  const rep = getReport(db, '2026-09-16');
  assert.equal(rep.date, '2026-09-16');
  const withPrev = rep.tagFrequencies.filter((t) => !t.isNew);
  assert.ok(withPrev.length > 0, '应存在可对比的历史标签');
  assert.ok('delta' in withPrev[0]);
});

test('报告包含创作方向建议与热门话题', async () => {
  const rep = getReport(db, '2026-09-16');
  assert.ok(rep.directions.length >= 1);
  const d = rep.directions[0];
  assert.ok(d.topic && d.hookTemplate && d.durationAdvice && d.craftAdvice && d.whyHot);
  assert.ok(rep.audienceInsight.hotTopics.length > 0);
});

test('getStats 汇总正确', () => {
  const s = getStats(db);
  assert.equal(s.days, 2);
  assert.equal(s.videos, 20);
  assert.equal(s.reports, 2);
  assert.equal(s.lastRun.status, 'ok');
});
