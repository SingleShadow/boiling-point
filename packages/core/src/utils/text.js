/**
 * 轻量中文文本工具：零依赖，够用即可。
 * 不追求分词精度，追求「可解释 + 可回归」。
 */

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '就', '不', '也', '要', '会', '着', '有', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '这个', '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '然后',
  '可以', '还是', '这样', '那样', '一个', '一下', '一直', '已经', '现在', '时候', '自己', '大家',
  '视频', '抖音', '分享', '点赞', '关注', '评论', '收藏', '家人们', '兄弟们', '姐妹们', '宝宝',
  '今天', '今天给', '真的', '非常', '特别', '一定', '可能', '应该', '就是', '还是', '而且', '如果',
  '第一', '第二', '第三', '这些', '那些', '怎么', '多少', '这里', '那里', '没有', '不要', '不能',
]);

const PUNCT = /[\s，。！？、；：""''《》（）()【】\[\]~～!?.,;:|/\\-—_+*#$%^&@=<>]+/g;

/** 正向 / 负向情绪词典（够覆盖短视频语境） */
const POSITIVE = ['治愈', '温暖', '感动', '幸福', '开心', '快乐', '惊喜', '成功', '逆袭', '高光',
  '爱', '喜欢', '绝了', '牛', '厉害', '稳', '香', '绝美', '炸裂', '封神', '破防', '上头', '心动',
  '高级', '精致', '舒服', '解压', '松弛', '氛围感', '靠谱', '值得', '推荐', '宝藏', '神仙',
  '笑', '可爱', '萌', '甜', '暖', '爽', '绝', '赞', '泪目', '圆梦', '团圆', '现实',
  '好哭', '安心', '踏实', '幸运', '福气', '有意思', '真香'];

const NEGATIVE = ['崩溃', '离谱', '愤怒', '生气', '难过', '委屈', '焦虑', '后悔', '翻车',
  '坑', '踩坑', '失败', '痛苦', '讨厌', '无语', '可怕', '危险', '警告',
  '千万别', '别再', '不要', '警惕', '曝光', '翻脸', '分手', '失业', '裁员', '熬夜', '生病',
  '社死', '懵', '苦', '亏', '假', '贵', '难吃', '踩雷', '心酸', '遗憾', '孤独', '压力',
  '受不了', '太难了', '心疼', '累'];

const INTENSIFIERS = ['太', '超', '巨', '爆', '极', '无敌', '真的', '特别', '非常', '绝对', '狠狠',
  '直接', '一口气', '竟然', '居然', '居然', '万万没想到', '彻底', '疯狂'];

const QUESTION_MARKS = ['吗', '呢', '？', '?', '为什么', '凭什么', '是不是', '有没有', '会不会', '怎么'];
const NUM_PATTERNS = [/\d+\s*(个|种|招|招式|条|步|方法|技巧|秘|诀|大|款|岁|年|天|块|元|万|亿)/, /[一二三四五六七八九十百千万]+\s*(个|种|招|条|步|大|款)/];
const COMMAND_WORDS = ['快去', '赶紧', '记得', '一定要', '必须', '别再', '千万不要', '马上', '立刻', '收藏起来', '码住', '收藏', '点赞', '关注我'];
const CONTRAST_WORDS = ['以前', '现在', '之前', '后来', '本来', '结果', '没想到', '反而', '却', '但是', '对比', 'vs', 'VS', '别人', '而我', '同样', '差别'];
// 只保留强第一人称信号：单独的「我」在短视频文案里过于普遍，区分度不足
const FIRST_PERSON = ['我们', '我家', '我的', '本人', '亲身', '我自己', '我第一次', '我终于', '我偷偷', '我当场', '我直接'];
const SUSPENSE_WORDS = ['最后', '结局', '万万没想到', '竟然', '居然', '原来', '真相', '秘密', '揭秘', '隐藏', '看到最后', '结尾', '反转', '……', '…', '没想到'];

/** 去标点、归一 */
export function normalize(text = '') {
  return String(text).replace(PUNCT, ' ').trim();
}

/** 中文字符数（正文长度） */
export function cnLength(text = '') {
  const m = String(text).match(/[\u4e00-\u9fa5]/g);
  return m ? m.length : 0;
}

/** 生成 n-gram 候选词 */
function ngrams(chars, n) {
  const out = [];
  for (let i = 0; i + n <= chars.length; i++) {
    out.push(chars.slice(i, i + n).join(''));
  }
  return out;
}

/**
 * 关键词提取：2–4gram 词频 + 停用词过滤 + 长词优先合并
 * @returns {Array<{word:string,count:number}>}
 */
export function extractKeywords(text = '', topN = 8) {
  const clean = normalize(text);
  const chars = clean.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
  const freq = new Map();
  for (const n of [2, 3, 4]) {
    for (const g of ngrams(chars, n)) {
      if (STOPWORDS.has(g)) continue;
      freq.set(g, (freq.get(g) || 0) + 1);
    }
  }
  // 长词优先：若 4gram 出现，则其 2/3gram 子词降权
  const scored = [...freq.entries()].map(([word, count]) => {
    let score = count * word.length;
    if (STOPWORDS.has(word)) score = 0;
    return { word, count, score };
  });
  const kept = [];
  const sorted = scored.sort((a, b) => b.score - a.score);
  for (const item of sorted) {
    const covered = kept.some((k) => k.word.includes(item.word) && k.count >= item.count);
    if (!covered && item.score > 0) kept.push(item);
    if (kept.length >= topN * 3) break;
  }
  return kept.slice(0, topN).map(({ word, count }) => ({ word, count }));
}

/** 关键词命中（返回命中列表） */
export function matchKeywords(text = '', keywords = []) {
  const t = String(text);
  return keywords.filter((k) => t.includes(k));
}

export function countKeywordHits(text = '', keywords = []) {
  return matchKeywords(text, keywords).length;
}

/** 情绪分析 */
export function detectEmotion(text = '') {
  const t = String(text);
  const pos = matchKeywords(t, POSITIVE);
  const neg = matchKeywords(t, NEGATIVE);
  const inten = matchKeywords(t, INTENSIFIERS);
  const score = pos.length - neg.length;
  let polarity = 'neutral';
  if (score > 0) polarity = 'positive';
  else if (score < 0) polarity = 'negative';
  const intensity = Math.min(1, (pos.length + neg.length + inten.length * 0.8) / 5);
  return {
    polarity,
    intensity: Number(intensity.toFixed(2)),
    positive: pos,
    negative: neg,
    intensifiers: inten,
    score,
  };
}

/** 句式识别 */
export function detectSentencePatterns(text = '') {
  const t = String(text);
  const patterns = [];
  if (QUESTION_MARKS.some((k) => t.includes(k))) patterns.push('question');
  if (NUM_PATTERNS.some((r) => r.test(t))) patterns.push('number');
  if (SUSPENSE_WORDS.some((k) => t.includes(k))) patterns.push('suspense');
  if (COMMAND_WORDS.some((k) => t.includes(k))) patterns.push('command');
  if (CONTRAST_WORDS.some((k) => t.includes(k))) patterns.push('contrast');
  if (FIRST_PERSON.some((k) => t.includes(k))) patterns.push('firstperson');
  if (/[：:]/.test(String(text)) || /(第一|第二|第三|\d[\.、])/.test(t)) patterns.push('list');
  if (cnLength(t) > 40) patterns.push('story');
  if (!patterns.length) patterns.push('plain');
  return patterns;
}

/** CTA 识别 */
export function detectCTA(text = '') {
  const t = String(text);
  const map = {
    cta_follow: ['关注', '关注我', '点关注', '不迷路'],
    cta_like: ['点赞', '双击', '点个赞', '小心心'],
    cta_comment: ['评论', '评论区', '留言', '告诉我', '说说你'],
    cta_collect: ['收藏', '码住', '保存', '收藏起来'],
    cta_cart: ['购物车', '链接', '小黄车', '下单', '同款'],
  };
  const out = [];
  for (const [id, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) out.push(id);
  }
  return out;
}

/** 句子切分（用于节奏分析的信息点计数） */
export function splitSentences(text = '') {
  return String(text)
    .split(/[。！？!?；;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
