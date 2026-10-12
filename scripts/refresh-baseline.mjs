/**
 * 抓取真实 B站全站热门 Top50，重算 tools/title-score/baseline.json 快照。
 * 静态托管下基准是固定文件，用本脚本（或 CI 定时）刷新即可保持「真实数据」口径。
 *
 * 用法：node scripts/refresh-baseline.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { buildBaseline } = await import(pathToFileURL(`${ROOT}packages/core/src/scorer/title.js`).href);

const API = 'https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1';
const res = await fetch(API, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com' } });
const json = await res.json();
const list = (json.data && json.data.list) || [];
if (!list.length) { console.error('B站热门抓取为空，未更新'); process.exit(1); }

const pool = list
  .map((v) => ({
    title: v.title,
    play: v.stat?.view ?? 0,
    author: v.owner?.name ?? '',
    url: v.bvid ? `https://www.bilibili.com/video/${v.bvid}` : '',
  }))
  .filter((x) => x.title);

const baseline = buildBaseline(pool.map((p) => p.title));
const out = {
  generatedAt: new Date().toISOString(),
  source: 'bilibili-popular',
  note: '真实 B站全站热门 Top50 快照，非构造值；静态托管下为固定快照，部署后可定时刷新',
  baseline,
  pool,
};
writeFileSync(`${ROOT}tools/title-score/baseline.json`, JSON.stringify(out, null, 2), 'utf8');
console.log(`baseline.json 已刷新：样本 ${baseline.size} 条，长度区间 ${baseline.length.p25}–${baseline.length.p75} 字`);
