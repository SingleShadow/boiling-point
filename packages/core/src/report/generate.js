/**
 * 每日趋势报告生成
 * 输入：当日已评分的分析结果 + 昨日标签统计（用于环比）
 * 输出：结构化报告 + Markdown
 */
import { getTag } from '../taxonomy/taxonomy.js';
import { shiftDateKey } from '../utils/date.js';

const HOOK_TEMPLATES = {
  hook_question: '「你有没有过____的瞬间？」——前 3 秒直接抛问题，制造好奇缺口',
  hook_conflict: '「我当场就炸了，因为____」——前 3 秒给出对立关系',
  hook_reverse: '「本来以为____，结果____」——前 3 秒埋下反转预期',
  hook_promise: '「三分钟教会你____」——前 3 秒给出明确收益承诺',
  hook_emotion: '「看到最后我破防了」——前 3 秒直接输出情绪',
  hook_scene: '「今天在____遇到一件事」——真实场景带入，降低观看门槛',
};

const TOPIC_ANGLES = {
  topic_drama: ['把冲突压缩到前 3 秒，中段铺垫，结尾留一句台词引爆评论区', '用一个身份错位（上司/前任/室友）制造天然张力'],
  topic_comedy: ['用「共性痛点 + 夸张演绎」，结尾加一个超出预期的反转', '把生活场景极致化，让观众产生「这不就是我」的代入'],
  topic_knowledge: ['结论前置，用数字锚定预期（3 个 / 5 招），再逐个拆解', '把冷知识绑定一个高频生活场景，降低理解成本'],
  topic_food: ['先给成品视觉冲击，再倒推做法，最后给一口真实反馈', '用「低成本 / 零失败」降低行动门槛'],
  topic_travel: ['用「人均 X 元 + N 天」建立可复制预期，路线直接给到手', '把高光画面（日出/夜景）放在前 3 秒'],
  topic_emotion: ['第一人称亲历视角，具体到一个动作、一句话', '结尾留一句可被大量转发的金句'],
  topic_beauty: ['用「前后对比 + 转场」，视觉差越大越容易完播', '把方法拆成可复制的步骤清单'],
  topic_tech: ['参数与结论分离：先给结论，再给数据支撑', '用同价位横评制造决策价值'],
  topic_pet: ['捕捉不可预演的真实反应，保留原声', '用拟人化字幕强化性格设定'],
  topic_parenting: ['用孩子的一句童言或一个动作做钩子', '把育儿痛点转化为共鸣段子'],
  topic_fitness: ['给出可量化的周期承诺（X 天 / X 分钟）', '全程跟练镜头 + 前后对比'],
  topic_career: ['把潜台词翻译成人话，制造「原来如此」的顿悟', '用真实对话场景还原职场瞬间'],
  topic_guofeng: ['用现代场景承载传统元素，制造反差', '强调工艺细节与耗时，建立稀缺感'],
  topic_auto: ['用「劝你别买 / 别加钱」的反向建议建立信任', '实测数据 + 真实用车场景'],
  topic_game: ['高光操作前置，慢动作回放强化爽感', '给出可直接抄的版本答案'],
  topic_rural: ['用时间跨度（第 100 天）建立叙事弧线', '保留环境原声，强化真实质感'],
  topic_shop: ['用「人均 X 元」锚定性价比，画面给足食物质感', '加入排队/老板性格等人格化细节'],
  topic_fashion: ['用身材痛点切入（显高/显瘦），卡点展示多套', '给出可直接照搬的单品清单'],
  topic_other: ['先用强钩子锁定前 3 秒，中段给足信息增量', '结尾补一个明确的互动指令'],
};

/** 生成报告 */
export function generateReport({ dateKey, entries, prevTags = [], hotWords = null } = {}) {
  const prevMap = new Map(prevTags.map((t) => [t.tag_id, t]));

  /* 1. 榜单 */
  const top10 = entries.map((e) => ({
    rank: e.rank,
    id: e.video.id,
    title: e.video.title,
    author: e.video.author?.nickname,
    fans: e.video.author?.fans || 0,
    duration: e.video.duration,
    stats: e.video.stats,
    url: e.video.url,
    music: e.video.music?.title || '',
    challenges: e.video.challenges || [],
    boilingScore: e.boilingScore,
    grade: e.grade,
    headline: e.analysis.headline,
    dimensions: e.analysis.dimensions,
    allTags: e.analysis.allTags,
    summary: e.analysis.summary,
  }));

  /* 2. 分布 */
  const dist = (fn) => {
    const m = new Map();
    for (const e of entries) {
      const k = fn(e);
      const cur = m.get(k) || { name: k, count: 0, totalPlay: 0, scores: [] };
      cur.count += 1;
      cur.totalPlay += e.video.stats.play || 0;
      cur.scores.push(e.boilingScore);
      m.set(k, cur);
    }
    return [...m.values()]
      .map((x) => ({
        name: x.name,
        count: x.count,
        share: Number((x.count / entries.length).toFixed(2)),
        totalPlay: x.totalPlay,
        avgScore: Math.round(x.scores.reduce((a, b) => a + b, 0) / x.scores.length),
      }))
      .sort((a, b) => b.count - a.count || b.totalPlay - a.totalPlay);
  };

  const distribution = {
    topic: dist((e) => e.analysis.dimensions.topic.primary.name),
    duration: dist((e) => e.analysis.dimensions.rhythm.metrics.durationBand),
    emotion: dist((e) => (e.analysis.dimensions.copy.tags.find((t) => t.id.startsWith('emo_')) || { name: '中性陈述' }).name),
    form: dist((e) => e.analysis.dimensions.craft.metrics.form),
    hook: dist((e) => (e.analysis.dimensions.copy.metrics.hook || { name: '场景钩子' }).name),
  };

  /* 3. 标签频次 + 环比 */
  const tagAgg = new Map();
  for (const e of entries) {
    for (const t of e.analysis.allTags) {
      const cur = tagAgg.get(t.id) || { tagId: t.id, name: t.name, dimension: t.dimension, count: 0, totalPlay: 0, scores: [] };
      cur.count += 1;
      cur.totalPlay += e.video.stats.play || 0;
      cur.scores.push(e.boilingScore);
      tagAgg.set(t.id, cur);
    }
  }
  const tagFrequencies = [...tagAgg.values()]
    .map((t) => {
      const prev = prevMap.get(t.tagId);
      return {
        ...t,
        avgScore: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length),
        prevCount: prev ? prev.count : 0,
        delta: prev ? t.count - prev.count : t.count,
        isNew: !prev,
      };
    })
    .sort((a, b) => b.count - a.count || b.totalPlay - a.totalPlay);

  const rising = tagFrequencies.filter((t) => t.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 8);
  const falling = tagFrequencies.filter((t) => t.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

  /* 4. 受众洞察 */
  const totalPlay = entries.reduce((s, e) => s + (e.video.stats.play || 0), 0);
  const topTopics = distribution.topic.slice(0, 3);
  const challengeCount = new Map();
  for (const e of entries) {
    for (const c of e.video.challenges || []) challengeCount.set(c, (challengeCount.get(c) || 0) + 1);
  }
  const hotTopics = [...challengeCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const preferredDuration = distribution.duration[0]?.name || '';
  const preferredHooks = distribution.hook.slice(0, 2).map((h) => h.name);
  const preferredForm = distribution.form[0]?.name || '';
  const emotionBias = distribution.emotion[0]?.name || '中性陈述';
  const avgScore = Math.round(entries.reduce((s, e) => s + e.boilingScore, 0) / (entries.length || 1));

  const audienceInsight = {
    sampleSize: entries.length,
    totalPlay,
    topTopics,
    hotTopics,
    preferredDuration,
    preferredHooks,
    preferredForm,
    emotionBias,
    avgBoilingScore: avgScore,
    /** 抖音真实热搜词（来自官方热搜榜，与视频榜是否真实无关） */
    realHotWords: hotWords ? hotWords.words.slice(0, 10) : [],
    hotWordsSource: hotWords ? hotWords.source : 'none',
    hotWordsFetchedAt: hotWords ? hotWords.fetchedAt : null,
    summaryText:
      `今日 ${entries.length} 条上榜内容中，「${topTopics[0]?.name || '—'}」以 ${topTopics[0]?.count || 0} 条占据主导（占比 ${Math.round((topTopics[0]?.share || 0) * 100)}%）；` +
      `时长偏好集中在 ${preferredDuration}，主流形式为「${preferredForm}」；` +
      `开头偏好 ${preferredHooks.join(' / ')}，整体情绪倾向${emotionBias}；` +
      `平均爆款指数 ${avgScore}。`,
  };

  /* 5. 创作方向 */
  const directions = buildDirections({ topTopics, distribution, tagFrequencies, audienceInsight });

  const report = {
    date: dateKey,
    generatedAt: new Date().toISOString(),
    source: entries[0]?.video?.source || 'unknown',
    top10,
    distribution,
    tagFrequencies,
    rising,
    falling,
    audienceInsight,
    directions,
    hotWords,
  };
  report.markdown = renderMarkdown(report);
  return report;
}

function buildDirections({ topTopics, distribution, tagFrequencies, audienceInsight }) {
  const hookId = (tagFrequencies.find((t) => t.id?.startsWith?.('hook_') || t.tagId?.startsWith('hook_')) || {}).tagId
    || pickHookTagId(audienceInsight.preferredHooks);
  const ctaTag = tagFrequencies.find((t) => t.tagId.startsWith('cta_'));
  const techTags = tagFrequencies.filter((t) => t.tagId.startsWith('tech_')).slice(0, 2);
  const durBand = audienceInsight.preferredDuration;

  return topTopics.slice(0, 3).map((topic, i) => {
    const topicTagId = findTopicTagIdByName(topic.name);
    const angles = TOPIC_ANGLES[topicTagId] || TOPIC_ANGLES.topic_other;
    return {
      no: i + 1,
      title: `${topic.name}｜用「${HOOK_LABEL[hookId] || audienceInsight.preferredHooks[0] || '场景'}」开场`,
      topic: topic.name,
      hookTemplate: HOOK_TEMPLATES[hookId] || HOOK_TEMPLATES.hook_scene,
      angle: angles[i % angles.length],
      durationAdvice: `建议 ${DUR_ADVICE[durBand] || '25–40 秒'}：${durBand} 是当前榜单主流区间，完播压力最小`,
      craftAdvice: `形式走「${audienceInsight.preferredForm}」${techTags.length ? `，叠加 ${techTags.map((t) => t.name).join('、')}` : ''}`,
      ctaAdvice: ctaTag ? `结尾补一个「${ctaTag.name}」的明确指令` : '结尾加一句开放式提问，把讨论引到评论区',
      whyHot: `今日该题材上榜 ${topic.count} 条（占比 ${Math.round((topic.share || 0) * 100)}%），平均爆款指数 ${topic.avgScore}`,
    };
  });
}

const HOOK_LABEL = {
  hook_question: '提问',
  hook_conflict: '冲突',
  hook_reverse: '反转',
  hook_promise: '承诺',
  hook_emotion: '情绪',
  hook_scene: '场景',
};

const DUR_ADVICE = {
  '超短(<15s)': '10–15 秒',
  '短(15-30s)': '18–28 秒',
  '中(30-60s)': '35–50 秒',
  '长(>60s)': '60–90 秒',
};

function pickHookTagId(preferredHooks = []) {
  const map = { '提问钩子': 'hook_question', '冲突钩子': 'hook_conflict', '反转钩子': 'hook_reverse', '承诺钩子': 'hook_promise', '情绪钩子': 'hook_emotion', '场景钩子': 'hook_scene' };
  for (const h of preferredHooks) if (map[h]) return map[h];
  return 'hook_scene';
}

function findTopicTagIdByName(name) {
  for (const [id, t] of TAGS_BY_NAME) if (t.name === name) return id;
  return 'topic_other';
}

import { TOPIC_TAGS } from '../taxonomy/taxonomy.js';
const TAGS_BY_NAME = new Map(TOPIC_TAGS.map((t) => [t.id, t]));

/* ---------------- Markdown ---------------- */

function renderMarkdown(r) {
  const L = [];
  L.push(`# 沸点创意 · 抖音爆款趋势日报（${r.date}）`);
  L.push('');
  L.push(`> 数据源：${r.source === 'simulated' ? '仿真引擎（离线演示）' : '抖音实时热榜'} ｜ 样本 ${r.audienceInsight.sampleSize} 条 ｜ 生成时间 ${new Date(r.generatedAt).toLocaleString('zh-CN')}`);
  L.push('');
  L.push('## 一、今日受众偏爱什么');
  L.push('');
  L.push(r.audienceInsight.summaryText);
  L.push('');
  L.push('| 维度 | 结论 |');
  L.push('| --- | --- |');
  L.push(`| 主导题材 | ${r.audienceInsight.topTopics.map((t) => `${t.name}(${t.count})`).join('、')} |`);
  L.push(`| 热门话题 | ${r.audienceInsight.hotTopics.map((h) => `#${h.name}`).join(' ') || '—'} |`);
  L.push(`| 时长偏好 | ${r.audienceInsight.preferredDuration} |`);
  L.push(`| 主流形式 | ${r.audienceInsight.preferredForm} |`);
  L.push(`| 开头偏好 | ${r.audienceInsight.preferredHooks.join(' / ')} |`);
  L.push(`| 情绪倾向 | ${r.audienceInsight.emotionBias} |`);
  L.push('');
  if (r.audienceInsight.realHotWords?.length) {
    L.push('### 抖音实时热搜榜（官方公开接口 · 真实数据）');
    L.push('');
    L.push(`> 抓取时间 ${new Date(r.audienceInsight.hotWordsFetchedAt).toLocaleString('zh-CN')}　这份数据来自抖音官方热搜榜，与上方视频榜的数据源相互独立`);
    L.push('');
    L.push('| # | 热搜词 | 热度值 | 标记 |');
    L.push('| --- | --- | --- | --- |');
    for (const w of r.audienceInsight.realHotWords) {
      L.push(`| ${w.rank} | ${w.word} | ${w.hotValue.toLocaleString('zh-CN')} | ${w.labelText || '—'} |`);
    }
    L.push('');
  }
  L.push('## 二、今日 TOP10 拆解');
  L.push('');
  L.push('| # | 标题 | 题材 | 形式 | 时长 | 播放 | 爆款指数 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const v of r.top10) {
    L.push(`| ${v.rank} | ${v.title.slice(0, 28)} | ${v.dimensions.topic.primary.name} | ${v.dimensions.craft.metrics.form} | ${v.duration}s | ${fmt(v.stats.play)} | ${v.boilingScore} (${v.grade.level}) |`);
  }
  L.push('');
  L.push('## 三、标签频次 TOP10');
  L.push('');
  L.push('| 标签 | 维度 | 出现 | 环比 | 平均爆款指数 |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const t of r.tagFrequencies.slice(0, 10)) {
    const delta = t.isNew ? '新增' : t.delta > 0 ? `+${t.delta}` : t.delta === 0 ? '持平' : `${t.delta}`;
    L.push(`| ${t.name} | ${DIM_NAME[t.dimension] || t.dimension} | ${t.count} | ${delta} | ${t.avgScore} |`);
  }
  L.push('');
  if (r.rising.length) {
    L.push(`**上升最快**：${r.rising.slice(0, 5).map((t) => `${t.name}(+${t.delta})`).join('、')}`);
    L.push('');
  }
  if (r.falling.length) {
    L.push(`**降温明显**：${r.falling.slice(0, 5).map((t) => `${t.name}(${t.delta})`).join('、')}`);
    L.push('');
  }
  L.push('## 四、今日创作方向建议');
  L.push('');
  for (const d of r.directions) {
    L.push(`### ${d.no}. ${d.title}`);
    L.push('');
    L.push(`- **为什么热**：${d.whyHot}`);
    L.push(`- **开头钩子**：${d.hookTemplate}`);
    L.push(`- **内容切角**：${d.angle}`);
    L.push(`- **时长建议**：${d.durationAdvice}`);
    L.push(`- **表现手法**：${d.craftAdvice}`);
    L.push(`- **结尾引导**：${d.ctaAdvice}`);
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('_由 沸点创意 Boiling Point 自动生成 · 数据口径为当日榜单内相对分位_');
  return L.join('\n');
}

const DIM_NAME = { topic: '题材', copy: '文案', rhythm: '节奏', craft: '表现' };

function fmt(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)} 亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return String(n || 0);
}

export { shiftDateKey };
