/** 表现手法维度分析：形式 / 技法 / 元素 / 互动设计 */
import { CRAFT_TAGS, scoreByKeywords, getTag } from '../taxonomy/taxonomy.js';

const GROUP_OF = (id) =>
  id.startsWith('form_') ? '形式'
    : id.startsWith('tech_') ? '技法'
      : id.startsWith('elem_') ? '元素'
        : id.startsWith('interact_') ? '互动设计' : '其他';

/** 题材 → 常见表现形式（弱先验） */
const TOPIC_PRIOR = {
  topic_pet: ['form_pov', 'form_cctv'],
  topic_beauty: ['tech_transition', 'tech_contrast'],
  topic_knowledge: ['form_talking'],
  topic_drama: ['form_acting'],
  topic_food: ['form_vlog', 'form_pov'],
  topic_travel: ['form_vlog'],
  topic_guofeng: ['form_vlog', 'tech_transition'],
  topic_rural: ['form_vlog'],
  topic_shop: ['form_pov'],
  topic_comedy: ['form_acting', 'form_slideshow'],
  topic_fashion: ['form_beat', 'tech_transition'],
  topic_fitness: ['form_talking'],
  topic_career: ['form_talking'],
  topic_emotion: ['form_vlog', 'form_cctv'],
  topic_tech: ['form_talking', 'form_vlog'],
  topic_auto: ['form_talking', 'form_slideshow'],
  topic_game: ['form_slideshow'],
  topic_parenting: ['form_vlog', 'form_acting'],
  topic_other: [],
};

export function analyze(video, ctx = {}) {
  const text = [video.title, ...(video.challenges || [])].join(' ');
  const duration = Number(video.duration) || 15;
  const tags = [];
  const seen = new Set();

  const add = (id, confidence, matched = []) => {
    if (seen.has(id)) return;
    const meta = getTag(id);
    if (!meta) return;
    seen.add(id);
    tags.push({ id, name: meta.name, dimension: 'craft', confidence, matched, group: GROUP_OF(id) });
  };

  // 1) 文案关键词命中
  for (const tag of CRAFT_TAGS) {
    if (!tag.keywords.length) continue;
    const r = scoreByKeywords(text, tag.keywords, tag.weight);
    if (r.confidence > 0) add(tag.id, Math.min(1, r.confidence), r.matched);
  }

  // 2) 数据源提示（仿真池自带）
  for (const id of video.raw?.craftHint || []) add(id, 0.9, ['数据源标注']);

  // 3) 题材先验
  const topicId = ctx.topic?.primary?.id;
  for (const id of TOPIC_PRIOR[topicId] || []) {
    if (!seen.has(id)) add(id, 0.55, [`${ctx.topic?.primary?.name || '题材'}常见形式`]);
  }

  // 4) 客观信号
  if (video.music?.title) add('elem_bgm', 0.8, [video.music.title]);
  if (duration <= 20 && !tags.some((t) => t.id.startsWith('form_'))) add('form_beat', 0.5, ['短视频常见卡点']);
  if (!tags.some((t) => t.id.startsWith('form_'))) add('form_talking', 0.4, ['默认推断']);

  const formTag = tags.find((t) => t.group === '形式');
  const techTags = tags.filter((t) => t.group === '技法');
  const interactTags = tags.filter((t) => t.group === '互动设计');

  return {
    tags: tags.sort((a, b) => b.confidence - a.confidence),
    metrics: {
      form: formTag?.name || '未知',
      techniques: techTags.map((t) => t.name),
      interactions: interactTags.map((t) => t.name),
    },
    summary: `${formTag?.name || '未知形式'}为主${techTags.length ? `，运用${techTags.map((t) => t.name).join('、')}` : ''}${interactTags.length ? `，带${interactTags.map((t) => t.name).join('、')}` : ''}。`,
  };
}

export default analyze;
