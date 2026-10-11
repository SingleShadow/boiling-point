/**
 * 抖音真实数据适配器
 * 通道 A：抖音公开 Web 接口（热搜榜 / 热门视频榜），无需 Key
 * 通道 B：第三方 API（DOUYIN_API_BASE + DOUYIN_API_KEY），需配置
 * 任何一步失败都抛出，由 CompositeProvider 负责降级。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TIMEOUT_MS = Number(process.env.DOUYIN_TIMEOUT_MS || 8000);

/**
 * 实测（2026-09）：
 *  - billboard/word/   可用，返回 50 条真实热搜词 + hot_value
 *  - aweme/v1/web/.../hot/search/list/  已 403，抖音关闭了免签名的公开视频榜
 *  - billboard/aweme/  返回 200 但数组为空，视频榜不再公开
 * 结论：免 Key 通道只能拿到「今日热搜话题」，拿不到视频级播放数据。
 * 视频榜必须走第三方数据服务（DOUYIN_API_BASE/KEY）或自建采集。
 */
const HOT_WORD_URL = 'https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/';
/** 备用热搜通道（第三方镜像，字段结构不同：title / hot_value / link / active_time） */
const HOT_WORD_BACKUP_URL = 'https://60s.viki.moe/v2/douyin';
const HOT_VIDEO_URL = 'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1';

async function getJSON(url, { headers = {}, timeout = TIMEOUT_MS } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', ...headers },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // 反爬拦截通常返回 403 + 空 body，直接 res.json() 会抛「Unexpected end of JSON input」，
    // 这个错误看不出是被封还是接口坏了，必须翻译成人能判断的信息。
    if (!text.trim()) throw new Error(`HTTP ${res.status} 空响应（多半是反爬拦截，该通道已不可用）`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status} 响应不是 JSON：${text.trim().slice(0, 60)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 从千奇百怪的字段结构里抠出统计数字 */
function pickStats(a) {
  const s = a.statistics || a.stats || a.video_statistics || {};
  return {
    play: num(s.play_count ?? s.playCount ?? s.vv_count ?? a.play_count ?? 0),
    digg: num(s.digg_count ?? s.diggCount ?? s.like_count ?? a.digg_count ?? 0),
    comment: num(s.comment_count ?? s.commentCount ?? a.comment_count ?? 0),
    share: num(s.share_count ?? s.shareCount ?? a.share_count ?? 0),
    collect: num(s.collect_count ?? s.collectCount ?? a.collect_count ?? 0),
  };
}

function pickAuthor(a) {
  const u = a.author || a.author_info || a.user || {};
  const fs = u.follower_count ?? u.followerCount ?? u.fans ?? 0;
  return {
    id: String(u.uid || u.sec_uid || u.id || ''),
    nickname: u.nickname || u.nick_name || u.name || '抖音用户',
    fans: num(fs),
  };
}

function normalizeAweme(raw, index, dateKey) {
  const a = raw.aweme_info || raw.aweme || raw;
  const stats = pickStats(a);
  const v = a.video || {};
  const m = a.music || {};
  const title = a.desc || a.title || a.item_title || '';
  return {
    id: String(a.aweme_id || a.id || a.item_id || `dy_${dateKey}_${index}`),
    title,
    author: pickAuthor(a),
    stats,
    duration: Math.round(num(v.duration ?? a.duration ?? 0) / 1000) || 0,
    createTime: new Date(num(a.create_time ?? a.createTime) * 1000 || Date.now()).toISOString(),
    cover: (v.cover?.url_list || v.origin_cover?.url_list || [])[0] || '',
    url: a.share_url || (a.aweme_id ? `https://www.douyin.com/video/${a.aweme_id}` : ''),
    music: { title: m.title || '', author: m.author || '' },
    challenges: (a.cha_list || a.text_extra || [])
      .map((c) => c.cha_name || c.hashtag_name || c.tag_name)
      .filter(Boolean),
    source: 'douyin',
    raw: {},
  };
}

/** 通道 A：公开热榜视频（免签名）—— 抖音已关闭，保留探测以便接口恢复时可自动生效 */
async function fetchFromPublic(limit) {
  const json = await getJSON(HOT_VIDEO_URL);
  const list = json?.data?.word_list || json?.word_list || json?.data || [];
  const videos = [];
  for (const item of list) {
    const subs = item.video_list || item.aweme_list || [];
    for (const sub of subs) videos.push(sub);
    if (videos.length >= limit * 3) break;
  }
  if (!videos.length) {
    throw new Error('抖音公开视频榜已关闭（免签名通道无视频级数据），需配置第三方数据服务');
  }
  return videos;
}

const HOT_LABEL = { 1: '新', 2: '热', 3: '爆' };

/** 把不同结构的热搜数组统一成内部格式 */
function buildHotWords(list, limit, activeTime, channel) {
  return {
    words: list.slice(0, limit).map((w, i) => ({
      rank: i + 1,
      word: w.word || w.sentence || w.title || '',
      hotValue: num(w.hot_value ?? w.hotValue ?? w.hot ?? 0),
      label: Number(w.label) || 0,
      labelText: HOT_LABEL[Number(w.label)] || '',
      sentenceId: String(w.sentence_id || ''),
      url: w.link || (w.sentence_id ? `https://www.douyin.com/hot/${w.sentence_id}` : ''),
    })),
    total: list.length,
    source: 'douyin',
    channel,
    fetchedAt: new Date().toISOString(),
    activeTime: activeTime || '',
  };
}

/**
 * 真实热搜词榜：免 Key，是唯一能免费拿到的抖音真实数据。
 * 主通道（官方 iesdouyin）+ 备用通道（第三方镜像），任一可用即返回，
 * 避免单点失效导致报告里「今日热门话题」整段丢失。
 */
export async function fetchHotWords(opts = {}) {
  const limit = opts.limit || 20;
  const errors = [];

  try {
    const json = await getJSON(HOT_WORD_URL, { timeout: opts.timeout });
    const list = json?.word_list || json?.data?.word_list || [];
    if (Array.isArray(list) && list.length) {
      return buildHotWords(list, limit, json?.active_time || '', 'iesdouyin');
    }
    errors.push('主通道返回空列表');
  } catch (e) {
    errors.push(`主通道失败：${e.message}`);
  }

  try {
    const json = await getJSON(HOT_WORD_BACKUP_URL, { timeout: opts.timeout });
    const list = json?.data || json?.list || [];
    if (Array.isArray(list) && list.length) {
      const r = buildHotWords(list, limit, json?.data?.[0]?.active_time || '', 'mirror');
      r.warnings = [`主通道不可用，已降级备用镜像（${errors.join('；')}）`];
      return r;
    }
    errors.push('备用通道返回空列表');
  } catch (e) {
    errors.push(`备用通道失败：${e.message}`);
  }

  throw new Error(`热搜词全部通道失败：${errors.join('；')}`);
}

/** 通道 B：第三方 API */
async function fetchFromApi(limit) {
  const base = process.env.DOUYIN_API_BASE;
  const key = process.env.DOUYIN_API_KEY;
  if (!base) throw new Error('DOUYIN_API_BASE 未配置');
  const url = `${base.replace(/\/$/, '')}/billboard/videos?size=${limit}`;
  const json = await getJSON(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  const list = json?.data?.list || json?.data?.items || json?.data || [];
  if (!Array.isArray(list)) throw new Error('第三方 API 返回格式异常');
  return list;
}

export async function fetchTopVideos(opts = {}) {
  const limit = opts.limit || 10;
  const dateKey = opts.dateKey;
  const warnings = [];

  let rawList = null;
  let channel = 'public';
  try {
    if (process.env.DOUYIN_API_BASE) {
      channel = 'api';
      rawList = await fetchFromApi(limit);
    } else {
      rawList = await fetchFromPublic(limit);
    }
  } catch (e) {
    if (channel === 'api') {
      warnings.push(`第三方 API 失败：${e.message}，回退公开接口`);
      channel = 'public';
      rawList = await fetchFromPublic(limit);
    } else {
      throw e;
    }
  }

  let videos = (rawList || []).map((r, i) => normalizeAweme(r, i, dateKey)).filter((v) => v.title);
  if (!videos.length) throw new Error('抖音接口返回空榜单');

  const engage = (v) => v.stats.digg + v.stats.comment * 3 + v.stats.share * 4 + v.stats.collect * 2;
  videos.sort((a, b) =>
    opts.metric === 'engage' ? engage(b) - engage(a) : b.stats.play - a.stats.play
  );
  videos = videos.slice(0, limit);

  return { videos, source: 'douyin', channel, dateKey, metric: opts.metric || 'play', warnings };
}

export const name = 'douyin';
