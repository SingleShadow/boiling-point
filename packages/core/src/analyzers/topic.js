/** 题材维度分析 */
import { TOPIC_TAGS, scoreByKeywords } from '../taxonomy/taxonomy.js';

export function analyze(video) {
  const text = [video.title, ...(video.challenges || []), video.music?.title || ''].join(' ');
  const hint = video.raw?.topicHint;

  const scored = TOPIC_TAGS.map((tag) => {
    const r = scoreByKeywords(text, tag.keywords, tag.weight);
    let confidence = r.confidence;
    let matched = r.matched;
    if (hint && tag.id === hint) {
      confidence = Math.max(confidence, 0.96);
      matched = [...matched, '数据源类目'];
    }
    return { id: tag.id, name: tag.name, dimension: 'topic', confidence, matched, desc: tag.desc };
  })
    .filter((t) => t.confidence > 0 && t.id !== 'topic_other')
    .sort((a, b) => b.confidence - a.confidence);

  const tags = scored.slice(0, 3);
  const primary = tags[0] || {
    id: 'topic_other',
    name: '其他/综合',
    dimension: 'topic',
    confidence: 0.4,
    matched: [],
    desc: '未命中明确类目',
  };

  return {
    tags: [primary, ...tags.filter((t) => t.id !== primary.id)],
    primary,
    summary: `主题材为「${primary.name}」${tags.length > 1 ? `，兼有${tags.slice(1).map((t) => t.name).join('、')}` : ''}。`,
  };
}

export default analyze;
