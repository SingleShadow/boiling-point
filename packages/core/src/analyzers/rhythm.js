/** 节奏维度分析：时长 / 语速 / 信息密度 / 结构完整度 */
import { getTag } from '../taxonomy/taxonomy.js';
import { cnLength, splitSentences } from '../utils/text.js';

function push(tags, id, confidence, evidence = []) {
  const meta = getTag(id);
  if (!meta) return;
  tags.push({ id, name: meta.name, dimension: 'rhythm', confidence, matched: evidence, group: 'rhythm' });
}

export function analyze(video, ctx = {}) {
  const duration = Number(video.duration) || 15;
  const len = cnLength(video.title);
  const sentences = splitSentences(video.title);
  const speed = duration > 0 ? len / duration : 0; // 字/秒（口播稿≈文案长度）
  const density = duration > 0 ? (sentences.length + 1) / duration : 0; // 信息点/秒

  const tags = [];
  // 时长分档
  if (duration < 15) push(tags, 'dur_ultrashort', 0.95, [`${duration}s`]);
  else if (duration < 30) push(tags, 'dur_short', 0.95, [`${duration}s`]);
  else if (duration <= 60) push(tags, 'dur_medium', 0.95, [`${duration}s`]);
  else push(tags, 'dur_long', 0.95, [`${duration}s`]);

  // 语速（口径：文案字数 / 时长，短视频文案普遍 0.3~2 字/秒，按实际分布校准）
  if (speed > 1.2) push(tags, 'speed_fast', 0.9, [`${speed.toFixed(2)}字/秒`]);
  else if (speed >= 0.6) push(tags, 'speed_medium', 0.9, [`${speed.toFixed(2)}字/秒`]);
  else push(tags, 'speed_slow', 0.9, [`${speed.toFixed(2)}字/秒`]);

  // 信息密度（句子数 / 时长）
  if (density > 0.12) push(tags, 'density_high', 0.85, [`${density.toFixed(2)}点/秒`]);
  else if (density > 0.05) push(tags, 'density_medium', 0.85, [`${density.toFixed(2)}点/秒`]);
  else push(tags, 'density_low', 0.85, [`${density.toFixed(2)}点/秒`]);

  // 结构完整度：钩子 + 中段 + 收尾（CTA / 悬念 / 提问收尾）
  const patterns = ctx.copy?.metrics?.patterns || [];
  const hasHook = !!ctx.copy?.metrics?.hook;
  const hasMiddle = duration >= 15;
  const hasEnding = (ctx.copy?.metrics?.cta || []).length > 0
    || patterns.includes('suspense')
    || patterns.includes('question')
    || patterns.includes('contrast');
  const complete = hasHook && hasMiddle && hasEnding;
  push(
    tags,
    complete ? 'struct_complete' : 'struct_partial',
    complete ? 0.9 : 0.7,
    complete ? ['钩子+中段+收尾齐全'] : [!hasHook ? '缺钩子' : !hasEnding ? '缺收尾' : '时长过短']
  );

  const durBand = tags[0]?.name || '';
  return {
    tags,
    metrics: {
      duration,
      durationBand: durBand,
      speed: Number(speed.toFixed(2)),
      density: Number(density.toFixed(3)),
      sentenceCount: sentences.length,
      structureComplete: complete,
    },
    summary: `${durBand}，语速 ${speed.toFixed(1)} 字/秒，${tags.find((t) => t.id.startsWith('density'))?.name || ''}，${complete ? '三段式结构完整' : '结构不完整，缺少收尾'}。`,
  };
}

export default analyze;
