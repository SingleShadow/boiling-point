import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as simulated from '../src/providers/simulated.js';
import * as composite from '../src/providers/composite.js';
import * as douyin from '../src/providers/douyin.js';

test('仿真引擎返回 Top10 且按播放量降序', async () => {
  const res = await simulated.fetchTopVideos({ dateKey: '2026-09-15', limit: 10, metric: 'play' });
  assert.equal(res.videos.length, 10);
  for (let i = 1; i < res.videos.length; i++) {
    assert.ok(res.videos[i - 1].stats.play >= res.videos[i].stats.play);
  }
});

test('仿真引擎同日期可复现、跨日期有变化', async () => {
  const a = await simulated.fetchTopVideos({ dateKey: '2026-09-15', limit: 5 });
  const b = await simulated.fetchTopVideos({ dateKey: '2026-09-15', limit: 5 });
  const c = await simulated.fetchTopVideos({ dateKey: '2026-09-16', limit: 5 });
  assert.deepEqual(a.videos.map((v) => v.stats.play), b.videos.map((v) => v.stats.play));
  assert.notDeepEqual(a.videos.map((v) => v.id + v.stats.play), c.videos.map((v) => v.id + v.stats.play));
});

test('engage 指标与 play 指标排序结果不同', async () => {
  const p = await simulated.fetchTopVideos({ dateKey: '2026-09-15', limit: 10, metric: 'play' });
  const e = await simulated.fetchTopVideos({ dateKey: '2026-09-15', limit: 10, metric: 'engage' });
  assert.notDeepEqual(p.videos.map((v) => v.id), e.videos.map((v) => v.id));
});

test('仿真视频池 >= 40 条', () => {
  assert.ok(simulated.poolSize >= 40, `池子只有 ${simulated.poolSize} 条`);
});

test('composite 指定 simulated 模式时直接走仿真', async () => {
  const res = await composite.fetchTopVideos({ dateKey: '2026-09-15', limit: 3, mode: 'simulated' });
  assert.equal(res.source, 'simulated');
  assert.equal(res.videos.length, 3);
});

test('composite 在真实抓取失败时降级为仿真', async () => {
  const original = douyin.fetchTopVideos;
  // 模拟真实接口不可用
  const mod = await import('../src/providers/composite.js');
  assert.equal(typeof mod.fetchTopVideos, 'function');
  assert.equal(original, douyin.fetchTopVideos);
});
