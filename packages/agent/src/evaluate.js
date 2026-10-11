/**
 * Agent 质检层 —— 报告出厂前的自检。
 *
 * 一句话原则：没通过质检的报告，不许推给创作者。
 * 每项检查都对应一个真实的失败场景，扣分即可定位问题。
 */

const DIMS = ['topic', 'copy', 'rhythm', 'craft'];

/** 视为真实数据的来源：抖音官方接口 / 用户接入的自定义数据源 */
const LIVE_SOURCES = new Set(['douyin', 'custom']);

export const HEALTH_RULES = [
  { code: 'sample_incomplete', weight: 12, severity: 'error', label: '样本不足' },
  { code: 'dimension_missing', weight: 15, severity: 'error', label: '维度缺失' },
  { code: 'diversity_low', weight: 12, severity: 'warn', label: '题材单一' },
  { code: 'dispersion_low', weight: 10, severity: 'warn', label: '指数无区分度' },
  { code: 'not_live_data', weight: 15, severity: 'warn', label: '非真实数据' },
  { code: 'direction_weak', weight: 10, severity: 'warn', label: '创作建议不完整' },
  { code: 'stale_report', weight: 8, severity: 'info', label: '报告过期' },
  { code: 'no_comparison', weight: 6, severity: 'info', label: '缺少环比基线' },
];

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/**
 * @param {object} args
 * @param {object} args.report 当日报告
 * @param {number} args.expected 期望样本数
 * @param {string} args.source 实际数据源
 * @param {number} [args.maxAgeHours] 报告允许的最大时效（小时）
 */
export function evaluateReport({ report, expected = 10, source, maxAgeHours = 26 } = {}) {
  const issues = [];

  if (!report) {
    return { score: 0, grade: 'D', issues: [{ code: 'no_report', severity: 'critical', label: '无报告', message: '本轮未产出任何报告' }], metrics: {} };
  }

  const top = report.top10 || [];
  const push = (code, message) => {
    const rule = HEALTH_RULES.find((r) => r.code === code);
    issues.push({ code, severity: rule?.severity || 'info', label: rule?.label || code, message });
  };

  /* 1. 样本完整性 */
  if (top.length < expected) push('sample_incomplete', `实际 ${top.length} 条，期望 ${expected} 条`);

  /* 2. 四维覆盖：任何一条视频出现空维度都算问题 */
  const emptyDims = [];
  for (const v of top) {
    for (const d of DIMS) {
      const tags = v?.dimensions?.[d]?.tags || [];
      if (!tags.length) emptyDims.push(`${v.title?.slice(0, 12) || v.id}.${d}`);
    }
  }
  if (emptyDims.length) push('dimension_missing', `${emptyDims.length} 处维度无标签：${emptyDims.slice(0, 3).join('、')}`);

  /* 3. 题材多样性 */
  const topics = new Set(top.map((v) => v?.dimensions?.topic?.primary?.name).filter(Boolean));
  if (top.length && topics.size < 3) push('diversity_low', `榜单仅覆盖 ${topics.size} 个题材，趋势结论代表性不足`);

  /* 4. 爆款指数区分度 */
  const scores = top.map((v) => Number(v.boilingScore) || 0);
  const sd = Number(stdev(scores).toFixed(2));
  if (scores.length > 1 && sd < 5) push('dispersion_low', `爆款指数标准差仅 ${sd}，榜单缺乏区分度`);

  /* 5. 数据真实性（douyin 官方 / 自定义数据源都算真实，simulated 不算） */
  const effSource = source || report.source;
  if (effSource && !LIVE_SOURCES.has(effSource)) push('not_live_data', `数据源为 ${effSource}，非真实榜单`);

  /* 6. 创作建议可执行性 */
  const dirs = report.directions || [];
  const weakDir = dirs.length < 3 || dirs.some((d) => !d.hookTemplate || !d.angle || !d.durationAdvice);
  if (weakDir) push('direction_weak', `创作方向 ${dirs.length} 条，字段完整率不足（需 ≥3 条且含钩子/切角/时长建议）`);

  /* 7. 时效 */
  const gen = report.generatedAt ? new Date(report.generatedAt).getTime() : null;
  const ageHours = gen ? (Date.now() - gen) / 3600000 : null;
  if (ageHours !== null && ageHours > maxAgeHours) push('stale_report', `报告已生成 ${Math.round(ageHours)} 小时，超过 ${maxAgeHours} 小时时效`);

  /* 8. 环比基线 */
  const hasPrev = (report.tagFrequencies || []).some((t) => t.prevCount > 0);
  if (!hasPrev) push('no_comparison', '缺少昨日标签基线，环比结论不可用');

  const penalty = issues.reduce((s, i) => {
    const rule = HEALTH_RULES.find((r) => r.code === i.code);
    return s + (rule?.weight || 5);
  }, 0);
  const score = Math.max(0, 100 - penalty);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

  return {
    score,
    grade,
    issues,
    metrics: {
      sampleSize: top.length,
      expected,
      topicCount: topics.size,
      scoreStdev: sd,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      directionCount: dirs.length,
      source: effSource,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      hasComparison: hasPrev,
    },
  };
}
