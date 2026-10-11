/** 文案维度分析：句式 / 钩子 / 情绪 / 关键词 / CTA */
import { scoreByKeywords, getTag } from '../taxonomy/taxonomy.js';
import {
  cnLength, detectEmotion, detectSentencePatterns, detectCTA, extractKeywords, splitSentences,
} from '../utils/text.js';

const PATTERN_TO_TAG = {
  question: 'copy_question',
  number: 'copy_number',
  suspense: 'copy_suspense',
  command: 'copy_command',
  contrast: 'copy_contrast',
  firstperson: 'copy_firstperson',
  list: 'copy_list',
  story: 'copy_story',
  plain: 'copy_plain',
};

const HOOK_TAGS = ['hook_question', 'hook_conflict', 'hook_reverse', 'hook_promise', 'hook_emotion', 'hook_scene'];

export function analyze(video) {
  const title = String(video.title || '');
  const len = cnLength(title);
  const head = title.slice(0, 16); // 黄金前 3 秒≈前 16 字
  const patterns = detectSentencePatterns(title);
  const emotion = detectEmotion(title);
  const ctas = detectCTA(title);
  const keywords = extractKeywords(title, 6);
  const sentences = splitSentences(title);

  const tags = [];

  // 句式
  for (const p of patterns) {
    const id = PATTERN_TO_TAG[p];
    if (!id) continue;
    const meta = getTag(id);
    tags.push({ id, name: meta.name, dimension: 'copy', confidence: p === 'plain' ? 0.4 : 0.8, matched: [p], group: '句式' });
  }

  // 钩子（只在前 16 字里找）
  for (const id of HOOK_TAGS) {
    const meta = getTag(id);
    const r = scoreByKeywords(head, meta.keywords, 1.2);
    if (r.confidence > 0) {
      tags.push({ id, name: meta.name, dimension: 'copy', confidence: Math.min(1, r.confidence + 0.15), matched: r.matched, group: '钩子' });
    }
  }
  if (!tags.some((t) => t.group === '钩子')) {
    tags.push({ id: 'hook_scene', name: '场景钩子', dimension: 'copy', confidence: 0.35, matched: [], group: '钩子' });
  }

  // 情绪
  const emoId = emotion.polarity === 'positive' ? 'emo_positive' : emotion.polarity === 'negative' ? 'emo_negative' : 'emo_neutral';
  const emoMeta = getTag(emoId);
  tags.push({ id: emoId, name: emoMeta.name, dimension: 'copy', confidence: Math.max(0.5, emotion.intensity), matched: [...emotion.positive, ...emotion.negative], group: '情绪' });
  if (emotion.intensifiers.length) {
    const m = getTag('emo_heated');
    tags.push({ id: 'emo_heated', name: m.name, dimension: 'copy', confidence: Math.min(1, 0.5 + emotion.intensifiers.length * 0.2), matched: emotion.intensifiers, group: '情绪' });
  }

  // CTA
  for (const id of ctas) {
    const m = getTag(id);
    tags.push({ id, name: m.name, dimension: 'copy', confidence: 0.85, matched: [id], group: 'CTA' });
  }

  return {
    tags: tags.sort((a, b) => b.confidence - a.confidence),
    metrics: {
      length: len,
      lengthBand: len <= 15 ? '短文案' : len <= 30 ? '中文案' : len <= 50 ? '长文案' : '超长文案',
      sentenceCount: sentences.length,
      patterns,
      emotion,
      cta: ctas,
      keywords,
      hook: tags.find((t) => t.group === '钩子') || null,
    },
    summary: `${len} 字${len <= 15 ? '短' : len <= 30 ? '中' : '长'}文案，${(tags.find((t) => t.group === '钩子') || {}).name || '场景'}开头，${emoMeta.name}，${ctas.length ? `含 ${ctas.length} 处转化引导` : '无显式引导'}。`,
  };
}

export default analyze;
