/**
 * Agent 工作留痕 · 结构化日志内核
 *
 * 设计约束（对应需求）：
 *  1. 结构化：每条任务一行 JSONL，含 时间 / agent 标识 / 任务名与来源 / 关键步骤 /
 *     调用的工具或接口 / 执行结果 / 耗时 / 异常与错误。
 *  2. 不阻塞：调用方只入队，写入在 setImmediate 里异步完成；**任何情况下都不 throw**。
 *  3. 三级降级：主目录写失败 → 写 _fallback/ → 再失败 → 控制台输出（绝不中断主流程）。
 *  4. 脱敏：token/password/secret 等键整值抹掉，邮箱部分掩码，超长字符串截断。
 *  5. 归档：logs/agents/<agentId>/<YYYY-MM-DD>.jsonl，按 agent 与日期天然分片。
 *
 * 零第三方依赖（仅 node: 内置模块）。
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

/* ---------------- 脱敏 ---------------- */

const SENSITIVE_KEY = /(token|password|passwd|secret|authorization|api[_-]?key|cookie|credential|private[_-]?key|access[_-]?key|signature|phone|mobile)/i;
const EMAIL_RE = /([A-Za-z0-9._%+-]{1,3})[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const MAX_STR = 500;
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;

function maskString(s) {
  let out = String(s).replace(EMAIL_RE, (_m, head, domain) => `${head}***${domain}`);
  if (out.length > MAX_STR) out = `${out.slice(0, MAX_STR)}…(已截断 ${out.length - MAX_STR} 字)`;
  return out;
}

/** 递归脱敏：敏感键整值抹除、字符串掩码+截断、控制深度与数组长度 */
export function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskString(value);
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[深度超限已省略]';
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? '***已脱敏***' : sanitize(v, depth + 1);
  }
  return out;
}

/* ---------------- 日期 ---------------- */

/** 本地日期键 YYYY-MM-DD（与报告口径一致，用本地时区而非 UTC） */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ---------------- 进程退出前兜底刷写 ---------------- */

const ACTIVE = new Set();
let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const dump = () => { for (const l of ACTIVE) l.__flushSync(); };
  process.on('beforeExit', dump);
  process.on('exit', dump);
}

/* ---------------- Logger ---------------- */

export function createLogger({ agentId, agentName, root } = {}) {
  if (!agentId) throw new Error('createLogger 必须传 agentId');

  const base = root || process.env.AGENT_LOG_DIR || join(REPO_ROOT, 'logs');
  const dir = join(base, 'agents', agentId);
  const fbDir = join(base, '_fallback');

  const queue = [];
  let flushing = false;
  let scheduled = false;

  /* --- 三级降级写入 --- */
  async function writeLine(file, line, entry) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      await appendFile(file, line, 'utf8');
      return true;
    } catch (e) {
      try {
        mkdirSync(fbDir, { recursive: true });
        const degraded = JSON.stringify({ ...entry, degraded: true, writeError: String(e?.message || e) }) + '\n';
        await appendFile(join(fbDir, `${entry.date}.jsonl`), degraded, 'utf8');
        return true;
      } catch (e2) {
        console.error('[audit] 日志写入彻底失败，降级为控制台输出：', JSON.stringify({
          ts: entry.ts, agentId: entry.agentId, task: entry.task, status: entry.status,
          err: String(e2?.message || e2),
        }));
        return false;
      }
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (queue.length) {
        const it = queue.shift();
        await writeLine(it.file, it.line, it.entry);
      }
    } finally {
      flushing = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => { scheduled = false; flush().catch(() => {}); });
  }

  /* 退出前同步兜底（此时不能用异步） */
  function flushSync() {
    const items = queue.splice(0, queue.length);
    for (const it of items) {
      try {
        mkdirSync(dirname(it.file), { recursive: true });
        appendFileSync(it.file, it.line, 'utf8');
      } catch {
        try {
          mkdirSync(fbDir, { recursive: true });
          const degraded = JSON.stringify({ ...it.entry, degraded: true, writeError: '退出前同步兜底写入' }) + '\n';
          appendFileSync(join(fbDir, `${it.entry.date}.jsonl`), degraded, 'utf8');
        } catch {
          console.error('[audit] 退出前写入失败（已尽力）：', it.entry.task);
        }
      }
    }
  }

  function enqueue(entry) {
    const safe = sanitize(entry);
    queue.push({
      file: join(dir, `${entry.date}.jsonl`),
      line: JSON.stringify(safe) + '\n',
      entry: safe,
    });
    schedule();
  }

  /** 开一个任务，返回可链式记录的句柄 */
  function task({ task: taskName, source, context } = {}) {
    const t = {
      traceId: randomUUID().slice(0, 8),
      agentId,
      agentName: agentName || agentId,
      task: taskName || '未命名任务',
      source: source || 'unknown',
      date: dateKey(),
      startAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      steps: [],
      tools: [],
      context: context || {},
      done: false,
    };

    function finish(status, result, error) {
      if (t.done) return;
      t.done = true;
      const now = new Date().toISOString();
      enqueue({
        ts: now,
        date: t.date,
        traceId: t.traceId,
        agentId: t.agentId,
        agentName: t.agentName,
        task: t.task,
        source: t.source,
        startAt: t.startAt,
        endAt: now,
        durationMs: Date.now() - t.startedAtMs,
        status,
        steps: t.steps,
        tools: t.tools,
        result: result === undefined ? null : result,
        error: error
          ? {
            name: error?.name || 'Error',
            message: String(error?.message || error),
            stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'),
          }
          : null,
        context: t.context,
        degraded: false,
      });
    }

    return {
      traceId: t.traceId,
      /** 记录一个关键步骤 */
      step(name, detail) {
        t.steps.push({ name, at: new Date().toISOString(), detail: detail === undefined ? null : detail });
        return this;
      },
      /** 记录一次工具/接口调用 */
      tool(name, meta) {
        t.tools.push({ name, at: new Date().toISOString(), meta: meta === undefined ? null : meta });
        return this;
      },
      ok(result) { finish('ok', result, null); },
      fail(error, extra) { finish('fail', extra, error); },
      end(status, result, error) { finish(status === 'fail' ? 'fail' : 'ok', result, error); },
    };
  }

  const logger = {
    agentId,
    agentName: agentName || agentId,
    logDir: dir,
    task,
    /** 一次性记录（没有步骤/工具的场景） */
    record({ task: taskName, source, status = 'ok', result = null, error = null, context = {}, durationMs = null, steps = [], tools = [] }) {
      const now = new Date().toISOString();
      const d = dateKey();
      enqueue({
        ts: now, date: d, traceId: randomUUID().slice(0, 8),
        agentId, agentName: agentName || agentId,
        task: taskName || '未命名任务', source: source || 'unknown',
        startAt: now, endAt: now,
        durationMs: durationMs === null ? 0 : Number(durationMs),
        status: status === 'fail' ? 'fail' : 'ok',
        steps, tools,
        result,
        error: error
          ? { name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n') }
          : null,
        context,
        degraded: false,
      });
    },
    /** 包一层执行：成功自动 ok，抛错自动 fail 后继续抛（不吞异常） */
    async run(meta, fn) {
      const h = task(meta);
      try {
        const r = await fn(h);
        h.ok(r === undefined ? null : summarize(r));
        return r;
      } catch (e) {
        h.fail(e);
        throw e;
      }
    },
    flush,
    close() { ACTIVE.delete(logger); },
    get pending() { return queue.length; },
    __flushSync: flushSync,
  };

  ACTIVE.add(logger);
  installHooks();
  return logger;
}

/** 结果摘要：避免把整个大对象写进日志 */
function summarize(r) {
  if (r === null || r === undefined) return null;
  if (typeof r !== 'object') return r;
  if (Array.isArray(r)) return { count: r.length };
  const keys = Object.keys(r);
  const out = {};
  for (const k of keys.slice(0, 12)) {
    const v = r[k];
    out[k] = Array.isArray(v) ? `[${v.length} 项]` : (v && typeof v === 'object' ? '{…}' : v);
  }
  if (keys.length > 12) out.__moreKeys = keys.length - 12;
  return out;
}

export { REPO_ROOT };
