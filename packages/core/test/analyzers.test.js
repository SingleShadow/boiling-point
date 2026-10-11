import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVideo, analyzeBatch } from '../src/analyzers/index.js';
import { rawMetrics } from '../src/analyzers/scoring.js';

const mkVideo = (over = {}) => ({
  id: 'v1',
  title: '布偶猫第一次见到雪，反应把我笑晕了',
  author: { nickname: '铲屎官', fans: 3560000 },
  stats: { play: 31200000, digg: 4100000, comment: 210000, share: 180000, collect: 620000 },
  duration: 19,
  createTime: new Date().toISOString(),
  music: { title: '《悬溺》', author: '热门BGM' },
  challenges: ['猫咪日常', '萌宠'],
  source: 'simulated',
  raw: { topicHint: 'topic_pet', craftHint: ['form_pov', 'hook_scene'] },
  ...over,
});

test('analyzeVideo 输出四维度结果', () => {
  const a = analyzeVideo(mkVideo());
  assert.ok(a.dimensions.topic && a.dimensions.copy && a.dimensions.rhythm && a.dimensions.craft);
  assert.ok(a.allTags.length > 0);
  assert.equal(a.dimensions.topic.primary.name, '萌宠');
});

test('文案维度能识别场景钩子与正向情绪', () => {
  const a = analyzeVideo(mkVideo());
  const ids = a.dimensions.copy.tags.map((t) => t.id);
  assert.ok(ids.includes('hook_scene'), `未识别场景钩子，实际: ${ids}`);
  assert.ok(ids.some((i) => i.startsWith('emo_')));
});

test('节奏维度按时长正确分档', () => {
  const short = analyzeVideo(mkVideo({ duration: 12 }));
  const long = analyzeVideo(mkVideo({ duration: 90 }));
  assert.ok(short.dimensions.rhythm.tagIds === undefined);
  assert.ok(short.dimensions.rhythm.tags.some((t) => t.id === 'dur_ultrashort'));
  assert.ok(long.dimensions.rhythm.tags.some((t) => t.id === 'dur_long'));
});

test('analyzeBatch 产出排名与 0-100 爆款指数', () => {
  const list = [
    mkVideo({ id: 'a', stats: { play: 100000, digg: 5000, comment: 100, share: 50, collect: 200 }, duration: 30 }),
    mkVideo({ id: 'b', stats: { play: 9000000, digg: 900000, comment: 40000, share: 30000, collect: 120000 }, duration: 15 }),
    mkVideo({ id: 'c', stats: { play: 500000, digg: 20000, comment: 800, share: 300, collect: 900 }, duration: 45 }),
  ];
  const res = analyzeBatch(list);
  assert.equal(res.length, 3);
  assert.equal(res[0].rank, 1);
  assert.equal(res[0].video.id, 'b');
  for (const e of res) {
    assert.ok(e.boilingScore >= 0 && e.boilingScore <= 100, `分数越界: ${e.boilingScore}`);
    assert.ok(['S', 'A', 'B', 'C'].includes(e.grade.level));
  }
});

test('rawMetrics 计算互动率与传播系数', () => {
  const m = rawMetrics(mkVideo());
  assert.ok(m.play > 0);
  assert.ok(m.engagementRate > 0 && m.engagementRate < 1);
  assert.ok(m.completionProxy > 0 && m.completionProxy <= 1);
});

test('未知题材会兜底为其他/综合', () => {
  const a = analyzeVideo(mkVideo({
    title: 'asdfqwer',
    challenges: [],
    raw: {},
  }));
  assert.equal(a.dimensions.topic.primary.id, 'topic_other');
});
