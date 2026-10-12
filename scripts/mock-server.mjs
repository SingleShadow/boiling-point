/**
 * 契约驱动的 mock 服务（零依赖，node:http）。
 *
 * 存在的意义：契约一冻结，前端就能立刻开工，不必等后端实现完。
 * 所有响应严格来自 contracts/fixtures.json —— 字段名与契约不一致会立刻暴露。
 *
 * 用法：npm run contract:mock   （默认 http://localhost:8788）
 *       MOCK_PORT=8790 node scripts/mock-server.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'contracts/api.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(join(root, 'contracts/fixtures.json'), 'utf8'));
const PORT = Number(process.env.MOCK_PORT || 8788);

const table = new Map();
for (const ep of contract.endpoints || []) {
  table.set(`${ep.method} ${ep.path}`, ep);
}

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method === 'OPTIONS' ? 'OPTIONS' : req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 索引
  if (u.pathname === '/' || u.pathname === '/_mock/endpoints') {
    res.writeHead(200);
    res.end(JSON.stringify({
      contractVersion: contract.version,
      endpoints: (contract.endpoints || []).map((e) => ({
        id: e.id, method: e.method, path: e.path, status: e.status, summary: e.summary,
        hasMock: e.id in fixtures,
      })),
    }, null, 2));
    return;
  }

  const ep = table.get(`${method} ${u.pathname}`);
  if (!ep) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'mock: 契约中不存在该端点', method, path: u.pathname }));
    return;
  }
  if (ep.status !== 'frozen') {
    res.writeHead(409);
    res.end(JSON.stringify({ error: `mock: 端点 ${ep.method} ${ep.path} 仍是 draft，未冻结前前端不得依赖` }));
    return;
  }
  if (!(ep.id in fixtures)) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: `mock: 端点 ${ep.id} 缺少 fixtures，请先补 contracts/fixtures.json` }));
    return;
  }

  res.writeHead(200);
  res.end(JSON.stringify(fixtures[ep.id]));
});

server.listen(PORT, () => {
  const frozen = (contract.endpoints || []).filter((e) => e.status === 'frozen').length;
  console.log(`mock 服务已启动：http://localhost:${PORT}`);
  console.log(`契约版本 ${contract.version}　frozen 端点 ${frozen} 个`);
  console.log(`查看全部端点： http://localhost:${PORT}/_mock/endpoints`);
});
