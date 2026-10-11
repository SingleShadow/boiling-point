/**
 * 每日流水线：抓取 -> 分析 -> 评分 -> 出报 -> 落库
 */
import * as composite from './providers/composite.js';
import { analyzeBatch } from './analyzers/index.js';
import { generateReport } from './report/generate.js';
import { getDayTags, saveDailyVideos, saveReport, saveTagDaily, startRun, finishRun } from './store/db.js';
import { shiftDateKey, toDateKey } from './utils/date.js';

export async function runDaily(opts = {}) {
  const db = opts.db;
  if (!db) throw new Error('runDaily 需要传入 db 实例');
  const dateKey = opts.dateKey || toDateKey();
  const limit = opts.limit || 10;
  const metric = opts.metric || 'play';

  const runId = startRun(db, { dateKey, source: 'pending', metric });
  let warnings = [];
  try {
    const fetched = await composite.fetchTopVideos({ dateKey, limit, metric, mode: opts.mode });
    warnings = fetched.warnings || [];
    const entries = analyzeBatch(fetched.videos);

    const prevTags = opts.prevTags || getDayTags(db, shiftDateKey(dateKey, -1)) || [];
    const report = generateReport({ dateKey, entries, prevTags, hotWords: fetched.hotWords || null });
    report.warnings = warnings;

    saveDailyVideos(db, dateKey, entries);
    saveTagDaily(db, dateKey, report.tagFrequencies);
    saveReport(db, report);
    finishRun(db, runId, { videoCount: entries.length, status: 'ok', message: warnings.join('; ') });

    return { dateKey, report, entries, source: fetched.source, warnings, runId };
  } catch (e) {
    finishRun(db, runId, { videoCount: 0, status: 'error', message: e.message });
    throw e;
  }
}

export { composite };
