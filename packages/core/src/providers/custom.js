/**
 * 自定义数据源适配器 —— 接第三方数据服务 / 自建采集服务的通用口子
 *
 * 设计目标：把「接一个数据源」从写代码变成填配置。
 * 只要对方能吐 JSON，就能通过环境变量映射进来，不需要改一行业务代码。
 *
 * 必填：
 *   CUSTOM_API_URL        数据源地址（GET/POST 均可）
 * 选填：
 *   CUSTOM_API_METHOD     GET（默认）| POST
 *   CUSTOM_API_KEY        Bearer Token
 *   CUSTOM_API_HEADERS    额外请求头，JSON 字符串，如 {"X-App-Id":"123"}
 *   CUSTOM_API_BODY       POST 请求体模板，JSON 字符串；支持 {{limit}} {{date}} 占位符
 *   CUSTOM_API_LIST_PATH  列表所在路径，默认 data.list，支持 a.b.c
 *   CUSTOM_API_MAP        字段映射，JSON 字符串（见 DEFAULT_MAP）
 *   CUSTOM_DURATION_UNIT  时长单位 ms（默认）| s
 *   CUSTOM_API_TIMEOUT_MS 超时，默认 8000
 *   CUSTOM_PLATFORM       平台标识 douyin（默认）| bilibili，决定时长分档与哪些节奏指标成立
 */

import { detectPlatform, mapCategory } from '../platform.js';

const DEFAULT_MAP = {
  id: 'aweme_id',
  title: 'desc',
  duration: 'duration',
  play: 'statistics.play_count',
  digg: 'statistics.digg_count',
  comment: 'statistics.comment_count',
  share: 'statistics.share_count',
  collect: 'statistics.collect_count',
  author: 'author.nickname',
  fans: 'author.follower_count',
  url: 'share_url',
  music: 'music.title',
  challenges: 'text_extra[].cha_name',
  createTime: 'create_time',
  /** 数据源自带的类目（B站分区 tname 等），是比标题猜词更可靠的题材信号 */
  category: 'tname',
  /** 简介/描述，用于提取话题与补充文案信号 */
  desc: 'desc',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** 按 a.b.c 取嵌套值；支持 arr[].field 取对象数组某字段组成的新数组 */
export function getPath(obj, path) {
  if (!path) return undefined;
  const m = path.match(/^(.*?)\[\]\.(.+)$/);
  if (m) {
    const arr = getPath(obj, m[1]);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => getPath(x, m[2])).filter((v) => v !== undefined && v !== null && v !== '');
  }
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 认证头。国内云市场（阿里云/京东万象/腾讯云）普遍用 APPCODE 而非 Bearer，
 * 原来写死 Bearer 导致这类源直接接不进来。
 *   CUSTOM_API_AUTH = bearer（默认）| appcode | raw | none
 */
function authHeaders() {
  const key = process.env.CUSTOM_API_KEY;
  if (!key) return {};
  switch ((process.env.CUSTOM_API_AUTH || 'bearer').toLowerCase()) {
    case 'appcode': // 阿里云市场：Authorization: APPCODE <AppCode>
      return { Authorization: `APPCODE ${key}` };
    case 'raw': // 对方要求完整的 Authorization 值，如 "ApiKey xxxx"
      return { Authorization: key };
    case 'none': // 凭据走 query 或自定义 header
      return {};
    default:
      return { Authorization: `Bearer ${key}` };
  }
}

function buildRequest(limit, dateKey) {
  const rawUrl = process.env.CUSTOM_API_URL;
  const method = (process.env.CUSTOM_API_METHOD || 'GET').toUpperCase();
  const fill = (s) => String(s).replace(/\{\{limit\}\}/g, limit).replace(/\{\{date\}\}/g, dateKey);
  return {
    url: fill(rawUrl).replace(/\{\{(limit|date)\}\}/g, ''),
    method,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...authHeaders(),
      ...safeJson(process.env.CUSTOM_API_HEADERS, {}),
    },
    body: method === 'POST' ? fill(process.env.CUSTOM_API_BODY || '{"size":{{limit}},"date":"{{date}}"}') : undefined,
  };
}

function safeJson(s, fallback) {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function normalize(raw, index, dateKey, map, platformId = 'douyin') {
  const challenges = getPath(raw, map.challenges) || [];
  const category = String(getPath(raw, map.category) || '');
  const desc = String(getPath(raw, map.desc) || '');
  // 分区 → 内部标签提示。topic.js / craft.js 早已预留 raw.topicHint / raw.craftHint 接口，这里填上即可。
  const hints = mapCategory(platformId, category);
  const durationRaw = num(getPath(raw, map.duration));
  const unit = (process.env.CUSTOM_DURATION_UNIT || 'ms').toLowerCase();
  const durationSec = unit === 's' ? durationRaw : Math.round(durationRaw / 1000);
  const ct = num(getPath(raw, map.createTime));
  const id = String(getPath(raw, map.id) || `custom_${dateKey}_${index}`);
  return {
    id,
    title: String(getPath(raw, map.title) || ''),
    author: {
      id: '',
      nickname: String(getPath(raw, map.author) || '未知作者'),
      fans: num(getPath(raw, map.fans)),
    },
    stats: {
      play: num(getPath(raw, map.play)),
      digg: num(getPath(raw, map.digg)),
      comment: num(getPath(raw, map.comment)),
      share: num(getPath(raw, map.share)),
      collect: num(getPath(raw, map.collect)),
    },
    duration: durationSec,
    createTime: new Date((ct > 1e12 ? ct : ct * 1000) || Date.now()).toISOString(),
    cover: '',
    url: String(getPath(raw, map.url) || ''),
    music: { title: String(getPath(raw, map.music) || ''), author: '' },
    challenges: Array.isArray(challenges) ? challenges.map(String) : [],
    /** 数据源自带类目（B站分区），前端可直接展示真实分区 */
    category,
    desc,
    /** 平台决定时长分档与哪些节奏指标成立 */
    platform: platformId,
    source: 'custom',
    raw: { category, topicHint: hints.topicHint, craftHint: hints.craftHint },
  };
}

export function isConfigured() {
  return Boolean(process.env.CUSTOM_API_URL);
}

export async function fetchTopVideos(opts = {}) {
  if (!isConfigured()) throw new Error('CUSTOM_API_URL 未配置');
  const limit = opts.limit || 10;
  const dateKey = opts.dateKey || '';
  const timeout = Number(process.env.CUSTOM_API_TIMEOUT_MS || 8000);

  const map = { ...DEFAULT_MAP, ...safeJson(process.env.CUSTOM_API_MAP, {}) };
  const platformId = detectPlatform(process.env.CUSTOM_API_URL || '', process.env.CUSTOM_PLATFORM || '');
  const req = buildRequest(limit, dateKey);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  let json;
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const listPath = process.env.CUSTOM_API_LIST_PATH || 'data.list';
  const list = getPath(json, listPath) ?? getPath(json, 'data') ?? json;
  if (!Array.isArray(list)) throw new Error(`列表路径 ${listPath} 未取到数组`);

  let videos = list.map((r, i) => normalize(r, i, dateKey, map, platformId)).filter((v) => v.title);
  if (!videos.length) throw new Error('自定义数据源返回空榜单');

  const engage = (v) => v.stats.digg + v.stats.comment * 3 + v.stats.share * 4 + v.stats.collect * 2;
  videos.sort((a, b) => (opts.metric === 'engage' ? engage(b) - engage(a) : b.stats.play - a.stats.play));
  videos = videos.slice(0, limit);

  // 字段映射体检：接数据商最常见的失败是「通了但字段没对上」，静默产出全 0 的废数据
  const warnings = [];
  if (videos.every((v) => v.stats.play === 0)) {
    warnings.push(`播放量全为 0，请检查 CUSTOM_API_MAP.play 映射（当前取 "${map.play}"），或该接口返回的是话题榜而非视频榜`);
  }
  if (videos.every((v) => v.duration === 0)) {
    warnings.push(`时长全为 0，请检查 duration 映射（当前取 "${map.duration}"）或设置 CUSTOM_DURATION_UNIT=s`);
  }
  // B站等平台本来就没有 challenges 字段（话题在简介里用 #xx# 表示），此时不告警，避免误导排查方向
  if (videos.every((v) => !v.challenges.length) && platformId !== 'bilibili') {
    warnings.push(`话题全为空，请检查 challenges 映射（当前取 "${map.challenges}"）`);
  }

  return {
    videos,
    source: 'custom',
    channel: 'custom',
    platform: platformId,
    dateKey,
    metric: opts.metric || 'play',
    warnings,
  };
}

export const name = 'custom';
