/**
 * 零依赖 .env 加载器。
 *
 * 背景：README / DATA_SOURCING.md 一直写着「复制 .env.example 为 .env 填配置即可」，
 * 但代码里从来没有 .env 解析 —— 文档承诺的能力根本不存在，配了也不生效。
 * 这里用 Node 内置模块实现，不引入 dotenv，保持内核零第三方依赖。
 *
 * 规则：
 *   1. 只补齐 process.env 里**不存在**的变量（命令行与系统环境变量优先级更高）
 *   2. 支持 # 注释、export 前缀、单双引号包裹、行尾空白与 BOM
 *   3. 从 cwd 向上最多找 4 层，保证子目录里跑 CLI 也能找到项目根的 .env
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MAX_UP = 4;

export function findEnvFile(cwd = process.cwd()) {
  let dir = resolve(cwd);
  for (let i = 0; i < MAX_UP; i += 1) {
    const p = join(dir, '.env');
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** 解析 .env 文本为键值对象 */
export function parseEnv(text) {
  const out = {};
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const m = s.match(/^(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // 成对引号：整体去引号；未加引号：截掉行尾注释
    const q = v.match(/^(['"])([\s\S]*)\1$/);
    if (q) v = q[2];
    else v = v.split(/\s+#/)[0].trim();
    out[m[1]] = v;
  }
  return out;
}

/**
 * 载入 .env 到 process.env（不覆盖已有值）。
 * @returns {{ file: string|null, loaded: string[], skipped: string[] }}
 */
export function loadEnv(cwd = process.cwd()) {
  const file = findEnvFile(cwd);
  if (!file) return { file: null, loaded: [], skipped: [] };
  const kv = parseEnv(readFileSync(file, 'utf8'));
  const loaded = [];
  const skipped = [];
  for (const [k, v] of Object.entries(kv)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
      loaded.push(k);
    } else {
      skipped.push(k);
    }
  }
  return { file, loaded, skipped };
}

export default loadEnv;
