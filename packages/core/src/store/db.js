/**
 * SQLite 持久化（Node 22 内置 node:sqlite，零依赖）
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { nowISO } from '../utils/date.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source TEXT,
  metric TEXT,
  video_count INTEGER DEFAULT 0,
  status TEXT,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date_key);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  rank INTEGER,
  title TEXT,
  author TEXT,
  fans INTEGER DEFAULT 0,
  play INTEGER DEFAULT 0,
  digg INTEGER DEFAULT 0,
  comment INTEGER DEFAULT 0,
  share INTEGER DEFAULT 0,
  collect INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  url TEXT,
  music TEXT,
  challenges TEXT,
  source TEXT,
  boiling_score REAL DEFAULT 0,
  grade TEXT,
  headline TEXT,
  analysis TEXT,
  created_at TEXT,
  PRIMARY KEY (id, date_key)
);
CREATE INDEX IF NOT EXISTS idx_videos_date ON videos(date_key);

CREATE TABLE IF NOT EXISTS reports (
  date_key TEXT PRIMARY KEY,
  payload TEXT,
  markdown TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS tag_daily (
  date_key TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  name TEXT,
  dimension TEXT,
  count INTEGER DEFAULT 0,
  total_play INTEGER DEFAULT 0,
  avg_score REAL DEFAULT 0,
  PRIMARY KEY (date_key, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_tag_daily_tag ON tag_daily(tag_id);
`;

let _db = null;

export function getDb(dbPath) {
  if (_db) return _db;
  const path = dbPath || process.env.BOILING_DB || 'data/boiling.db';
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/* ---------------- runs ---------------- */

export function startRun(db, { dateKey, source, metric }) {
  const r = db.prepare(
    'INSERT INTO runs (date_key, started_at, finished_at, source, metric, status, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(dateKey, nowISO(), '', source || '', metric || '', 'running', '');
  return Number(r.lastInsertRowid);
}

export function finishRun(db, id, { videoCount, status = 'ok', message = '' }) {
  db.prepare('UPDATE runs SET finished_at=?, video_count=?, status=?, message=? WHERE id=?')
    .run(nowISO(), videoCount || 0, status, message, id);
}

export function listRuns(db, limit = 20) {
  return db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit);
}

/* ---------------- videos ---------------- */

export function saveDailyVideos(db, dateKey, entries) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO videos
    (id, date_key, rank, title, author, fans, play, digg, comment, share, collect,
     duration, url, music, challenges, source, boiling_score, grade, headline, analysis, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const e of entries) {
    const v = e.video;
    stmt.run(
      v.id, dateKey, e.rank, v.title, v.author?.nickname || '', v.author?.fans || 0,
      v.stats.play || 0, v.stats.digg || 0, v.stats.comment || 0, v.stats.share || 0, v.stats.collect || 0,
      v.duration || 0, v.url || '', v.music?.title || '', (v.challenges || []).join(','), v.source || '',
      e.boilingScore || 0, e.grade?.level || '', e.analysis?.headline || '',
      JSON.stringify(e.analysis || {}), nowISO()
    );
  }
}

export function getDayVideos(db, dateKey) {
  return db.prepare('SELECT * FROM videos WHERE date_key=? ORDER BY rank ASC').all(dateKey)
    .map((row) => ({
      ...row,
      challenges: row.challenges ? String(row.challenges).split(',').filter(Boolean) : [],
      analysis: safeJson(row.analysis),
    }));
}

export function getLatestDateKey(db) {
  const r = db.prepare('SELECT date_key FROM reports ORDER BY date_key DESC LIMIT 1').get();
  if (r) return r.date_key;
  const v = db.prepare('SELECT date_key FROM videos ORDER BY date_key DESC LIMIT 1').get();
  return v ? v.date_key : null;
}

/* ---------------- reports ---------------- */

export function saveReport(db, report) {
  db.prepare('INSERT OR REPLACE INTO reports (date_key, payload, markdown, created_at) VALUES (?,?,?,?)')
    .run(report.date, JSON.stringify(report), report.markdown || '', nowISO());
}

export function getReport(db, dateKey) {
  const r = db.prepare('SELECT * FROM reports WHERE date_key=?').get(dateKey);
  if (!r) return null;
  return { ...safeJson(r.payload), markdown: r.markdown, createdAt: r.created_at };
}

export function listReports(db, limit = 30) {
  return db.prepare('SELECT date_key, created_at FROM reports ORDER BY date_key DESC LIMIT ?').all(limit);
}

/* ---------------- tag_daily ---------------- */

export function saveTagDaily(db, dateKey, tagStats) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO tag_daily (date_key, tag_id, name, dimension, count, total_play, avg_score) VALUES (?,?,?,?,?,?,?)'
  );
  for (const t of tagStats) {
    stmt.run(dateKey, t.tagId, t.name, t.dimension, t.count, t.totalPlay, t.avgScore || 0);
  }
}

export function getTagTrend(db, tagId, days = 7) {
  return db.prepare(
    'SELECT date_key, count, total_play, avg_score FROM tag_daily WHERE tag_id=? ORDER BY date_key DESC LIMIT ?'
  ).all(tagId, days).reverse();
}

export function getDayTags(db, dateKey) {
  return db.prepare('SELECT * FROM tag_daily WHERE date_key=? ORDER BY count DESC, total_play DESC').all(dateKey);
}

/* ---------------- stats ---------------- */

export function getStats(db) {
  const days = db.prepare('SELECT COUNT(DISTINCT date_key) AS c FROM videos').get()?.c || 0;
  const videos = db.prepare('SELECT COUNT(*) AS c FROM videos').get()?.c || 0;
  const reports = db.prepare('SELECT COUNT(*) AS c FROM reports').get()?.c || 0;
  const runs = db.prepare('SELECT COUNT(*) AS c FROM runs').get()?.c || 0;
  const last = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get() || null;
  return { days, videos, reports, runs, lastRun: last };
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
