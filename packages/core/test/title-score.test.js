import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseline, scoreTitle, similarTitles, extractFeatures } from '../src/scorer/title.js';

/** 一组"像热门标题"的样本：普遍含数字、悬念、括号 */
const HOT = [
  '【4K 修复】我花了 30 天，把 10 年前的老歌重新录了一遍',
  '为什么没人做这个？我试了 3 个月，结局谁也没想到',
  '花了 2000 块买了 5 台相机，最后只留下这一台',
  '以前我 3 小时做完的活，现在 10 分钟搞定，差距在哪',
  '看到最后我破防了：这是我见过最治愈的一条留言',
  '【全程干货】5 个方法，让你的视频完播率翻倍',
  '别人做 100 条没人看，我做了 10 条就爆了，区别只有 1 个',
  '千万别再这样剪视频了，我踩过的坑都在这里',
  '我第一次去新疆，看到最后愣住了',
  '【实测】3 款软件对比，第 2 个真的绝了',
  '凭什么他的视频 100 万播放，我的只有 200？',
  '10 分钟看完这部电影，结局万万没想到',
  '我们花了 6 个月，做了件没人相信能成的事',
  '第一人称镜头到底怎么拍？5 个技巧一次讲清',
  '这个设计离谱到我了，居然真的能用',
];

test('基准统计：比例与长度分位数正确', () => {
  const bl = buildBaseline(HOT);
  assert.equal(bl.size, 15);
  assert.ok(bl.rate.number > 0.5, `含数字比例应过半，实际 ${bl.rate.number}`);
  assert.ok(bl.rate.bracket > 0.1);
  assert.ok(bl.length.p25 > 0 && bl.length.p75 >= bl.length.p25);
  assert.ok(bl.length.p50 >= bl.length.p25 && bl.length.p50 <= bl.length.p75);
});

test('基准为空或样本不足时不给出可信评分', () => {
  const r1 = scoreTitle('测试标题', buildBaseline([]));
  assert.equal(r1.score, 0);
  assert.match(r1.verdict, /基准样本不足/);

  const r2 = scoreTitle('测试标题', buildBaseline(HOT.slice(0, 3)));
  assert.equal(r2.score, 0);
  assert.match(r2.verdict, /基准样本不足/);
});

test('空标题直接 0 分并提示输入', () => {
  const r = scoreTitle('   ', buildBaseline(HOT));
  assert.equal(r.score, 0);
  assert.match(r.suggestions[0], /先写一个标题/);
});

test('命中热门写法明显优于什么都不命中', () => {
  const bl = buildBaseline(HOT);
  const good = scoreTitle('【实测】我花了 30 天做这 3 件事，结局万万没想到', bl);
  const bad = scoreTitle('分享一下我的日常', bl);
  assert.ok(good.score > bad.score, `好的(${good.score}) 应高于 差的(${bad.score})`);
  assert.ok(['A', 'B'].includes(good.grade), `好标题应到 B 以上，实际 ${good.grade}`);
  assert.equal(bad.grade, 'D');
});

test('分数始终落在 0-100', () => {
  const bl = buildBaseline(HOT);
  for (const t of ['', '啊', '【实测】我花了 30 天做这 3 件事，结局万万没想到，为什么没人告诉我，看到最后我愣住了，第一人称视角，千万别再错过，点赞收藏关注一键三连，' + '很长'.repeat(40)]) {
    const r = scoreTitle(t, bl);
    assert.ok(r.score >= 0 && r.score <= 100, `越界: ${r.score}`);
  }
});

test('每一条建议都带真实占比数据', () => {
  const bl = buildBaseline(HOT);
  const r = scoreTitle('分享一下我的日常', bl);
  assert.ok(r.suggestions.length > 0);
  const withData = r.suggestions.filter((s) => /热门中 \d+%/.test(s));
  assert.ok(withData.length > 0, `建议应带占比: ${JSON.stringify(r.suggestions)}`);
});

test('过短标题给出长度建议', () => {
  const bl = buildBaseline(HOT);
  const r = scoreTitle('日常', bl);
  assert.equal(r.length.verdict, 'short');
  assert.ok(r.suggestions.some((s) => /偏短/.test(s)));
});

test('特征抽取：括号与话题标签可识别', () => {
  const a = extractFeatures('【4K】测试 #阴阳师');
  assert.ok(a.hits.has('bracket'));
  assert.equal(a.hasTopicTag, true);

  const b = extractFeatures('测试标题');
  assert.equal(b.hasTopicTag, false);
});

test('相似标题按相似度降序返回', () => {
  const pool = [
    { title: '我花了 30 天做视频，最后只留下这一台设备', play: 1000 },
    { title: '今天天气不错出去走走', play: 10 },
    { title: '花了 30 天，我做了件没人相信的事', play: 500 },
  ];
  const r = similarTitles('我花了 30 天做了一件没人相信的事', pool, 2);
  assert.equal(r.length, 2);
  assert.ok(r[0].similarity >= r[1].similarity);
  assert.match(r[0].title, /30 天/);
});

test('空池或空标题不报错', () => {
  assert.deepEqual(similarTitles('测试', []), []);
  assert.deepEqual(similarTitles('', [{ title: 'x' }]), []);
});
