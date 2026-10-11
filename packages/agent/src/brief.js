/**
 * Agent 简报层 —— 把一轮值守压缩成 CEO 三分钟能读完的东西。
 * 只讲三件事：今天干成了没有、出了什么问题、明天要做什么。
 */
import { shiftDateKey } from '../../core/src/utils/date.js';

const STATUS_LABEL = { ok: '正常运行', degraded: '降级运行', failed: '执行失败', running: '进行中' };

export function buildBrief(payload) {
  const { dateKey, observation, plan, actions, qa, report, source, durationMs, repaired } = payload;

  const insight = report?.audienceInsight || {};
  const rising = (report?.tagFrequencies || []).filter((t) => t.delta > 0).slice(0, 5);
  const falling = (report?.tagFrequencies || []).filter((t) => t.delta < 0).slice(0, 3);
  const errors = actions.filter((a) => a.ok === false);
  const status = errors.length ? 'failed' : (qa.issues.some((i) => i.severity === 'warn' || i.severity === 'error') ? 'degraded' : 'ok');

  const headline = status === 'failed'
    ? `今日值守失败：${errors[0]?.error || errors[0]?.summary || '未知原因'}，需人工介入`
    : `${dateKey} 趋势报告已产出（健康分 ${qa.score} / ${qa.grade} 级），主导题材「${insight.topTopics?.[0]?.name || '—'}」`;

  const kpi = {
    healthScore: qa.score,
    grade: qa.grade,
    source: source || report?.source || 'unknown',
    sampleSize: qa.metrics?.sampleSize || 0,
    avgBoilingScore: insight.avgBoilingScore || qa.metrics.avgScore || 0,
    topTopic: insight.topTopics?.[0]?.name || '—',
    preferredDuration: insight.preferredDuration || '—',
    preferredForm: insight.preferredForm || '—',
    durationMs: durationMs || 0,
    repaired: Boolean(repaired),
  };

  const sections = [
    {
      title: '本轮执行',
      items: actions.map((a) => `· ${actionLabel(a.type)}｜${a.summary}${a.ms ? `（${a.ms}ms）` : ''}`),
    },
    {
      title: '质检结果',
      items: qa.issues.length
        ? qa.issues.map((i) => `· [${i.severity}] ${i.label}：${i.message}`)
        : ['· 全部检查项通过'],
    },
    {
      title: '受众偏爱（今日结论）',
      items: [
        `· 主导题材：${insight.topTopics?.map((t) => `${t.name} ${Math.round((t.share || 0) * 100)}%`).join('、') || '—'}`,
        `· 时长偏好：${insight.preferredDuration || '—'}｜主流形式：${insight.preferredForm || '—'}｜情绪倾向：${insight.emotionBias || '—'}`,
        `· 上升标签：${rising.map((t) => `${t.name}(+${t.delta})`).join('、') || '无'}`,
        `· 下降标签：${falling.map((t) => `${t.name}(${t.delta})`).join('、') || '无'}`,
      ],
    },
  ];

  const nextActions = buildNextActions({ observation, qa, report });
  const markdown = renderMarkdown({ dateKey, status, headline, kpi, sections, plan, nextActions });

  return { dateKey, status, statusLabel: STATUS_LABEL[status] || status, headline, kpi, sections, nextActions, markdown, generatedAt: new Date().toISOString() };
}

function buildNextActions({ observation, qa, report }) {
  const out = [];
  if (observation?.gaps?.length) {
    out.push(`补齐剩余 ${observation.gaps.length} 天历史数据（${observation.gaps[0]} 起）`);
  }
  if (qa.issues.some((i) => i.code === 'not_live_data')) {
    out.push('接入真实抖音数据源凭据（DOUYIN_API_KEY / DOUYIN_API_BASE），结束演示数据状态');
  }
  if (qa.issues.some((i) => i.code === 'diversity_low' || i.code === 'dispersion_low')) {
    out.push(`扩大候选池重取榜单（当前 TOP${report?.top10?.length || 10}）`);
  }
  if (qa.issues.some((i) => i.code === 'no_comparison')) {
    out.push(`生成 ${shiftDateKey(observation?.dateKey || '', -1)} 基线数据以恢复环比`);
  }
  if (!out.length) out.push('保持每日 09:00 自动值守，持续积累标签趋势');
  return out;
}

function actionLabel(type) {
  return {
    run_daily: '执行抓取',
    backfill_gap: '补齐历史',
    verify: '复检',
    alert: '登记告警',
  }[type] || type;
}

function renderMarkdown({ dateKey, status, headline, kpi, sections, plan, nextActions }) {
  const L = [];
  L.push(`# 沸点创意 · Agent 值守简报（${dateKey}）`);
  L.push('');
  L.push(`**状态**：${STATUS_LABEL[status] || status}　**健康分**：${kpi.healthScore}（${kpi.grade} 级）　**数据源**：${kpi.source}`);
  L.push('');
  L.push(`> ${headline}`);
  L.push('');
  L.push('## 关键指标');
  L.push('');
  L.push('| 指标 | 值 |');
  L.push('| --- | --- |');
  L.push(`| 样本数 | ${kpi.sampleSize} |`);
  L.push(`| 平均爆款指数 | ${kpi.avgBoilingScore} |`);
  L.push(`| 主导题材 | ${kpi.topTopic} |`);
  L.push(`| 时长偏好 | ${kpi.preferredDuration} |`);
  L.push(`| 主流形式 | ${kpi.preferredForm} |`);
  L.push(`| 本轮耗时 | ${(kpi.durationMs / 1000).toFixed(1)}s${kpi.repaired ? '（含修复跑）' : ''} |`);
  L.push('');
  L.push('## 决策依据');
  L.push('');
  for (const r of plan?.rationale || []) L.push(`- ${r}`);
  L.push('');
  for (const s of sections) {
    L.push(`## ${s.title}`);
    L.push('');
    for (const i of s.items) L.push(i.startsWith('·') ? `- ${i.slice(1).trim()}` : i);
    L.push('');
  }
  L.push('## 下一步');
  L.push('');
  nextActions.forEach((a, i) => L.push(`${i + 1}. ${a}`));
  L.push('');
  return L.join('\n');
}
