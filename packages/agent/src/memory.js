/**
 * Agent 记忆层 —— 短期运行日志 + 长期知识沉淀
 *
 * 三张表：
 *   agent_runs     每次值守的完整档案（计划、动作、质检分、问题）
 *   agent_findings 发现的问题/洞察（按 severity 归档，供 CEO 简报消费）
 *   agent_memory   长期记忆（key-value，带置信度与命中次数，可跨天演进）
 */
import { nowISO, toDateKey } from '../../core/src/utils/date.js';

const AGENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT,
  health_score REAL DEFAULT 0,
  grade TEXT,
  source TEXT,
  sample_size INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  observation TEXT,
  plan TEXT,
  actions TEXT,
  issues TEXT,
  brief TEXT,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_date ON agent_runs(date_key);

CREATE TABLE IF NOT EXISTS agent_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_key TEXT NOT NULL,
  category TEXT,
  severity TEXT,
  title TEXT,
  detail TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_findings_date ON agent_findings(date_key);

CREATE TABLE IF NOT EXISTS agent_memory (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT,
  confidence REAL DEFAULT 0.5,
  hits INTEGER DEFAULT 0,
  updated_at TEXT
);
`;

export function ensureAgentSchema(db) {
  db.exec(AGENT_SCHEMA);
  return db;
}

/* ---------------- 长期记忆 ---------------- */

/**
 * 写入/更新一条长期记忆。
 * confidence 采用向新证据滑动的方式融合：新值权重 0.4，旧值 0.6。
 */
export function remember(db, { key, value, category = 'general', confidence = 0.6 }) {
  const old = db.prepare('SELECT * FROM agent_memory WHERE key=?').get(key);
  const merged = old ? Math.round((old.confidence * 0.6 + confidence * 0.4) * 100) / 100 : confidence;
  db.prepare(
    'INSERT INTO agent_memory (key, value, category, confidence, hits, updated_at) VALUES (?,?,?,?,?,?) ' +
    'ON CONFLICT(key) DO UPDATE SET value=excluded.value, category=excluded.category, ' +
    'confidence=excluded.confidence, hits=agent_memory.hits+1, updated_at=excluded.updated_at'
  ).run(key, JSON.stringify(value), category, merged, old ? old.hits + 1 : 1, nowISO());
  return { key, confidence: merged, hits: old ? old.hits + 1 : 1 };
}

export function recall(db, key) {
  const r = db.prepare('SELECT * FROM agent_memory WHERE key=?').get(key);
  if (!r) return null;
  let value = r.value;
  try { value = JSON.parse(r.value); } catch { /* 保持原字符串 */ }
  return { key: r.key, value, category: r.category, confidence: r.confidence, hits: r.hits, updatedAt: r.updated_at };
}

export function listMemory(db, category) {
  const rows = category
    ? db.prepare('SELECT * FROM agent_memory WHERE category=? ORDER BY updated_at DESC').all(category)
    : db.prepare('SELECT * FROM agent_memory ORDER BY updated_at DESC').all();
  return rows.map((r) => {
    let value = r.value;
    try { value = JSON.parse(r.value); } catch { /* 保持原字符串 */ }
    return { key: r.key, value, category: r.category, confidence: r.confidence, hits: r.hits, updatedAt: r.updated_at };
  });
}

export function forget(db, key) {
  db.prepare('DELETE FROM agent_memory WHERE key=?').run(key);
}

/* ---------------- 运行档案 ---------------- */

export function startAgentRun(db, { dateKey }) {
  const r = db.prepare(
    'INSERT INTO agent_runs (date_key, started_at, status, message) VALUES (?,?,?,?)'
  ).run(dateKey, nowISO(), 'running', '');
  return Number(r.lastInsertRowid);
}

export function finishAgentRun(db, id, payload) {
  db.prepare(
    'UPDATE agent_runs SET finished_at=?, status=?, health_score=?, grade=?, source=?, sample_size=?, ' +
    'duration_ms=?, observation=?, plan=?, actions=?, issues=?, brief=?, message=? WHERE id=?'
  ).run(
    nowISO(),
    payload.status,
    payload.healthScore || 0,
    payload.grade || '',
    payload.source || '',
    payload.sampleSize || 0,
    payload.durationMs || 0,
    JSON.stringify(payload.observation || {}),
    JSON.stringify(payload.plan || {}),
    JSON.stringify(payload.actions || []),
    JSON.stringify(payload.issues || []),
    JSON.stringify(payload.brief || {}),
    payload.message || '',
    id
  );
}

export function listAgentRuns(db, limit = 10) {
  return db.prepare('SELECT * FROM agent_runs ORDER BY id DESC LIMIT ?').all(limit).map(hydrateRun);
}

export function getAgentRun(db, id) {
  const r = db.prepare('SELECT * FROM agent_runs WHERE id=?').get(id);
  return r ? hydrateRun(r) : null;
}

export function latestAgentRun(db, dateKey) {
  const r = dateKey
    ? db.prepare('SELECT * FROM agent_runs WHERE date_key=? ORDER BY id DESC LIMIT 1').get(dateKey)
    : db.prepare('SELECT * FROM agent_runs ORDER BY id DESC LIMIT 1').get();
  return r ? hydrateRun(r) : null;
}

function hydrateRun(row) {
  const j = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
  return {
    id: row.id,
    dateKey: row.date_key,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    healthScore: row.health_score,
    grade: row.grade,
    source: row.source,
    sampleSize: row.sample_size,
    durationMs: row.duration_ms,
    observation: j(row.observation, {}),
    plan: j(row.plan, {}),
    actions: j(row.actions, []),
    issues: j(row.issues, []),
    brief: j(row.brief, {}),
    message: row.message,
  };
}

/* ---------------- 发现与洞察 ---------------- */

export function addFinding(db, { dateKey, category = 'general', severity = 'info', title, detail = '' }) {
  db.prepare(
    'INSERT INTO agent_findings (date_key, category, severity, title, detail, created_at) VALUES (?,?,?,?,?,?)'
  ).run(dateKey || toDateKey(), category, severity, title, detail, nowISO());
}

export function listFindings(db, { limit = 20, dateKey, minSeverity } = {}) {
  const order = { info: 0, warn: 1, error: 2, critical: 3 };
  let rows;
  if (dateKey) {
    rows = db.prepare('SELECT * FROM agent_findings WHERE date_key=? ORDER BY id DESC LIMIT ?').all(dateKey, limit);
  } else {
    rows = db.prepare('SELECT * FROM agent_findings ORDER BY id DESC LIMIT ?').all(limit);
  }
  const floor = minSeverity ? (order[minSeverity] ?? 0) : 0;
  return rows
    .filter((r) => (order[r.severity] ?? 0) >= floor)
    .map((r) => ({
      id: r.id, dateKey: r.date_key, category: r.category,
      severity: r.severity, title: r.title, detail: r.detail, createdAt: r.created_at,
    }));
}

/* ---------------- KPI ---------------- */

export function getAgentStats(db) {
  const total = db.prepare('SELECT COUNT(*) AS c FROM agent_runs').get()?.c || 0;
  const okCount = db.prepare("SELECT COUNT(*) AS c FROM agent_runs WHERE status IN ('ok','degraded')").get()?.c || 0;
  const avgRow = db.prepare('SELECT AVG(health_score) AS a FROM agent_runs WHERE health_score>0').get();
  const recent = db.prepare('SELECT health_score, date_key, status FROM agent_runs ORDER BY id DESC LIMIT 7').all();
  const findings = db.prepare('SELECT COUNT(*) AS c FROM agent_findings').get()?.c || 0;
  const openIssues = db.prepare("SELECT COUNT(*) AS c FROM agent_findings WHERE severity IN ('error','critical')").get()?.c || 0;
  return {
    total,
    successRate: total ? Math.round((okCount / total) * 100) : 0,
    avgHealthScore: avgRow?.a ? Math.round(avgRow.a * 10) / 10 : 0,
    recent: recent.reverse(),
    findings,
    openIssues,
    memoryCount: db.prepare('SELECT COUNT(*) AS c FROM agent_memory').get()?.c || 0,
  };
}
