/**
 * 标题打分器
 *
 * 设计原则：**不拍脑袋定规则**。基准来自「当下真实的热门标题」——
 * 哪些写法在爆款里常见、常见到什么比例，全部从真实样本统计出来。
 * 因此每一条建议都能带上数据支撑：「热门中 62% 的标题含具体数字，你的没有」。
 *
 * 这也是本工具能获客的原因：它给的不是主观点评，是一句可复核的事实。
 *
 * 纯函数，无网络、无数据库依赖，便于测试与复用。
 */

import { cnLength, detectEmotion, detectSentencePatterns } from '../utils/text.js';

/** 特征定义：id / 名称 / 为什么有效 / 命中后给用户的可执行建议 */
const FEATURES = [
  {
    id: 'number',
    name: '具体数字',
    why: '数字把模糊预期变成可衡量的预期',
    tip: '加一个具体数字（「3 个方法」「10 分钟」「花了 2000 块」），观众才知道要付出什么、得到什么',
  },
  {
    id: 'suspense',
    name: '悬念或反转',
    why: '制造未完成感，逼人点开验证猜测',
    tip: '把结果藏起来（「看到最后我愣住了」「结局谁也没想到」），但内容必须真的兑现',
  },
  {
    id: 'question',
    name: '疑问钩子',
    why: '提问会自动在读者脑中启动回答机制',
    tip: '把陈述改成提问（「为什么 XX 没人做？」），或用「是不是/凭什么」开头',
  },
  {
    id: 'contrast',
    name: '对比反差',
    why: '反差是信息，信息才是点击的理由',
    tip: '给出两极（「以前 vs 现在」「别人 3 小时，我 10 分钟」），差距越大越想点',
  },
  {
    id: 'emotion',
    name: '情绪词',
    why: '情绪决定转发意愿，转发带来二次分发',
    tip: '点明一种具体情绪（「破防」「治愈」「离谱」），避免空泛的形容词',
  },
  {
    id: 'bracket',
    name: '包裹标记【】()',
    why: '把系列名、规格、来源外挂，主标题保持干净',
    tip: '用【】挂系列名或规格（【4K 修复】【全程干货】），主标题只留最抓人的那一句',
  },
  {
    id: 'list',
    name: '清单或盘点',
    why: '清单承诺信息密度，降低"点开会不会亏"的顾虑',
    tip: '明确给出条目数（「5 个」「10 个」）或结构（第一/第二/第三）',
  },
  {
    id: 'firstperson',
    name: '第一人称',
    why: '亲身视角建立可信度，是经验类内容的刚需',
    tip: '用「我/我们/本人」开头，把观点变成经历（「我试了 30 天」）',
  },
  {
    id: 'command',
    name: '行动指令',
    why: '指令直接触发行为，但用多了会廉价',
    tip: '结尾给一个明确动作（「别再 XX 了」「赶紧码住」），别堆砌「点赞关注」',
  },
];

const BRACKET_RE = /[【】\[\]()（）]/;
const TOPIC_TAG_RE = /#[^#\s]{2,}/;
const HOT_RATE_FLOOR = 0.15; // 「热门常见写法」的绝对下限

/**
 * 判定哪些写法算「热门常见」——**用相对阈值，不用固定值**。
 * 实测发现真实热门标题的写法非常分散（最常见的一种也就 17% 左右），
 * 若死守 20% 会出现「没有任何热门写法」→ 分数永远卡在长度分的荒谬结果。
 * 因此：取 ≥ max(15%, 最高占比的一半)；极端情况下退化为占比最高的 3 种。
 */
function pickHotFeatures(rate) {
  const max = Math.max(...FEATURES.map((f) => rate[f.id] || 0), 0);
  const threshold = Math.max(HOT_RATE_FLOOR, max * 0.5);
  const hot = FEATURES.filter((f) => (rate[f.id] || 0) >= threshold);
  if (hot.length) return hot;
  return FEATURES
    .slice()
    .sort((a, b) => (rate[b.id] || 0) - (rate[a.id] || 0))
    .filter((f) => (rate[f.id] || 0) > 0)
    .slice(0, 3);
}

/**
 * 抽取单条标题的特征。
 * @returns {{length:number, hits:Set<string>, hasTopicTag:boolean}}
 */
export function extractFeatures(text = '') {
  const t = String(text || '');
  const patterns = detectSentencePatterns(t);
  const emo = detectEmotion(t);
  const hits = new Set();

  if (patterns.includes('number')) hits.add('number');
  if (patterns.includes('suspense')) hits.add('suspense');
  if (patterns.includes('question')) hits.add('question');
  if (patterns.includes('contrast')) hits.add('contrast');
  if (patterns.includes('firstperson')) hits.add('firstperson');
  if (patterns.includes('command')) hits.add('command');
  if (patterns.includes('list')) hits.add('list');
  if (emo.polarity !== 'neutral' || emo.intensifiers.length) hits.add('emotion');
  if (BRACKET_RE.test(t)) hits.add('bracket');
  // text.js 的第一人称表为「抖音文案」刻意收窄（单独的「我」区分度不足），
  // 但标题场景里「我花了/我试了/我做了」是强信号，这里按标题场景放宽。
  if (/^我|我[花试做去买拍学拿找逛吃看了]/.test(t)) hits.add('firstperson');

  return {
    length: cnLength(t),
    hits,
    hasTopicTag: TOPIC_TAG_RE.test(t),
  };
}

/** 分位数（线性插值） */
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * 用真实热门标题构建基准。
 * @param {string[]} titles 真实热门标题（越多越好，建议 ≥30）
 */
export function buildBaseline(titles = []) {
  const list = (titles || []).map((t) => String(t || '').trim()).filter(Boolean);
  const size = list.length;
  const lengths = [];
  const counts = {};
  for (const id of FEATURES.map((f) => f.id)) counts[id] = 0;

  for (const t of list) {
    const f = extractFeatures(t);
    lengths.push(f.length);
    for (const id of f.hits) counts[id] = (counts[id] || 0) + 1;
  }
  lengths.sort((a, b) => a - b);

  const rate = {};
  for (const id of Object.keys(counts)) rate[id] = size ? counts[id] / size : 0;

  return {
    size,
    rate,
    length: {
      min: lengths[0] ?? 0,
      max: lengths[lengths.length - 1] ?? 0,
      p25: Math.round(quantile(lengths, 0.25)),
      p50: Math.round(quantile(lengths, 0.5)),
      p75: Math.round(quantile(lengths, 0.75)),
    },
  };
}

function gradeOf(score) {
  if (score >= 78) return 'A';
  if (score >= 62) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

/**
 * 给一个标题打分。
 * @param {string} title
 * @param {object} baseline buildBaseline 的产物
 */
export function scoreTitle(title, baseline) {
  const text = String(title || '').trim();
  const bl = baseline || { size: 0, rate: {}, length: { p25: 0, p50: 0, p75: 0 } };

  if (!text) {
    return {
      score: 0,
      grade: 'D',
      verdict: '还没有输入标题',
      length: { value: 0, ideal: [bl.length.p25, bl.length.p75], verdict: 'empty' },
      features: [],
      suggestions: ['先写一个标题，再看它跟今日热门差在哪'],
      baseline: { size: bl.size },
    };
  }
  if (bl.size < 10) {
    return {
      score: 0,
      grade: '—',
      verdict: '基准样本不足（需 ≥10 条热门标题），无法给出可信评分',
      length: { value: cnLength(text), ideal: [bl.length.p25, bl.length.p75], verdict: 'unknown' },
      features: [],
      suggestions: ['基准库还在积累中，请稍后再试'],
      baseline: { size: bl.size },
    };
  }

  const f = extractFeatures(text);
  const { p25, p75 } = bl.length;

  /* --- 长度分（20）--- */
  let lengthVerdict = 'ok';
  let lengthScore = 20;
  if (f.length < p25) {
    const d = p25 - f.length;
    lengthScore = Math.max(0, 20 - d * 1.5);
    lengthVerdict = 'short';
  } else if (f.length > p75) {
    const d = f.length - p75;
    lengthScore = Math.max(0, 20 - d * 1.5);
    lengthVerdict = 'long';
  }

  /* --- 特征分（80）---
   * 用「覆盖率」而非累加权重：命中的热门写法占比之和 ÷ 热门写法占比之和。
   * 这样全命中即满分，不会出现「怎么写都拿不到 A」的失真曲线。
   */
  const hot = pickHotFeatures(bl.rate);
  const hotIds = new Set(hot.map((ft) => ft.id));
  const totalWeight = hot.reduce((s, ft) => s + (bl.rate[ft.id] || 0), 0);
  const features = [];
  let hitWeight = 0;

  for (const ft of FEATURES) {
    const rate = bl.rate[ft.id] || 0;
    const hit = f.hits.has(ft.id);
    const isHot = hotIds.has(ft.id);
    if (isHot) {
      if (hit) hitWeight += rate;
      features.push({
        id: ft.id,
        name: ft.name,
        hit,
        rate: Number(rate.toFixed(2)),
        hot: true,
        why: ft.why,
        tip: hit ? null : ft.tip,
      });
    } else if (hit) {
      // 命中冷门写法：不加分，但提示这可能是差异化
      features.push({
        id: ft.id,
        name: ft.name,
        hit: true,
        rate: Number(rate.toFixed(2)),
        hot: false,
        why: ft.why,
        tip: `热门里只有 ${Math.round(rate * 100)}% 这么写——可能是你的差异化，也可能是无效尝试`,
      });
    }
  }

  // 话题标签单独提示（不参与打分，各平台规则差异大）
  if (f.hasTopicTag) {
    features.push({
      id: 'topicTag',
      name: '话题标签 #',
      hit: true,
      rate: null,
      hot: false,
      why: '带话题可进入话题页分发',
      tip: '话题标签要选有人逛的大词，自造小词没有分发价值',
    });
  }

  // 极端情况：这批热门标题没有任何稳定写法（选题驱动而非技巧驱动）——
  // 此时不给 0 分（那是冤枉用户），给中间值 40，并在建议里如实说明。
  const dispersed = totalWeight === 0;
  const coverage = totalWeight > 0 ? hitWeight / totalWeight : 0;
  const featureScore = dispersed ? 40 : 80 * coverage;
  const score = Math.max(0, Math.min(100, Math.round(lengthScore + featureScore)));

  /* --- 建议：按「热门里有多常见」排序，只给最值得改的 3 条 --- */
  const suggestions = features
    .filter((x) => x.hot && !x.hit)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map((x) => `热门中 ${Math.round(x.rate * 100)}% 的标题用了「${x.name}」，你的没有 —— ${x.tip}`);

  if (lengthVerdict === 'short') {
    suggestions.unshift(`你的标题 ${f.length} 字，比热门主流区间（${p25}–${p75} 字）偏短，信息量可能撑不起点击`);
  } else if (lengthVerdict === 'long') {
    suggestions.unshift(`你的标题 ${f.length} 字，比热门主流区间（${p25}–${p75} 字）偏长，手机上会被截断`);
  }
  if (dispersed) {
    suggestions.unshift('这批热门标题没有共同的写法套路（最常见的一种也不足 15%）——说明这个榜靠选题和封面驱动，标题技巧的边际收益有限');
  }
  if (!suggestions.length) {
    suggestions.push('热门写法基本都命中了——剩下的差距在封面和内容本身，标题已不是瓶颈');
  }

  const verdictMap = {
    A: '标题写法已经很接近爆款',
    B: '骨架对了，补一两个钩子就能上一个台阶',
    C: '能用，但缺少让人非点不可的理由',
    D: '和今日热门的写法差距较大',
  };

  return {
    score,
    grade: gradeOf(score),
    verdict: verdictMap[gradeOf(score)],
    coverage: Number(coverage.toFixed(2)),
    length: {
      value: f.length,
      ideal: [p25, p75],
      verdict: lengthVerdict,
    },
    features: features.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)),
    suggestions,
    baseline: { size: bl.size, length: bl.length },
  };
}

/** 中文字符二元组（用于相似度，避免引入分词依赖） */
function bigrams(text = '') {
  const t = String(text || '').replace(/[\s\p{P}\p{S}]/gu, '');
  const out = new Set();
  for (let i = 0; i < t.length - 1; i += 1) out.add(t.slice(i, i + 2));
  if (!out.size && t.length) out.add(t);
  return out;
}

/**
 * 从真实标题池里找最相似的几条，作为参照。
 * @param {string} title
 * @param {{title:string, play?:number, author?:string}[]} pool
 */
export function similarTitles(title, pool = [], n = 3) {
  const target = bigrams(title);
  if (!target.size) return [];
  const scored = [];
  for (const item of pool) {
    const b = bigrams(item.title);
    if (!b.size) continue;
    let inter = 0;
    for (const g of target) if (b.has(g)) inter += 1;
    const union = new Set([...target, ...b]).size;
    scored.push({ ...item, similarity: Number((inter / union).toFixed(3)) });
  }
  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, n);
}
