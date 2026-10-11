# 沸点创意 — 实施计划

> Superpowers Phase 3 · 每个任务 2–5 分钟，含精确文件路径与验收方式

## T1 仓库骨架（E:\opc）
- 建 `package.json`（npm workspaces：`packages/*`、`apps/*`、`server`）、`.gitignore`、`README.md`
- 建目录：`packages/core/src/{providers,analyzers,taxonomy,report,store,utils}`、`packages/core/test`、`packages/core/bin`、`server/src`
- 验收：目录存在，根 `package.json` 可被 npm 解析

## T2 标签体系 `packages/core/src/taxonomy/taxonomy.js`
- 导出 4 个维度、18 题材、全部标签定义（id/name/dimension/keywords/weight/desc）
- `matchTags(text, dimension)` → 命中标签 + 置信度
- 验收：`node --test` 中 `taxonomy.test.js` 通过

## T3 数据层
- `store/db.js`：node:sqlite 建表（videos / analyses / reports / tag_daily / runs），含 upsert 与查询方法
- `utils/seededRandom.js`：按日期种子的确定性随机（保证"每日榜单"可复现且日更变化）
- `utils/text.js`：中文 2–4gram 分词、停用词、情绪词典命中

## T4 Provider 适配器
- `providers/simulated.js`：40+ 条真实感视频池，按日期波动，支持 `metric=play|engage` 排序取 Top10
- `providers/douyin.js`：公开热榜 + 可选第三方 API（`DOUYIN_API_BASE`/`DOUYIN_API_KEY`），8s 超时
- `providers/composite.js`：真实优先 → 失败/空榜降级仿真，返回 `{videos, source, warnings}`
- CLI：`node packages/core/bin/boiling.js fetch --limit 10 --metric play`

## T5 四维分析引擎 `analyzers/`
- `topic.js` / `copy.js` / `rhythm.js` / `craft.js`，统一签名 `analyze(video) → {tags,summary,metrics}`
- `index.js` 聚合 → `analyzeVideo(video)`；`scoring.js` 计算 Boiling Score（榜单内分位）

## T6 报告生成 `report/generate.js`
- 分布统计、标签频次、环比昨日升降、受众洞察文案、3–5 条创作方向、Markdown 渲染
- 落库 + 输出 JSON

## T7 API 服务 `server/src/index.js`
- 零依赖 http 服务，路由表、CORS、静态文件、每日 09:00 定时（启动补跑）
- 验收：`curl /api/health`、`/api/today` 返回正确 JSON

## T8 官方网站 `apps/web`（Umi 4 + React 18 + antd 5）
## T9 移动 App `apps/mobile`（Taro 4 + React 18；初版为 uni-app 3 + Vue3，已按需求整体重写为 React）
## T10 桌面端 `apps/desktop`（Electron 44）

## T11 验收与交付
- 全量 `node --test` 通过；三端构建成功；启动服务截图验证；输出 `review.md` + `final_report.md`
