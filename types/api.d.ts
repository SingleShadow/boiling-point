// 本文件由 scripts/gen-types.mjs 自动生成，请勿手改。
// 契约版本：2026-10-13.1　生成时间：2026-10-12T19:07:25.711Z
// 契约变更后请重跑：npm run contract:types

/* ---------- 数据模型 ---------- */

export interface Health {
  service: string;
  version: string;
  time: string;
  today: string;
  dataMode: string;
  metric: string;
  topN: number;
  lastRunAt?: string;
  cronHour: number;
  stats: Stats;
  hasLiveKey: boolean;
}

export interface Stats {
  videos?: number;
  reports?: number;
  days?: number;
  subscribers?: number;
}

export interface AudienceInsight {
  avgBoilingScore: number;
  sampleSize: number;
  topTopics: TopicCount[];
  realHotWords?: string[];
}

export interface TopicCount {
  name: string;
  count: number;
}

export interface VideoEntry {
  id: string;
  title: string;
  author?: string;
  play: number;
  duration?: number;
  url?: string;
  tags?: Record<string, unknown>;
}

export interface Report {
  date: string;
  source: string;
  generatedAt?: string;
  audienceInsight?: AudienceInsight;
  entries?: VideoEntry[];
}

export interface TodayResponse {
  _generated: boolean;
  _warnings: string[];
}

export interface ReportListItem {
  date: string;
  createdAt: string;
  avgBoilingScore: number;
  topTopic: string;
  sampleSize: number;
}

export interface TagSeries {
  tagId: string;
  name: string;
  dimension: string;
  series: Record<string, unknown>[];
}

export interface FeatureHit {
  id: string;
  name: string;
  hit: boolean;
  rate?: number;
  hot?: boolean;
  tip?: string;
}

export interface SimilarTitle {
  title: string;
  play?: number;
  author?: string;
  url?: string;
}

export interface ScoreResult {
  score: number;
  grade: string;
  verdict: string;
  coverage?: number;
  length: Record<string, unknown>;
  features: FeatureHit[];
  suggestions: string[];
  similar?: SimilarTitle[];
  baseline?: Record<string, unknown>;
}

export interface Baseline {
  size: number;
  rate: Record<string, unknown>;
  length: Record<string, unknown>;
  fetchedAt: string;
  source: string;
}

export interface SubscribeResult {
  ok: boolean;
  created?: boolean;
  email?: string;
  total: number;
}

export interface SubscribersResult {
  total: number;
  items: Record<string, unknown>[];
}

export interface HotWord {
  word: string;
  hotValue?: number;
  label?: number;
}

export interface RunResult {
  date: string;
  source: string;
  count: number;
  warnings: string[];
  avgBoilingScore?: number;
}

export interface AgentStats {
  runs?: number;
  findings?: number;
  healthyRate?: number;
}

/* ---------- 端点请求 / 响应 ---------- */

export type HealthResponse = Health;

export interface TodayQuery {
  date?: string;
  force?: string;
}

export type TodayResponse = TodayResponse;

export interface ReportQuery {
  date?: string;
}

export type ReportResponse = Report | null;

export interface ReportsQuery {
  limit?: number;
}

export type ReportsResponse = ReportListItem[];

export interface VideosQuery {
  date?: string;
  limit?: number;
}

export type VideosResponse = VideoEntry[];

export type TagsResponse = Record<string, unknown>;

export interface TrendsQuery {
  days?: number;
  date?: string;
}

export type TrendsResponse = TagSeries[];

export interface RunsQuery {
  limit?: number;
}

export type RunsResponse = Record<string, unknown>[];

export type StatsResponse = Stats;

export interface RunBody {
  date?: string;
  limit?: number;
  metric?: string;
  mode?: string;
}

export type RunResponse = RunResult;

export interface ScoreTitleQuery {
  title: string;
}

export type ScoreTitleResponse = ScoreResult;

export type ScoreTitleBaselineResponse = Baseline;

export interface SubscribeBody {
  email: string;
  source?: string;
  note?: string;
}

export type SubscribeResponse = SubscribeResult;

export type SubscribersResponse = SubscribersResult;

export interface HotwordsQuery {
  limit?: number;
}

export type HotwordsResponse = HotWord[];

export interface AgentStatusQuery {
  date?: string;
}

export type AgentStatusResponse = Record<string, unknown>;

export interface AgentPlanQuery {
  date?: string;
  limit?: number;
}

export type AgentPlanResponse = Record<string, unknown>;

export interface AgentRunBody {
  dateKey?: string;
}

export type AgentRunResponse = Record<string, unknown>;

export interface AgentBriefQuery {
  date?: string;
}

export type AgentBriefResponse = Record<string, unknown>;

export interface AgentMemoryQuery {
  category?: string;
}

export type AgentMemoryResponse = Record<string, unknown>[];

export type AgentFindingsResponse = Record<string, unknown>[];

export interface AgentRunsQuery {
  limit?: number;
}

export type AgentRunsResponse = Record<string, unknown>[];

export type AgentStatsResponse = AgentStats;

export interface BackfillBody {
  days?: number;
}

export type BackfillResponse = Record<string, unknown>;

/* ---------- 端点总表（供封装 fetch 时使用） ---------- */

export interface ApiEndpoints {
  'GET /api/health': { response: HealthResponse };
  'GET /api/today': { query?: TodayQuery; response: TodayResponse };
  'GET /api/report': { query?: ReportQuery; response: ReportResponse };
  'GET /api/reports': { query?: ReportsQuery; response: ReportsResponse };
  'GET /api/videos': { query?: VideosQuery; response: VideosResponse };
  'GET /api/tags': { response: TagsResponse };
  'GET /api/trends': { query?: TrendsQuery; response: TrendsResponse };
  'GET /api/runs': { query?: RunsQuery; response: RunsResponse };
  'GET /api/stats': { response: StatsResponse };
  'POST /api/run': { body?: RunBody; response: RunResponse };
  'GET /api/score-title': { query?: ScoreTitleQuery; response: ScoreTitleResponse };
  'GET /api/score-title/baseline': { response: ScoreTitleBaselineResponse };
  'POST /api/subscribe': { body?: SubscribeBody; response: SubscribeResponse };
  'GET /api/subscribers': { response: SubscribersResponse };
  'GET /api/hotwords': { query?: HotwordsQuery; response: HotwordsResponse };
  'GET /api/agent/status': { query?: AgentStatusQuery; response: AgentStatusResponse };
  'GET /api/agent/plan': { query?: AgentPlanQuery; response: AgentPlanResponse };
  'POST /api/agent/run': { body?: AgentRunBody; response: AgentRunResponse };
  'GET /api/agent/brief': { query?: AgentBriefQuery; response: AgentBriefResponse };
  'GET /api/agent/memory': { query?: AgentMemoryQuery; response: AgentMemoryResponse };
  'GET /api/agent/findings': { response: AgentFindingsResponse };
  'GET /api/agent/runs': { query?: AgentRunsQuery; response: AgentRunsResponse };
  'GET /api/agent/stats': { response: AgentStatsResponse };
  'POST /api/backfill': { body?: BackfillBody; response: BackfillResponse };
}
