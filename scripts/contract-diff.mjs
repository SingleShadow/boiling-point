/**
 * 契约变更 diff —— 「变更能及时同步给前端」的执行者。
 *
 * 每次改契约后必须跑：它会与上一版归档对比，判定 BREAKING / 兼容变更，
 * 并追加到 contracts/CHANGELOG.md，同时把当前版本归档。
 * 有 BREAKING 变更时前端必须重新 ack（npm run contract:ack）才能继续。
 *
 * 用法：npm run contract:diff
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const archiveDir = join(root, 'contracts/archive');
const changelogPath = join(root, 'contracts/CHANGELOG.md');
const current = JSON.parse(readFileSync(join(root, 'contracts/api.json'), 'utf8'));
const curVer = current.version;

mkdirSync(archiveDir, { recursive: true });

const key = (e) => `${e.method} ${e.path}`;
const toMap = (list) => new Map((list || []).map((e) => [key(e), e]));

function latestArchive() {
  if (!existsSync(archiveDir)) return null;
  const files = readdirSync(archiveDir).filter((f) => f.endsWith('.json')).sort();
  return files.length ? join(archiveDir, files[files.length - 1]) : null;
}

function writeChangelog(entry) {
  const head = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf8')
    : '# API 契约变更记录\n\n> 由 scripts/contract-diff.mjs 自动生成。前端开工前必须确认已同步到最新版本。\n';
  writeFileSync(changelogPath, head + '\n' + entry, 'utf8');
}

function archive() {
  writeFileSync(join(archiveDir, `api-${curVer}.json`), JSON.stringify(current, null, 2), 'utf8');
}

const prevPath = latestArchive();

if (!prevPath) {
  archive();
  writeChangelog([
    `## ${curVer} · ${new Date().toISOString().slice(0, 10)}`,
    '',
    '初始版本：由现有实现反推生成，字段精度由阿服逐条确认后冻结。',
    '',
    `端点 ${(current.endpoints || []).length} 个，全部标记为 frozen（已实现且稳定）。`,
  ].join('\n'));
  console.log(`✓ 无历史归档，已建立基线版本 ${curVer} 并写入 CHANGELOG`);
  process.exit(0);
}

const prev = JSON.parse(readFileSync(prevPath, 'utf8'));
const prevMap = toMap(prev.endpoints);
const curMap = toMap(current.endpoints);

const breaking = [];
const compatible = [];

for (const [k, ep] of curMap) {
  const old = prevMap.get(k);
  if (!old) { compatible.push(`新增端点 ${k}（status=${ep.status}）`); continue; }

  if (old.status !== ep.status) {
    const line = `${k} 状态 ${old.status} → ${ep.status}`;
    (ep.status === 'draft' ? breaking : compatible).push(line);
  }
  if (old.response !== ep.response) {
    breaking.push(`${k} 响应类型变更：${old.response} → ${ep.response}`);
  }
  const op = Object.keys(old.params || {});
  const np = Object.keys(ep.params || {});
  for (const p of op) {
    if (!np.includes(p)) breaking.push(`${k} 删除参数 ${p}`);
    else if (String(old.params[p].type) !== String(ep.params[p].type)) {
      breaking.push(`${k} 参数 ${p} 类型变更：${old.params[p].type} → ${ep.params[p].type}`);
    }
  }
  for (const p of np) {
    if (!op.includes(p)) {
      const line = `${k} 新增参数 ${p}`;
      (ep.params[p].required ? breaking : compatible).push(line);
    }
  }
}

for (const [k] of prevMap) {
  if (!curMap.has(k)) breaking.push(`删除端点 ${k}`);
}

const lines = [];
lines.push(`## ${curVer} · ${new Date().toISOString().slice(0, 10)}`);
lines.push('');
lines.push(`对比基线：${prev.version ?? prevPath.split(/[\\/]/).pop()}`);
lines.push('');
if (breaking.length) {
  lines.push('### ⚠ BREAKING（前端必须改代码）');
  breaking.forEach((b) => lines.push(`- ${b}`));
  lines.push('');
}
if (compatible.length) {
  lines.push('### 兼容变更');
  compatible.forEach((c) => lines.push(`- ${c}`));
  lines.push('');
}
if (!breaking.length && !compatible.length) {
  lines.push('无端点级变更（可能只是描述或版本调整）。');
  lines.push('');
}

writeChangelog(lines.join('\n'));
archive();

console.log(`契约 ${prev.version ?? '?'} → ${curVer}`);
console.log(`BREAKING ${breaking.length} 条 / 兼容 ${compatible.length} 条`);
breaking.forEach((b) => console.log('  ⚠ ' + b));
compatible.forEach((c) => console.log('  · ' + c));
console.log(`\n已追加 contracts/CHANGELOG.md 并归档 api-${curVer}.json`);
if (breaking.length) {
  console.log('\n有 BREAKING 变更：前端需改完后执行 npm run contract:ack 确认同步。');
  process.exit(2);
}
