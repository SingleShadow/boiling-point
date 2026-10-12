/**
 * 从 packages/core/src/scorer/title.js 派生浏览器版 tools/title-score/engine.js。
 * title.js 是打分逻辑的单一真源（有 Node 测试守护）；engine.js 是它的浏览器镜像，
 * 去掉 export、挂到 globalThis.TitleEngine，保证纯前端零构建可运行。
 *
 * 用法：node scripts/gen-engine.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const titleSrc = readFileSync(`${ROOT}packages/core/src/scorer/title.js`, 'utf8');

const engineSrc =
  titleSrc
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'const ')
  + '\n/* 浏览器 / Node 通用入口（由 packages/core/src/scorer/title.js 派生，改动需同步） */\n'
  + 'globalThis.TitleEngine = { buildBaseline, scoreTitle, similarTitles, extractFeatures };\n';

writeFileSync(`${ROOT}tools/title-score/engine.js`, engineSrc, 'utf8');
console.log('engine.js 已重新生成（', engineSrc.length, '字节）');
