/**
 * 契约校验 —— 前端开工的硬门禁。
 *
 * 任何一条 error 都会让命令以非 0 退出，可挂进 CI / pre-commit。
 * 核心规则：status=frozen 的端点必须「字段齐 + 有 mock」，否则前端不许开工。
 *
 * 用法：node scripts/contract-check.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIM = new Set(['string', 'number', 'boolean', 'object', 'any', 'unknown', 'null']);

const contract = JSON.parse(readFileSync(join(root, 'contracts/api.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(join(root, 'contracts/fixtures.json'), 'utf8'));

const errors = [];
const warns = [];

if (!contract.version) errors.push('契约缺少 version');

const seen = new Set();
for (const ep of contract.endpoints || []) {
  const tag = `${ep.method} ${ep.path}`;
  if (!ep.id) errors.push(`端点 ${tag} 缺少 id`);
  if (seen.has(tag)) errors.push(`重复端点：${tag}`);
  seen.add(tag);

  if (!['draft', 'frozen'].includes(ep.status)) {
    errors.push(`端点 ${tag} 的 status 非法：${ep.status}（只能是 draft 或 frozen）`);
  }
  if (!ep.summary) errors.push(`端点 ${tag} 缺少 summary`);
  if (!ep.response) errors.push(`端点 ${tag} 缺少 response`);
  if (!Array.isArray(ep.errors) || ep.errors.length === 0) {
    errors.push(`端点 ${tag} 缺少 errors（前端需要知道有哪些错误码）`);
  }

  // 引用的模型必须已定义
  const base = String(ep.response || '').replace(/\?$/, '').replace(/\[\]$/, '');
  if (base && !PRIM.has(base) && !(contract.models || {})[base]) {
    warns.push(`端点 ${tag} 的 response 引用了未定义模型：${base}`);
  }

  // frozen 必须有 mock —— 这是前端能独立于后端开发的前提
  if (ep.status === 'frozen' && !(ep.id in fixtures)) {
    errors.push(`frozen 端点 ${tag} 在 fixtures.json 里没有 mock 数据（前端无法开工）`);
  }

  // 参数必须声明 in / type
  for (const [name, p] of Object.entries(ep.params || {})) {
    if (!['query', 'body', 'path'].includes(p.in)) {
      errors.push(`端点 ${tag} 的参数 ${name} 的 in 非法：${p.in}`);
    }
    const t = String(p.type || '').replace(/\?$/, '');
    if (!PRIM.has(t)) warns.push(`端点 ${tag} 的参数 ${name} 类型未在白名单：${p.type}`);
  }
}

const frozen = (contract.endpoints || []).filter((e) => e.status === 'frozen').length;
const draft = (contract.endpoints || []).filter((e) => e.status === 'draft').length;

console.log(`契约版本：${contract.version}`);
console.log(`端点总数：${(contract.endpoints || []).length}（frozen ${frozen} / draft ${draft}）`);
if (warns.length) {
  console.log('\n警告：');
  warns.forEach((w) => console.log('  ⚠ ' + w));
}
if (errors.length) {
  console.log('\n不通过（前端不得开工）：');
  errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('\n✓ 契约校验通过，frozen 端点均可开工（含 mock）');
