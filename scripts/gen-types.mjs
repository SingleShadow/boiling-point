/**
 * 契约 → TypeScript 类型（零依赖）。
 *
 * 生成物 types/api.d.ts 是前端唯一该引用的类型来源，**禁止手改**——
 * 契约变了就重跑本脚本，手改会在下次生成时被覆盖。
 *
 * 用法：node scripts/gen-types.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'contracts/api.json'), 'utf8'));
const models = contract.models || {};

const PRIM = {
  string: 'string', number: 'number', boolean: 'boolean',
  object: 'Record<string, unknown>', any: 'unknown', unknown: 'unknown', null: 'null',
};

/** 契约类型表达式 → TS 类型 + 是否可空 */
function tsType(expr, { allowNull = false } = {}) {
  const nullable = String(expr).endsWith('?');
  let base = nullable ? String(expr).slice(0, -1) : String(expr);
  let arr = false;
  if (base.endsWith('[]')) { arr = true; base = base.slice(0, -2); }
  let core = PRIM[base] || (models[base] ? base : 'unknown');
  if (arr) core = `${core}[]`;
  if (nullable && allowNull) core = `${core} | null`;
  return { core, optional: nullable };
}

const pascal = (s) => String(s).replace(/(^|[^a-zA-Z0-9])([a-z])/g, (_, sep, c) => c.toUpperCase());

const out = [];
out.push('// 本文件由 scripts/gen-types.mjs 自动生成，请勿手改。');
out.push(`// 契约版本：${contract.version}　生成时间：${new Date().toISOString()}`);
out.push('// 契约变更后请重跑：npm run contract:types');
out.push('');
out.push('/* ---------- 数据模型 ---------- */');
out.push('');

for (const [name, fields] of Object.entries(models)) {
  out.push(`export interface ${name} {`);
  for (const [fname, ftype] of Object.entries(fields)) {
    const { core, optional } = tsType(ftype);
    out.push(`  ${fname}${optional ? '?' : ''}: ${core};`);
  }
  out.push('}');
  out.push('');
}

out.push('/* ---------- 端点请求 / 响应 ---------- */');
out.push('');

const mapLines = [];
for (const ep of contract.endpoints || []) {
  const base = pascal(ep.id);
  const qp = Object.entries(ep.params || {}).filter(([, p]) => p.in === 'query');
  const bp = Object.entries(ep.params || {}).filter(([, p]) => p.in === 'body');

  if (qp.length) {
    out.push(`export interface ${base}Query {`);
    for (const [n, p] of qp) {
      const { core } = tsType(p.type);
      out.push(`  ${n}${p.required ? '' : '?'}: ${core};`);
    }
    out.push('}');
    out.push('');
  }
  if (bp.length) {
    out.push(`export interface ${base}Body {`);
    for (const [n, p] of bp) {
      const { core } = tsType(p.type);
      out.push(`  ${n}${p.required ? '' : '?'}: ${core};`);
    }
    out.push('}');
    out.push('');
  }

  const { core } = tsType(ep.response || 'unknown', { allowNull: true });
  out.push(`export type ${base}Response = ${core};`);
  out.push('');

  const parts = [];
  if (qp.length) parts.push(`query?: ${base}Query`);
  if (bp.length) parts.push(`body?: ${base}Body`);
  parts.push(`response: ${base}Response`);
  mapLines.push(`  '${ep.method} ${ep.path}': { ${parts.join('; ')} };`);
}

out.push('/* ---------- 端点总表（供封装 fetch 时使用） ---------- */');
out.push('');
out.push('export interface ApiEndpoints {');
out.push(...mapLines);
out.push('}');
out.push('');

const target = join(root, 'types/api.d.ts');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, out.join('\n'), 'utf8');
console.log(`✓ 已生成 ${target}（契约 ${contract.version}，${Object.keys(models).length} 个模型 / ${(contract.endpoints || []).length} 个端点）`);
