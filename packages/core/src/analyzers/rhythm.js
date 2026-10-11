/** 节奏维度分析：时长 / 语速 / 信息密度 / 结构完整度 */
import { getTag } from '../taxonomy/taxonomy.js';
import { cnLength, splitSentences } from '../utils/text.js';
import { getPlatform, durationTagId } from '../platform.js';

function push(tags, id, confidence, evidence = []) {
  const meta = getTag(id);
  if (!meta) return;
  tags.push({ id, name: meta.name, dimension: 'rhythm', confidence, matched: evidence, group: 'rhythm' });
}

export function analyze(video, ctx = {}) {
  const platformId = video.platform || ctx.platform || 'douyin';
  const p = getPlatform(platformId);
  const duration = Number(video.duration) || 15;
  const len = cnLength(video.title);
  const sentences = splitSentences(video.title);
  const speed = duration > 0 ? len / duration : 0; // 字/秒（口播稿≈文案长度）
  const density = duration > 0 ? (sentences.length + 1) / duration : 0; // 信息点/秒

  const tags = [];

  // 1) 时长分档 —— 按平台走不同档位（抖音 15/30/60，B站 60/180/600）
  push(tags, durationTagId(platformId, duration), 0.95, [`${duration}s`]);

  // 2) 语速与信息密度 —— 只在拿得到口播稿/字幕的平台才算。
  //    B站不返回字幕，标题十几字除以几百秒 ≈ 0.1，套抖音阈值会把所有视频判成「慢节奏+低密度」。
  const canSpeed = p.rhythmMetrics.speed;
  const canDensity = p.rhythmMetrics.density;
  if (canSpeed) {
    if (speed > p.speedThresholds.fast) push(tags, 'speed_fast', 0.9, [`${speed.toFixed(2)}字/秒`]);
    else if (speed >= p.speedThresholds.medium) push(tags, 'speed_medium', 0.9, [`${speed.toFixed(2)}字/秒`]);
    else push(tags, 'speed_slow', 0.9, [`${speed.toFixed(2)}字/秒`]);
  }
  if (canDensity) {
    if (density > p.densityThresholds.high) push(tags, 'density_high', 0.85, [`${density.toFixed(2)}点/秒`]);
    else if (density > p.densityThresholds.medium) push(tags, 'density_medium', 0.85, [`${density.toFixed(2)}点/秒`]);
    else push(tags, 'density_low', 0.85, [`${density.toFixed(2)}点/秒`]);
  }

  // 3) 结构完整度：钩子 + 中段 + 收尾（CTA / 悬念 / 提问收尾）
  const patterns = ctx.copy?.metrics?.patterns || [];
  const hasHook = !!ctx.copy?.metrics?.hook;
  const hasMiddle = duration >= p.minMiddleDuration;
  const hasEnding = (ctx.copy?.metrics?.cta || []).length > 0
    || patterns.includes('suspense')
    || patterns.includes('question')
    || patterns.includes('contrast');
  const complete = hasHook && hasMiddle && hasEnding;
  // 无字幕通道（B站）只能凭标题与简介推断，置信度要降下来，不能装作很确定
  const structConfidence = canSpeed ? (complete ? 0.9 : 0.7) : 0.5;
  push(
    tags,
    complete ? 'struct_complete' : 'struct_partial',
    structConfidence,
    complete
      ? ['钩子+中段+收尾齐全']
      : [!hasHook ? '缺钩子' : !hasEnding ? '缺收尾' : '时长过短']
  );

  const durBand = tags[0]?.name || '';
  const parts = [durBand];
  if (canSpeed) parts.push(`语速 ${speed.toFixed(1)} 字/秒`);
  const densityTag = tags.find((t) => t.id.startsWith('density_'));
  if (densityTag) parts.push(densityTag.name);
  parts.push(complete ? '三段式结构完整' : '结构不完整，缺少收尾');

  return {
    tags,
    metrics: {
      duration,
      durationBand: durBand,
      speed: canSpeed ? Number(speed.toFixed(2)) : null,
      density: canDensity ? Number(density.toFixed(3)) : null,
      sentenceCount: sentences.length,
      structureComplete: complete,
      /** 哪些子指标在该平台不成立（前端可据此隐藏） */
      unavailable: [
        ...(canSpeed ? [] : ['speed']),
        ...(canDensity ? [] : ['density']),
      ],
    },
    summary: `${parts.join('，')}。`,
  };
}

export default analyze;
