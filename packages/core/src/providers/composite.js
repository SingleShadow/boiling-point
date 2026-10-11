/**
 * 多通道适配器：自定义数据源 → 抖音真实接口 → 仿真引擎
 *
 * 无论走哪条通道，都会顺带抓取「抖音真实热搜词榜」（免 Key、稳定可用），
 * 即使视频榜降级为仿真，报告里的「今日热门话题」依然是真实数据。
 */
import * as douyin from './douyin.js';
import * as simulated from './simulated.js';
import * as custom from './custom.js';

/** 热搜词是加分项，失败只记 warning，不影响主流程 */
async function safeHotWords({ limit = 20, timeout = 6000 } = {}) {
  try {
    const words = await douyin.fetchHotWords({ limit, timeout });
    return { words, warning: null };
  } catch (e) {
    return { words: null, warning: `抖音热搜词抓取失败：${e.message}` };
  }
}

export async function fetchTopVideos(opts = {}) {
  const mode = opts.mode || process.env.BOILING_DATA_MODE || 'auto';
  const hot = opts.hotWords === false ? { words: null, warning: null } : await safeHotWords({ limit: opts.hotWordsLimit || 20 });

  const attach = (res, extraWarnings = []) => ({
    ...res,
    hotWords: hot.words,
    warnings: [...(hot.warning ? [hot.warning] : []), ...extraWarnings, ...(res.warnings || [])],
  });

  if (mode === 'custom') return attach(await custom.fetchTopVideos(opts));
  if (mode === 'simulated') return attach(await simulated.fetchTopVideos(opts));

  /* auto | live：按 custom → douyin 顺序尝试真实源 */
  const chain = [];
  if (custom.isConfigured()) chain.push(['custom', custom]);
  chain.push(['douyin', douyin]);

  let lastError = new Error('无可用真实数据源');
  for (const [name, provider] of chain) {
    try {
      const res = await provider.fetchTopVideos(opts);
      if (res.videos && res.videos.length) return attach(res);
      lastError = new Error(`${name} 返回空榜单`);
    } catch (e) {
      lastError = e;
    }
  }

  if (mode === 'live') throw lastError;

  const fallback = await simulated.fetchTopVideos(opts);
  return {
    ...attach(fallback, [`真实抓取失败（${lastError.message}），已降级为仿真数据`]),
    degradedFrom: chain.map(([n]) => n).join('/'),
  };
}

export const name = 'composite';
export { douyin, simulated, custom };
