import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportTaxonomy, getTag, scoreByKeywords, TOPIC_TAGS } from '../src/taxonomy/taxonomy.js';

test('标签体系包含四个维度且总量 > 50', () => {
  const t = exportTaxonomy();
  assert.equal(t.dimensions.length, 4);
  assert.equal(t.groups.length, 4);
  assert.ok(t.total > 50, `标签总数应 > 50，实际 ${t.total}`);
});

test('题材类目覆盖 18 个一级题材', () => {
  const real = TOPIC_TAGS.filter((t) => t.id !== 'topic_other');
  assert.equal(real.length, 18);
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
