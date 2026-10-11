// 统一 API 封装：始终使用相对路径 /api/...（开发态由 umi proxy 转发，生产态后端同域挂载）
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = (await res.json()) as ApiResult<T>;
  if (!json.ok) {
    throw new Error(json.error?.message || '请求失败');
  }
  return json.data as T;
}

export interface StatsObj {
  play: number;
  digg: number;
  comment: number;
  share: number;
  collect: number;
}
export interface Grade {
  level: 'S' | 'A' | 'B' | 'C';
  label: string;
}
export interface TagItem {
  id: string;
  name: string;
  dimension?: string;
  confidence?: number;
  matched?: string[];
  desc?: string;
  keywords?: string[];
  group?: string;
}
export interface DimensionBlock {
  tags: TagItem[];
  summary: string;
  primary?: { id: string; name: string };
  metrics?: Record<string, any>;
}
export interface TopItem {
  rank: number;
  id: string;
  title: string;
  author: string;
  fans: number;
  duration: number;
  url: string;
  music: { title: string; author: string };
  challenges: string[];
  stats: StatsObj;
  boilingScore: number;
  grade: Grade;
  headline: string;
  dimensions: {
    topic: DimensionBlock;
    copy: DimensionBlock;
    rhythm: DimensionBlock;
    craft: DimensionBlock;
  };
  allTags: TagItem[];
  summary: { topic: string; copy: string; rhythm: string; craft: string };
}

export interface DistributionItem {
  name: string;
  count: number;
  share: number;
  totalPlay?: number;
  avgScore?: number;
}
export interface TagFrequency {
  tagId: string;
  name: string;
  dimension: string;
  count: number;
  totalPlay: number;
  scores?: number[];
  avgScore: number;
  prevCount: number;
  delta: number;
  isNew: boolean;
}
export interface Direction {
  no: number;
  title: string;
  topic: string;
  hookTemplate: string;
  angle: string;
  durationAdvice: string;
  craftAdvice: string;
  ctaAdvice: string;
  whyHot: string;
}
export interface AudienceInsight {
  sampleSize: number;
  totalPlay: number;
  topTopics: DistributionItem[];
  hotTopics: { name: string; count: number }[];
  preferredDuration: string;
  preferredHooks: string[];
  preferredForm: string;
  emotionBias: string;
  avgBoilingScore: number;
  summaryText: string;
}
export interface Report {
  date: string;
  generatedAt: string;
  source: 'simulated' | 'douyin';
  top10: TopItem[];
  distribution: {
    topic: DistributionItem[];
    duration: DistributionItem[];
    emotion: DistributionItem[];
    form: DistributionItem[];
    hook: DistributionItem[];
  };
  tagFrequencies: TagFrequency[];
  rising: any[];
  falling: any[];
  audienceInsight: AudienceInsight;
  directions: Direction[];
  markdown: string;
}

export const api = {
  health: () => request<any>('/health'),
  today: (date?: string) =>
    request<Report>(`/today${date ? `?date=${date}` : ''}`),
  report: (date: string) => request<Report>(`/report?date=${date}`),
  reports: (limit = 30) => request<any[]>(`/reports?limit=${limit}`),
  tags: () =>
    request<{ dimensions: any[]; groups: any[]; total: number }>('/tags'),
  trends: (days = 7) => request<any[]>(`/trends?days=${days}`),
  stats: () => request<any>('/stats'),
  backfill: (days: number) =>
    request<any>('/backfill', {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),
};
