#!/usr/bin/env node
/**
 * 数据源自检 —— 一条命令回答三个问题：
 *   1. 现在的数到底是从哪来的（真 / 假）
 *   2. 哪些通道通、哪些不通、为什么不透
 *   3. 想换成真数据，下一步具体做什么
 *
 * 用法：node packages/core/bin/datasource-check.js
 */

import { loadEnv } from '../src/env.js';
import * as douyin from '../src/providers/douyin.js';
import * as custom from '../src/providers/custom.js';
import * as simulated from '../src/providers/simulated.js';
import { toDateKey } from '../src/utils/date.js';

loadEnv();

const TODAY = toDateKey();

const OK = '[ OK ]';
const NO = '[FAIL]';
const SKIP = '[ -- ]';
const WARN = '[WARN]';

function line(ch = '-', n = 66) {
  return ch.repeat(n);
}

function mask(s) {
  if (!s) return '(未配置)';
  if (s.length <= 8) return '****';
  return `${s.slice(0, 6)}****${s.slice(-4)}`;
}

function shorten(u, n = 58) {
  if (!u) return '';
  return u.length > n ? `${u.slice(0, n)}...` : u;
}

async function probe(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { ok: true, ms: Date.now() - t0, data: r };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e.message };
  }
}

async function main() {
  console.log('');
  console.log(line('='));
  console.log('  沸点创意 · 数据源自检');
  console.log(`  时间：${new Date().toLocaleString('zh-CN')}`);
  console.log(line('='));

  /* ---------- 1. 当前配置 ---------- */
  console.log('\n[1] 当前配置');
  console.log(line());
  console.log(`  BOILING_DATA_MODE : ${process.env.BOILING_DATA_MODE || 'auto（默认）'}`);
  console.log(`  DOUYIN_API_BASE   : ${process.env.DOUYIN_API_BASE ? shorten(process.env.DOUYIN_API_BASE) : '(未配置)'}`);
  console.log(`  DOUYIN_API_KEY    : ${mask(process.env.DOUYIN_API_KEY)}`);
  console.log(`  CUSTOM_API_URL    : ${process.env.CUSTOM_API_URL ? shorten(process.env.CUSTOM_API_URL) : '(未配置)'}`);
  console.log(`  CUSTOM_API_KEY    : ${mask(process.env.CUSTOM_API_KEY)}`);
  console.log(`  CUSTOM_API_AUTH   : ${process.env.CUSTOM_API_AUTH || 'bearer（默认）'}`);
  console.log(`  CUSTOM_API_MAP    : ${process.env.CUSTOM_API_MAP ? '已自定义' : '默认（抖音原生结构）'}`);
  console.log(`  CUSTOM_LIST_PATH  : ${process.env.CUSTOM_API_LIST_PATH || 'data.list（默认）'}`);

  /* ---------- 2. 热搜话题（免费真实数据） ---------- */
  console.log('\n[2] 热搜话题通道（免费 · 真实）');
  console.log(line());
  const hw = await probe('hotwords', () => douyin.fetchHotWords({ limit: 5 }));
  if (hw.ok) {
    console.log(`  ${OK} ${hw.data.total} 条真实热搜（${hw.data.channel}，${hw.ms}ms）`);
    for (const w of hw.data.words) {
      console.log(`       #${w.rank} ${w.word}  ${(w.hotValue / 10000).toFixed(0)}万 ${w.labelText}`);
    }
    if (hw.data.warnings?.length) console.log(`  ${WARN} ${hw.data.warnings[0]}`);
  } else {
    console.log(`  ${NO} ${hw.error}`);
  }

  /* ---------- 3. 视频榜（决定健康分的那 15 分） ---------- */
  console.log('\n[3] 视频榜通道（决定报告健康分）');
  console.log(line());

  // 3.1 抖音直连
  const dy = await probe('douyin', () => douyin.fetchTopVideos({ limit: 10, dateKey: TODAY }));
  if (dy.ok) {
    console.log(`  ${OK} 抖音直连：${dy.data.videos.length} 条（${dy.data.channel}，${dy.ms}ms）`);
  } else {
    console.log(`  ${NO} 抖音直连：${dy.error}`);
  }

  // 3.2 自定义源
  if (custom.isConfigured()) {
    const cs = await probe('custom', () => custom.fetchTopVideos({ limit: 10, dateKey: TODAY }));
    if (cs.ok) {
      const v = cs.data.videos;
      console.log(`  ${OK} 自定义源：${v.length} 条（${cs.ms}ms）`);
      console.log(`       样例：${v[0].title.slice(0, 30)} | 播放 ${v[0].stats.play} | 时长 ${v[0].duration}s`);
      if (cs.data.warnings.length) {
        console.log(`  ${WARN} 字段映射疑似有问题（数据能取到，但可能是废数据）：`);
        for (const w of cs.data.warnings) console.log(`       - ${w}`);
      }
    } else {
      console.log(`  ${NO} 自定义源：${cs.error}`);
    }
  } else {
    console.log(`  ${SKIP} 自定义源：未配置 CUSTOM_API_URL`);
  }

  // 3.3 仿真（兜底）
  const sm = await probe('sim', () => simulated.fetchTopVideos({ limit: 10, dateKey: TODAY }));
  console.log(`  ${sm.ok ? OK : NO} 仿真引擎：${sm.ok ? `${sm.data.videos.length} 条（永远可用，兜底）` : sm.error}`);

  /* ---------- 4. 结论 ---------- */
  console.log('\n[4] 结论');
  console.log(line('='));

  const liveVideo = dy.ok || (custom.isConfigured() && (await custom.fetchTopVideos({ limit: 1, dateKey: TODAY }).then(
    () => true, () => false)));

  if (liveVideo) {
    console.log('  视频榜：真实数据  ->  报告健康分可达 100（A 级）');
  } else {
    console.log('  视频榜：仿真数据  ->  报告健康分锁定 85（B 级），扣的 15 分在这里');
  }
  console.log(`  热搜话题：${hw.ok ? '真实数据' : '不可用'}`);
  console.log('');
  console.log('  下一步：');
  if (!liveVideo) {
    console.log('    1. 选一家数据商买视频榜 API（阿里云市场 iCREDIT 约 298 元/5000 次，');
    console.log('       TikHub 按量 $0.001/次且有免费体验额度）');
    console.log('    2. 复制 .env.example 为 .env，填 CUSTOM_API_URL / KEY 与字段映射');
    console.log('    3. 重新跑本命令，看到 [3] 自定义源 OK 且无 WARN 即接通');
    console.log('    4. curl -X POST localhost:8787/api/agent/run  ->  健康分应为 100');
  } else {
    console.log('    已接通。跑一次 `npm run agent:run` 确认健康分到 100。');
  }
  console.log(line('='));
  console.log('');
}

main().catch((e) => {
  console.error('自检脚本异常：', e);
  process.exit(1);
});
