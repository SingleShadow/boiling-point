#!/usr/bin/env node
/**
 * Agent 工作留痕 · 检索与补录 CLI
 *
 * 查看今天全部留痕：        node packages/core/bin/agentlog.js view
 * 看某个 agent 某天：       node packages/core/bin/agentlog.js view --agent xiaofei --date 2026-10-13
 * 只看失败：                node packages/core/bin/agentlog.js view --status fail
 * 统计（成功率/耗时）：      node packages/core/bin/agentlog.js stats
 * 列出有哪些 agent/日期：    node packages/core/bin/agentlog.js list
 * 手动补一条（角色Agent用）：node packages/core/bin/agentlog.js add --agent afu --task "设计接口" --source story-12 --status ok --duration 1200
 *
 * 全部命令支持 --json（机器可读）与 --root <dir>（指定日志根目录）。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, dateKey, REPO_ROOT } from '../src/audit/logger.js';

/* ---------------- 参数 ---------------- */

const argv = process.argv.slice(2);
const cmd = argv[0] || 'view';
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const [k, inline] = a.slice(2).split('=');
  if (inline !== undefined) { flags[k] = inline; continue; }
  const next = argv[i + 1];
  if (next && !next.startsWith('--')) { flags[k] = next; i++; } else { flags[k] = true; }
}

const root = flags.root || process.env.AGENT_LOG_DIR || join(REPO_ROOT, 'logs');
const agentsDir = join(root, 'agents');
const json = Boolean(flags.json);

/* ---------------- 读取 ---------------- */

function parseFile(file, agentId) {
  const out = [];
  const txt = readFileSync(file, 'utf8');
  for (const line of txt.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { out.push({ ...JSON.parse(s), __agentDir: agentId }); } catch { /* 坏行跳过，不阻断查看 */ }
  }
  return out;
}

function listAgentIds() {
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

function readEntries({ agent, date } = {}) {
  const ids = agent ? [agent] : listAgentIds();
  const all = [];
  for (const id of ids) {
    const dir = join(agentsDir, id);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    for (const f of files) {
      if (date && f !== `${date}.jsonl`) continue;
      all.push(...parseFile(join(dir, f), id));
    }
  }
  return all.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

/* ---------------- 展示 ---------------- */

const fmtDur = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
const color = (s, ok) => (json ? s : (ok ? `\x1b[32m${s}\x1b[0m` : `\x1b[31m${s}\x1b[0m`));

function printEntry(e) {
  const time = String(e.ts || '').slice(11, 19);
  const ok = e.status === 'ok';
  const head = `[${time}] ${color(ok ? 'ok  ' : 'FAIL', ok)} ${e.agentName || e.agentId}/${e.agentId}  ${e.task}  ${fmtDur(e.durationMs || 0)}  trace=${e.traceId}`;
  console.log(head);
  console.log(`       来源: ${e.source}`);
  if (e.steps?.length) console.log(`       步骤: ${e.steps.map((s) => s.name).join(' → ')}`);
  if (e.tools?.length) console.log(`       工具: ${e.tools.map((t) => t.name).join(', ')}`);
  if (e.result !== null && e.result !== undefined) {
    console.log(`       结果: ${typeof e.result === 'object' ? JSON.stringify(e.result) : e.result}`);
  }
  if (e.error) console.log(`       错误: ${e.error.name}: ${e.error.message}`);
  if (e.degraded) console.log(`       ⚠ 降级写入（原始目录不可写）: ${e.writeError || ''}`);
  console.log('');
}

/* ---------------- 命令 ---------------- */

function cmdView() {
  const date = flags.date || (flags.all ? undefined : dateKey());
  let entries = readEntries({ agent: flags.agent, date });
  if (flags.status) entries = entries.filter((e) => e.status === flags.status);
  const last = Number(flags.last || 0);
  if (last > 0) entries = entries.slice(-last);

  if (json) { console.log(JSON.stringify(entries, null, 2)); return; }
  if (!entries.length) {
    console.log(`没有留痕记录。${date ? `日期 ${date}` : ''}${flags.agent ? ` agent=${flags.agent}` : ''}`);
    console.log(`日志根目录：${root}`);
    return;
  }
  console.log(`共 ${entries.length} 条${date ? `（${date}）` : ''}\n`);
  entries.forEach(printEntry);
}

function cmdList() {
  const ids = listAgentIds();
  if (!ids.length) { console.log(`还没有任何留痕。日志根目录：${root}`); return; }
  const rows = ids.map((id) => {
    const dir = join(agentsDir, id);
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
    const counts = files.map((f) => `${f.replace('.jsonl', '')}(${parseFile(join(dir, f), id).length})`);
    return { agent: id, dates: counts };
  });
  if (json) { console.log(JSON.stringify(rows, null, 2)); return; }
  console.log(`日志根目录：${root}\n`);
  rows.forEach((r) => console.log(`  ${r.agent.padEnd(14)} ${r.dates.join('  ')}`));
}

function cmdStats() {
  const date = flags.date || undefined;
  const entries = readEntries({ agent: flags.agent, date });
  const byAgent = {};
  for (const e of entries) {
    const k = e.agentId;
    byAgent[k] = byAgent[k] || { agent: k, name: e.agentName, total: 0, ok: 0, fail: 0, ms: 0 };
    byAgent[k].total++;
    if (e.status === 'ok') byAgent[k].ok++; else byAgent[k].fail++;
    byAgent[k].ms += e.durationMs || 0;
  }
  const rows = Object.values(byAgent).map((r) => ({
    agent: r.agent, name: r.name, total: r.total,
    ok: r.ok, fail: r.fail,
    successRate: r.total ? `${Math.round((r.ok / r.total) * 100)}%` : '-',
    avgMs: r.total ? Math.round(r.ms / r.total) : 0,
    totalMs: r.ms,
  }));
  if (json) { console.log(JSON.stringify(rows, null, 2)); return; }
  if (!rows.length) { console.log(`没有数据。${date ? `日期 ${date}` : ''}`); return; }
  console.log(`${date || '全部日期'} 统计：\n`);
  console.log('  agent'.padEnd(16) + '总数'.padEnd(7) + '成功'.padEnd(7) + '失败'.padEnd(7) + '成功率'.padEnd(9) + '平均耗时');
  rows.forEach((r) => {
    console.log(`  ${String(r.agent).padEnd(14)}${String(r.total).padEnd(7)}${String(r.ok).padEnd(7)}${String(r.fail).padEnd(7)}${String(r.successRate).padEnd(9)}${fmtDur(r.avgMs)}`);
  });
}

function cmdAdd() {
  if (!flags.agent || !flags.task) {
    console.error('用法：add --agent <id> --task <任务名> [--source <来源>] [--status ok|fail] [--duration <ms>] [--error <错误信息>] [--name <中文名>] [--note <备注>]');
    process.exit(1);
  }
  const log = createLogger({ agentId: flags.agent, agentName: flags.name || flags.agent, root });
  log.record({
    task: flags.task,
    source: flags.source || 'manual',
    status: flags.status === 'fail' ? 'fail' : 'ok',
    durationMs: Number(flags.duration || 0),
    error: flags.error ? new Error(String(flags.error)) : null,
    context: flags.note ? { note: flags.note } : {},
  });
  log.close();
  // 不 await flush：补日志绝不能卡住调用方；退出钩子会兜底刷写
  log.flush().catch(() => {});
  console.log(`已记录：${flags.agent} / ${flags.task}`);
}

const map = { view: cmdView, list: cmdList, stats: cmdStats, add: cmdAdd, tail: cmdView };
const fn = map[cmd];
if (!fn) {
  console.error(`未知命令：${cmd}（可用：view / list / stats / add / tail）`);
  process.exit(1);
}
fn();
