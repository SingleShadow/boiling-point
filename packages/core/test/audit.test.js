/**
 * Agent 工作留痕 · 测试
 * 覆盖：脱敏、字段完整、按 agent/日期归档、不阻塞不抛错、三级降级、失败记录错误。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger, sanitize, dateKey } from '../src/audit/logger.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'audit-'));

test('脱敏：敏感键整值抹除', () => {
  const out = sanitize({ password: 'abc123', apiKey: 'x', token: 't', normal: 'keep' });
  assert.equal(out.password, '***已脱敏***');
  assert.equal(out.apiKey, '***已脱敏***');
  assert.equal(out.token, '***已脱敏***');
  assert.equal(out.normal, 'keep');
});

test('脱敏：邮箱部分掩码 + 超长字符串截断', () => {
  const out = sanitize({ email: 'zhishuai.cui@example.com', bio: 'x'.repeat(900) });
  assert.match(out.email, /^zhi\*\*\*@example\.com$/);
  assert.ok(out.bio.length < 600 && out.bio.includes('已截断'));
});

test('脱敏：控制深度与数组长度，避免日志爆炸', () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: '底' } } } } } } };
  const out = sanitize(deep);
  assert.ok(JSON.stringify(out).includes('深度超限'));
  const arr = sanitize({ list: Array.from({ length: 200 }, (_, i) => i) });
  assert.equal(arr.list.length, 50);
});

test('日志按 agent 与日期归档，字段完整', async () => {
  const root = tmp();
  const log = createLogger({ agentId: 'xiaofei', agentName: '小沸', root });
  const h = log.task({ task: '每日值守', source: 'cron:09:00', context: { dateKey: '2026-10-13' } });
  h.step('感知', { limit: 10 }).step('规划');
  h.tool('db.query', { table: 'videos' }).tool('api.bilibili', { path: '/popular' });
  h.ok({ healthScore: 94 });
  await log.flush();

  const file = join(root, 'agents', 'xiaofei', `${dateKey()}.jsonl`);
  assert.ok(existsSync(file), `应生成 ${file}`);
  const entry = JSON.parse(readFileSync(file, 'utf8').trim().split('\n')[0]);

  assert.equal(entry.agentId, 'xiaofei');
  assert.equal(entry.agentName, '小沸');
  assert.equal(entry.task, '每日值守');
  assert.equal(entry.source, 'cron:09:00');
  assert.equal(entry.status, 'ok');
  assert.equal(entry.steps.length, 2);
  assert.equal(entry.tools.length, 2);
  assert.equal(entry.tools[0].name, 'db.query');
  assert.ok(typeof entry.durationMs === 'number' && entry.durationMs >= 0);
  assert.ok(entry.ts && entry.startAt && entry.endAt);
  assert.equal(entry.error, null);
  log.close();
});

test('失败任务记录异常信息', async () => {
  const root = tmp();
  const log = createLogger({ agentId: 'afu', agentName: '阿服', root });
  log.record({ task: '实现接口', source: 'story-12', status: 'fail', error: new TypeError('字段缺失') });
  await log.flush();

  const file = join(root, 'agents', 'afu', `${dateKey()}.jsonl`);
  const entry = JSON.parse(readFileSync(file, 'utf8').trim());
  assert.equal(entry.status, 'fail');
  assert.equal(entry.error.name, 'TypeError');
  assert.match(entry.error.message, /字段缺失/);
  log.close();
});

test('run() 包装：抛错时记录 fail 且继续向上抛（不吞异常）', async () => {
  const root = tmp();
  const log = createLogger({ agentId: 'ace', root });
  await assert.rejects(
    () => log.run({ task: '会失败的任务', source: 'test' }, () => { throw new Error('boom'); }),
    /boom/,
  );
  await log.flush();
  const file = join(root, 'agents', 'ace', `${dateKey()}.jsonl`);
  const entry = JSON.parse(readFileSync(file, 'utf8').trim());
  assert.equal(entry.status, 'fail');
  log.close();
});

test('写入失败不抛错、不阻塞主流程（三级降级）', async () => {
  const root = tmp();
  // 用一个「文件」当目录，让 mkdir 必然失败
  const blocker = join(root, 'blocker');
  writeFileSync(blocker, 'not a dir', 'utf8');
  const log = createLogger({ agentId: 'ghost', root: join(blocker, 'logs') });

  // 不应抛出
  await assert.doesNotReject(async () => {
    log.record({ task: '写不进去也要活', source: 'test' });
    await log.flush();
  });
  // 队列已清空（要么落盘要么降级到控制台），主流程不受影响
  assert.equal(log.pending, 0);
  log.close();
});

test('同一 agent 多次任务追加在同一天的文件里，可回溯', async () => {
  const root = tmp();
  const log = createLogger({ agentId: 'ace', root });
  log.record({ task: '任务A', source: 'a' });
  log.record({ task: '任务B', source: 'b' });
  await log.flush();
  const lines = readFileSync(join(root, 'agents', 'ace', `${dateKey()}.jsonl`), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  log.close();
});
