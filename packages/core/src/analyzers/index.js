/** 四维分析引擎入口 */
import topicAnalyze from './topic.js';
import copyAnalyze from './copy.js';
import rhythmAnalyze from './rhythm.js';
import craftAnalyze from './craft.js';
import { scoreBatch } from './scoring.js';

/** 单条视频 -> 四维拆解 */
export function analyzeVideo(video) {
  const topic = topicAnalyze(video);
  const copy = copyAnalyze(video);
  const rhythm = rhythmAnalyze(video, { copy });
  const craft = craftAnalyze(video, { topic, copy });

  const allTags = [...topic.tags, ...copy.tags, ...rhythm.tags, ...craft.tags].map((t) => ({
    id: t.id,
    name: t.name,
    dimension: t.dimension,
    confidence: Number(Number(t.confidence).toFixed(2)),
  }));

  return {
    dimensions: { topic, copy, rhythm, craft },
    allTags,
    tagIds: allTags.map((t) => t.id),
    summary: {
      topic: topic.summary,
      copy: copy.summary,
      rhythm: rhythm.summary,
      craft: craft.summary,
    },
    headline: `${topic.primary.name} · ${craft.metrics.form} · ${rhythm.metrics.durationBand}`,
  };
}

/** 批量：先分析再算爆款指数（需榜单内相对分位） */
export function analyzeBatch(videos = []) {
  const entries = videos.map((video) => ({ video, analysis: analyzeVideo(video) }));
  const scored = scoreBatch(entries);
  return scored.sort((a, b) => b.boilingScore - a.boilingScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export { topicAnalyze, copyAnalyze, rhythmAnalyze, craftAnalyze, scoreBatch };
