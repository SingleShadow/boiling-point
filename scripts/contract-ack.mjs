/**
 * 契约同步确认 —— 「前端确认已按最新契约改完」的闸门。
 *
 * 默认（check）：比对 contracts/.ack 与契约版本，落后就以非 0 退出并提示看 CHANGELOG。
 * --ack：确认已同步，把当前版本写入 .ack。
 *
 * 用法：npm run contract:sync        # 检查（CI / 每日开工前）
 *       npm run contract:ack         # 确认已同步
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'contracts/api.json'), 'utf8'));
const ackPath = join(root, 'contracts/.ack');
const curVer = contract.version;
const isAck = process.argv.includes('--ack');

if (isAck) {
  writeFileSync(ackPath, JSON.stringify({
    version: curVer,
    ackedAt: new Date().toISOString(),
    ackedBy: '崔志帅（前端）',
  }, null, 2), 'utf8');
  console.log(`✓ 已确认同步到契约 ${curVer}`);
  process.exit(0);
}

let ack = null;
if (existsSync(ackPath)) {
  try { ack = JSON.parse(readFileSync(ackPath, 'utf8')); } catch { ack = null; }
}

if (!ack) {
  console.log('✗ 从未确认过契约同步。');
  console.log('  请先查看 contracts/CHANGELOG.md，改完前端后执行：npm run contract:ack');
  process.exit(1);
}

if (ack.version !== curVer) {
  console.log(`✗ 契约有更新：你确认的是 ${ack.version}，当前是 ${curVer}`);
  console.log('  请查看 contracts/CHANGELOG.md 的变更条目，改完前端后执行：npm run contract:ack');
  process.exit(1);
}

console.log(`✓ 前端已同步契约 ${curVer}（确认于 ${ack.ackedAt}）`);
