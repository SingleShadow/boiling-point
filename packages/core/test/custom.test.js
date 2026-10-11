/**
 * 自定义数据源适配器测试
 *
 * 用本地 HTTP mock 服务端到端验证 —— 目的是证明「接数据商」这条路的代码是通的。
 * 用户拿到真实 API 后如果接不通，问题一定在 URL/Key/字段映射，不在这套代码。
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import * as custom from '../src/providers/custom.js';

const servers = [];
const ENV_KEYS = [
  'CUSTOM_API_URL', 'CUSTOM_API_METHOD', 'CUSTOM_API_KEY', 'CUSTOM_API_AUTH',
  'CUSTOM_API_HEADERS', 'CUSTOM_API_BODY', 'CUSTOM_API_LIST_PATH',
  'CUSTOM_API_MAP', 'CUSTOM_DURATION_UNIT', 'CUSTOM_API_TIMEOUT_MS',
];

function startServer(handler) {
  return new Promise((resolve) => {
    const s = createServer(handler);
    s.listen(0, '127.0.0.1', () => {
      servers.push(s);
      resolve(`http://127.0.0.1:${s.address().port}`);
    });
  });
}

function json(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

afterEach(() => {
  while (servers.length) servers.pop().close();
  for (const k of ENV_KEYS) delete process.env[k];
});

test('未配置 CUSTOM_API_URL 时不可用', async () => {
  assert.equal(custom.isConfigured(), false);
  await assert.rejects(() => custom.fetchTopVideos({ limit: 5 }), /CUSTOM_API_URL/);
});

test('标准抖音结构可正确解析（data.list）', async () => {
  const base = await startServer((req, res) => {
    json(res, {
      data: {
        list: [
          {
            aweme_id: 'v1', desc: '第一条',
            duration: 21000,
            statistics: { play_count: 1000, digg_count: 100, comment_count: 10, share_count: 5, collect_count: 20 },
            author: { nickname: '作者A', follower_count: 5000 },
            share_url: 'https://douyin.com/v1',
            music: { title: 'BGM1' },
            text_extra: [{ cha_name: '萌宠' }, { cha_name: '搞笑' }],
            create_time: 1758000000,
          },
          {
            aweme_id: 'v2', desc: '第二条', duration: 45000,
            statistics: { play_count: 5000, digg_count: 900 },
            author: { nickname: '作者B' },
            create_time: 1758000000,
          },
        ],
      },
    });
  });

  process.env.CUSTOM_API_URL = `${base}/hot`;
  const r = await custom.fetchTopVideos({ limit: 10, dateKey: '2026-09-16' });

  assert.equal(r.source, 'custom');
  assert.equal(r.videos.length, 2);
  // 按播放降序，第二条(5000)排前面
  assert.equal(r.videos[0].id, 'v2');
  assert.equal(r.videos[0].stats.play, 5000);
  assert.equal(r.videos[0].duration, 45); // ms -> s
  assert.equal(r.videos[1].author.nickname, '作者A');
  assert.equal(r.videos[1].stats.digg, 100);
  assert.deepEqual(r.videos[1].challenges, ['萌宠', '搞笑']);
  assert.equal(r.warnings.length, 0, '字段齐全时不应有告警');
});

test('自定义 list path 与字段映射生效', async () => {
  const base = await startServer((req, res) => {
    json(res, {
      result: {
        items: [
          { videoId: 'x1', name: '标题X', views: 300, likes: 30, sec: 12 },
          { videoId: 'x2', name: '标题Y', views: 900, likes: 80, sec: 30 },
        ],
      },
    });
  });

  process.env.CUSTOM_API_URL = `${base}/x`;
  process.env.CUSTOM_API_LIST_PATH = 'result.items';
  process.env.CUSTOM_API_MAP = JSON.stringify({
    id: 'videoId', title: 'name', play: 'views', digg: 'likes', duration: 'sec',
  });
  process.env.CUSTOM_DURATION_UNIT = 's';

  const r = await custom.fetchTopVideos({ limit: 10, dateKey: '2026-09-16' });
  assert.equal(r.videos[0].title, '标题Y');
  assert.equal(r.videos[0].stats.play, 900);
  assert.equal(r.videos[0].duration, 30, 'CUSTOM_DURATION_UNIT=s 时不做 ms 换算');
});

test('APPCODE 认证头正确发出（阿里云市场）', async () => {
  let seenAuth = '';
  const base = await startServer((req, res) => {
    seenAuth = req.headers.authorization || '';
    json(res, { data: { list: [{ aweme_id: 'a', desc: 't', statistics: { play_count: 1 } }] } });
  });

  process.env.CUSTOM_API_URL = `${base}/aliyun`;
  process.env.CUSTOM_API_KEY = 'abc123';
  process.env.CUSTOM_API_AUTH = 'appcode';

  await custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' });
  assert.equal(seenAuth, 'APPCODE abc123');
});

test('默认认证为 Bearer，raw 模式原样透传', async () => {
  const seen = [];
  const base = await startServer((req, res) => {
    seen.push(req.headers.authorization || '');
    json(res, { data: { list: [{ aweme_id: 'a', desc: 't', statistics: { play_count: 1 } }] } });
  });

  process.env.CUSTOM_API_URL = `${base}/h`;
  process.env.CUSTOM_API_KEY = 'k1';
  await custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' });

  process.env.CUSTOM_API_AUTH = 'raw';
  process.env.CUSTOM_API_KEY = 'ApiKey k2';
  await custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' });

  assert.equal(seen[0], 'Bearer k1');
  assert.equal(seen[1], 'ApiKey k2');
});

test('播放量全为 0 时给出映射告警（防废数据静默入库）', async () => {
  const base = await startServer((req, res) => {
    json(res, { data: { list: [{ aweme_id: 'a', desc: '话题榜条目', statistics: {} }] } });
  });

  process.env.CUSTOM_API_URL = `${base}/w`;
  const r = await custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' });
  assert.ok(r.warnings.some((w) => w.includes('播放量全为 0')), '应提示映射可能错误');
  assert.ok(r.warnings.some((w) => w.includes('CUSTOM_API_MAP.play')));
});

test('POST + 占位符 {{limit}} {{date}} 生效', async () => {
  let body = '';
  const base = await startServer((req, res) => {
    req.on('data', (c) => { body += c; });
    req.on('end', () => json(res, { data: { list: [{ aweme_id: 'p', desc: 'post', statistics: { play_count: 5 } }] } }));
  });

  process.env.CUSTOM_API_URL = `${base}/post`;
  process.env.CUSTOM_API_METHOD = 'POST';
  process.env.CUSTOM_API_BODY = '{"size":{{limit}},"date":"{{date}}"}';

  await custom.fetchTopVideos({ limit: 7, dateKey: '2026-09-16' });
  assert.deepEqual(JSON.parse(body), { size: 7, date: '2026-09-16' });
});

test('根数组响应可直接解析', async () => {
  const base = await startServer((req, res) => {
    json(res, [{ aweme_id: 'r1', desc: '根数组', statistics: { play_count: 42 } }]);
  });
  process.env.CUSTOM_API_URL = `${base}/root`;
  process.env.CUSTOM_API_LIST_PATH = 'data.list'; // 取不到会回退到根
  const r = await custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' });
  assert.equal(r.videos[0].title, '根数组');
});

test('HTTP 500 抛出可读错误', async () => {
  const base = await startServer((req, res) => json(res, { msg: 'boom' }, 500));
  process.env.CUSTOM_API_URL = `${base}/err`;
  await assert.rejects(() => custom.fetchTopVideos({ limit: 5, dateKey: '2026-09-16' }), /HTTP 500/);
});

test('getPath 支持嵌套与 arr[].field', () => {
  const o = { a: { b: { c: 7 } }, list: [{ n: 'x' }, { n: 'y' }] };
  assert.equal(custom.getPath(o, 'a.b.c'), 7);
  assert.deepEqual(custom.getPath(o, 'list[].n'), ['x', 'y']);
  assert.equal(custom.getPath(o, 'a.b.zzz'), undefined);
  assert.deepEqual(custom.getPath(o, 'nope[].n'), []);
});
