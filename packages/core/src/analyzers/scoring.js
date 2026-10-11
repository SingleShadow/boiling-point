/**
 * 爆款指数 Boiling Score
 * 采用「当日榜单内分位」而非绝对值，使分数跨天可比。
 *   30% 播放量分位 + 25% 互动率分位 + 20% 完播代理分位 + 15% 涨粉效率分位 + 10% 传播系数分位
 */

const WEIGHTS = { play: 30, engagement: 25, completion: 20, fanEfficiency: 15, spread: 10 };

/** 榜单内分位：最小值 -> 0，最大值 -> 1（min-max 归一，保证分数落在 0~100） */
function percentileRank(values, v) {
  if (values.length <= 1) return 1;
  const sorted = values.slice().sort((a, b) => a - b);
  const below = sorted.filter((x) => x < v).length;
  return below / (sorted.length - 1);
}

export function rawMetrics(video) {
  const s = video.stats || {};
  const play = Math.max(1, s.play || 0);
  const engagementRate = (s.digg + s.comment + s.share + s.collect) / play;
  const completionProxy = 1 / (1 + (video.duration || 15) / 45);
  const fanEfficiency = (s.digg + (s.collect || 0) * 2) / Math.max(1, video.author?.fans || 1);
  const spread = ((s.share || 0) * 2 + (s.comment || 0)) / play;
  return { play, engagementRate, completionProxy, fanEfficiency, spread };
}

export function grade(score) {
  if (score >= 80) return { level: 'S', label: '现象级爆款' };
  if (score >= 65) return { level: 'A', label: '优质爆款' };
  if (score >= 50) return { level: 'B', label: '稳健热门' };
  return { level: 'C', label: '常规上榜' };
}

/**
 * @param {Array<{video:object, analysis:object}>} entries
 * @returns 原地补充 boilingScore / scoreBreakdown / grade
 */
export function scoreBatch(entries) {
  if (!entries.length) return entries;
  const metas = entries.map((e) => rawMetrics(e.video));
  const cols = {
    play: metas.map((m) => m.play),
    engagementRate: metas.map((m) => m.engagementRate),
    completionProxy: metas.map((m) => m.completionProxy),
    fanEfficiency: metas.map((m) => m.fanEfficiency),
    spread: metas.map((m) => m.spread),
  };

  return entries.map((entry, i) => {
    const m = metas[i];
    const p = {
      play: percentileRank(cols.play, m.play),
      engagement: percentileRank(cols.engagementRate, m.engagementRate),
      completion: percentileRank(cols.completionProxy, m.completionProxy),
      fanEfficiency: percentileRank(cols.fanEfficiency, m.fanEfficiency),
      spread: percentileRank(cols.spread, m.spread),
    };
    const score = Math.round(
      p.play * WEIGHTS.play +
      p.engagement * WEIGHTS.engagement +
      p.completion * WEIGHTS.completion +
      p.fanEfficiency * WEIGHTS.fanEfficiency +
      p.spread * WEIGHTS.spread
    );
    return {
      ...entry,
      metrics: m,
      percentiles: p,
      boilingScore: score,
      grade: grade(score),
    };
  });
}

export { WEIGHTS, percentileRank };
