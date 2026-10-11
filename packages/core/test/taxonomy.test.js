import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportTaxonomy, getTag, scoreByKeywords, TOPIC_TAGS } from '../src/taxonomy/taxonomy.js';

test('标签体系包含四个维度且总量 > 50', () => {
  const t = exportTaxonomy();
  assert.equal(t.dimensions.length, 4);
  assert.equal(t.groups.length, 4);
  assert.ok(t.total > 50, `标签总数应 > 50，实际 ${t.total}`);
});

test('题材类目覆盖 20 个一级题材', () => {
  // 18 个是抖音生态的原始设计；接 B站后补了「音乐」「动画影视」两个大类，
  // 否则这两类在 B站热门榜里占比很高却只能落进「其他/综合」。
  const real = TOPIC_TAGS.filter((t) => t.id !== 'topic_other');
  assert.equal(real.length, 20);
});

test('B站平台映射：分区能翻译成题材', async () => {
  const { mapCategory } = await import('../src/platform.js');
  assert.equal(mapCategory('bilibili', '单机游戏').topicHint, 'topic_game');
  assert.equal(mapCategory('bilibili', '美食制作').topicHint, 'topic_food');
  assert.equal(mapCategory('bilibili', 'MV').topicHint, 'topic_music');
  assert.equal(mapCategory('bilibili', '国产动画').topicHint, 'topic_animation');
  // 映射不到的分区不能硬猜
  assert.equal(mapCategory('bilibili', '综合').topicHint, null);
  assert.equal(mapCategory('bilibili', '').topicHint, null);
  // 抖音没有分区概念，不走这套映射
  assert.equal(mapCategory('douyin', '搞笑').topicHint, null);
});

test('平台时长分档：B站与抖音用不同档位', async () => {
  const { durationTagId } = await import('../src/platform.js');
  assert.equal(durationTagId('bilibili', 127), 'dur_b_medium');
  assert.equal(durationTagId('bilibili', 1259), 'dur_b_xlong');
  assert.equal(durationTagId('douyin', 127), 'dur_long');
  assert.equal(durationTagId('douyin', 25), 'dur_short');
});

test('B站不输出语速与信息密度（无拿不到口播稿）', async () => {
  const rhythmAnalyze = (await import('../src/analyzers/rhythm.js')).default;
  const bili = rhythmAnalyze({ title: '一个十来字的标题', duration: 300, platform: 'bilibili' });
  assert.ok(!bili.tags.some((t) => t.id.startsWith('speed_')), 'B站不应出现语速标签');
  assert.ok(!bili.tags.some((t) => t.id.startsWith('density_')), 'B站不应出现信息密度标签');
  assert.deepEqual(bili.metrics.unavailable, ['speed', 'density']);
  assert.equal(bili.metrics.speed, null);

  const dy = rhythmAnalyze({ title: '一个十来字的标题', duration: 30, platform: 'douyin' });
  assert.ok(dy.tags.some((t) => t.id.startsWith('speed_')), '抖音仍应输出语速标签');
});

test('无形式信号时不再默认判为口播', async () => {
  const craftAnalyze = (await import('../src/analyzers/craft.js')).default;
  const r = craftAnalyze({ title: '没有任何形式线索的标题', duration: 300, challenges: [] }, {});
  assert.equal(r.metrics.form, '形式未判定');
  // 维度不能为空，否则质检会判「维度缺失」
  assert.ok(r.tags.length >= 1);
});

test('每个标签都有 id/name/keywords 字段', () => {
  for (const t of TOPIC_TAGS) {
    assert.ok(t.id && t.name, `${t.id} 缺字段`);
    assert.ok(Array.isArray(t.keywords));
  }
});

test('getTag 能按 id 取回标签', () => {
  const tag = getTag('topic_pet');
  assert.equal(tag.name, '萌宠');
  assert.equal(getTag('not_exist'), null);
});

test('scoreByKeywords 命中越多置信度越高', () => {
  const one = scoreByKeywords('养了一只布偶猫', ['猫'], 1);
  const many = scoreByKeywords('布偶猫和金毛狗', ['猫', '狗'], 1);
  assert.ok(one.confidence > 0);
  assert.ok(many.confidence >= one.confidence);
  assert.deepEqual(one.matched, ['猫']);
});

test('scoreByKeywords 无命中返回 0 置信度', () => {
  const r = scoreByKeywords('今天天气不错', ['区块链'], 1);
  assert.equal(r.confidence, 0);
});
