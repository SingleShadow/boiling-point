#!/usr/bin/env node
/**
 * 沸点内核 CLI
 *   node bin/boiling.js fetch  [--limit 10] [--metric play|engage] [--mode auto|live|simulated]
 *   node bin/boiling.js run    [--limit 10] [--date YYYY-MM-DD] [--metric play]
 *   node bin/boiling.js report [--date YYYY-MM-DD]
 *   node bin/boiling.js tags
 */
import { analyzeBatch, exportTaxonomy, runDaily } from '../src/index.js';
import * as composite from '../src/providers/composite.js';
import { getDb, getReport, getLatestDateKey, getStats, closeDb } from '../src/store/db.js';
import { toDateKey } from '../src/utils/date.js';
import { loadEnv } from '../src/env.js';

loadEnv();

const args = process.argv.slice(2);
const cmd = args[0] || 'fetch';
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

function fmt(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n || 0);
}

async function main() {
  if (cmd === 'tags') {
    const t = exportTaxonomy();
    console.log(`标签体系：${t.total} 个标签，${t.dimensions.length} 个维度`);
    for (const g of t.groups) console.log(`  - ${g.name}(${g.id}): ${g.tags.length} 个`);
    return;
  }

  if (cmd === 'fetch') {
    const res = await composite.fetchTopVideos({
      limit: Number(flag('limit', 10)),
      metric: flag('metric', 'play'),
      mode: flag('mode', process.env.BOILING_DATA_MODE || 'auto'),
      dateKey: flag('date', toDateKey()),
    });
    const entries = analyzeBatch(res.videos);
    console.log(`数据源: ${res.source}  日期: ${res.dateKey}  指标: ${res.metric}`);
    if (res.warnings?.length) console.log(`提示: ${res.warnings.join(' | ')}`);
    console.log('');
    console.log('排名  爆款指数  标题                                          题材        形式        时长   播放');
    for (const e of entries) {
      console.log(
        String(e.rank).padEnd(5),
        `${e.boilingScore}(${e.grade.level})`.padEnd(10),
        e.video.title.slice(0, 26).padEnd(34),
        e.analysis.dimensions.topic.primary.name.padEnd(8),
        e.analysis.dimensions.craft.metrics.form.padEnd(8),
        `${e.video.duration}s`.padEnd(6),
        fmt(e.video.stats.play)
      );
    }
    return;
  }

  if (cmd === 'run') {
    const db = getDb(flag('db', process.env.BOILING_DB));
    const r = await runDaily({
      db,
      limit: Number(flag('limit', 10)),
      metric: flag('metric', 'play'),
      mode: flag('mode', process.env.BOILING_DATA_MODE || 'auto'),
      dateKey: flag('date', toDateKey()),
    });
    console.log(`✅ ${r.dateKey} 流水线完成：${r.entries.length} 条，数据源 ${r.source}`);
    if (r.warnings?.length) console.log(`⚠️  ${r.warnings.join(' | ')}`);
    console.log('');
    console.log(r.report.markdown);
    closeDb();
    return;
  }

  if (cmd === 'report') {
    const db = getDb(flag('db', process.env.BOILING_DB));
    const dateKey = flag('date', getLatestDateKey(db) || toDateKey());
    const rep = getReport(db, dateKey);
    if (!rep) {
      console.log(`❌ 没有 ${dateKey} 的报告，先运行: node bin/boiling.js run`);
    } else {
      console.log(rep.markdown);
    }
    closeDb();
    return;
  }

  if (cmd === 'stats') {
    const db = getDb(flag('db', process.env.BOILING_DB));
    console.log(getStats(db));
    closeDb();
    return;
  }

  console.log('未知命令。可用: fetch | run | report | tags | stats');
}

main().catch((e) => {
  console.error('❌', e.message);
  closeDb();
  process.exit(1);
});
