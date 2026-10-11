/**
 * @boiling/core —— 沸点创意分析内核（零依赖）
 */
export * as providers from './providers/composite.js';
export * as providerDouyin from './providers/douyin.js';
export * as providerSimulated from './providers/simulated.js';
export * as analyzers from './analyzers/index.js';
export * as scoring from './analyzers/scoring.js';
export * as taxonomy from './taxonomy/taxonomy.js';
export * as store from './store/db.js';
export * as report from './report/generate.js';
export * as dateUtil from './utils/date.js';
export * as textUtil from './utils/text.js';

export { analyzeVideo, analyzeBatch } from './analyzers/index.js';
export { generateReport } from './report/generate.js';
export { exportTaxonomy, DIMENSIONS, ALL_TAGS, getTag } from './taxonomy/taxonomy.js';
export { runDaily } from './pipeline.js';
export { toDateKey, shiftDateKey } from './utils/date.js';
