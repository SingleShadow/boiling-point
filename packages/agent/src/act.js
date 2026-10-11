/**
 * Agent 执行层 —— 把计划里的动作真正做完，带重试与退避。
 * 每个动作都会留痕：做了什么、耗时、结果、失败原因。
 */
import { runDaily } from '../../core/src/pipeline.js';
import { getReport } from '../../core/src/store/db.js';
import { addFinding } from './memory.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 带重试地执行一次每日流水线 */
async function runWithRetry(db, { dateKey, mode, metric, limit, retries = 2, backoffMs = 800 }) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await runDaily({ db, dateKey, limit, metric, mode });
      return {
        ok: true,
        attempts: i + 1,
        report: r.report,
        entries: r.entries,
        source: r.source,
        warnings: r.warnings || [],
        summary: `第 ${i + 1} 次尝试成功：${r.entries.length} 条，数据源 ${r.source}`,
      };
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(backoffMs * (i + 1));
    }
  }
  return { ok: false, attempts: retries + 1, error: lastErr?.message || '未知错误', summary: `${retries + 1} 次尝试均失败：${lastErr?.message}` };
}

/**
 * 执行单个动作
 * @returns {Promise<{ok:boolean, summary:string, error?:string, report?:object, source?:string, warnings?:string[]}>}
 */
export async function executeAction(db, action, ctx = {}) {
  const t0 = Date.now();
  const base = { ...action, ms: 0 };

  try {
    switch (action.type) {
      case 'run_daily':
      case 'backfill_gap': {
        const r = await runWithRetry(db, {
          dateKey: action.dateKey,
          mode: action.mode || ctx.mode || 'auto',
          metric: action.metric || ctx.metric || 'play',
          limit: action.limit || ctx.limit || 10,
          retries: action.retries ?? 2,
          backoffMs: action.backoffMs ?? 800,
        });
        const out = { ...base, ok: r.ok, ms: Date.now() - t0, summary: r.summary, error: r.error, source: r.source, warnings: r.warnings };
        if (r.ok) {
          out.report = r.report;
          out.entries = r.entries;
          if (action.type === 'backfill_gap') out.summary = `补齐 ${action.dateKey}：${r.entries.length} 条`;
        } else {
          addFinding(db, {
            dateKey: action.dateKey,
            category: 'execution',
            severity: 'error',
            title: `${action.dateKey} 抓取失败`,
            detail: r.error || '',
          });
        }
        return out;
      }

      case 'verify': {
        const rep = getReport(db, action.dateKey);
        return {
          ...base,
          ok: Boolean(rep),
          ms: Date.now() - t0,
          report: rep || undefined,
          source: rep?.source,
          summary: rep ? `复检通过：报告存在，样本 ${rep.audienceInsight?.sampleSize || 0} 条` : '复检失败：未找到报告',
        };
      }

      case 'alert': {
        addFinding(db, {
          dateKey: ctx.dateKey,
          category: action.category || 'general',
          severity: action.severity || 'info',
          title: action.title,
          detail: action.detail || '',
        });
        return { ...base, ok: true, ms: Date.now() - t0, summary: `已登记告警：${action.title}` };
      }

      default:
        return { ...base, ok: false, ms: Date.now() - t0, summary: `未知动作类型 ${action.type}`, error: 'unknown-action' };
    }
  } catch (e) {
    return { ...base, ok: false, ms: Date.now() - t0, summary: `执行异常：${e.message}`, error: e.message };
  }
}

/**
 * 顺序执行一整套动作，收集最后一个有效的报告作为本轮产出
 */
export async function executePlan(db, actions = [], ctx = {}) {
  const results = [];
  let report = null;
  let entries = null;
  let source = null;
  let warnings = [];

  for (const a of actions) {
    const r = await executeAction(db, a, ctx);
    results.push(r);
    if (r.report) {
      report = r.report;
      source = r.source || report.source;
      warnings = r.warnings || [];
    }
    if (r.entries) entries = r.entries;
  }

  return { results, report, entries, source, warnings };
}
