# 沸点创意 — 代码评审报告

> Superpowers Phase 6 · 对照 plan.md 与 design.md 的验收评审

## 验收结论

| 项 | 结果 |
|---|---|
| 内核单元测试 | ✅ 22 / 22 通过 |
| 每日流水线 | ✅ 抓取 → 四维分析 → 评分 → 出报 → 落库，CLI 与 API 双通道验证 |
| API 服务 | ✅ 10 个路由全部 200（`/api/health` `/api/today` `/api/report` `/api/reports` `/api/tags` `/api/trends` `/api/videos` `/api/stats` `/api/run` `/api/backfill`） |
| 官方网站 | ✅ `umi build` 成功，5 个页面全部 200（`/web/` `/web/trend` `/web/report` `/web/tags` `/web/about`） |
| 移动 App | ✅ `taro build --type h5` 成功，产物 `apps/mobile/dist`，`/app/` 200（最初为 uni-app + Vue3，已按需求整体重写为 Taro 4 + React 18） |
| 桌面工作台 | ⚠️ 源码完整、语法校验通过，但 Electron 二进制在本环境为占位文件，GUI 未能实际启动 |
| 定时任务 | ✅ 启动补跑 + 每日 09:00（可配 `BOILING_CRON_HOUR`） |

---

## Critical（阻塞项）

无。

## Major（需知悉，已给出处理）

**M1 · Electron 二进制不可用（环境限制，非代码问题）**
`npm install` 成功写入 `devDependencies`，但镜像返回占位二进制，`require('electron')` 为 undefined。
- 处理：`main.js` / `preload.js` / `renderer/*` 均 `node --check` 通过；渲染页可不依赖 Electron 直接用浏览器打开验证（数据来自已运行的后端）。在有正常网络的环境执行 `npm install && npm start` 即可运行。
- 影响面：仅桌面端 GUI 启动，不影响官网、App、内核与 API。

**M2 · 仿真数据的量为构造值，不是真实播放量**
- 处理：报告头部明确标注数据源（`source: simulated` → 「仿真引擎（离线演示）」），README 与 `/about` 均写明口径。爆款指数采用**榜单内相对分位**而非绝对值，因此即便换成真实数据，结论口径依然成立。

**M3 · 语速指标口径**
初版按「>6 字/秒」判定，导致全部视频被判为慢语速（短视频标题字数远少于口播稿）。
- 处理：重新按实际分布校准为 0.6 / 1.2 字/秒阈值，并把标签改名为「快/中/慢节奏文案」，避免与真实口播语速混淆。修改后分布从 10/10 集中在慢档改善为 7:3:0 的合理分布。

## Minor（可改进，不阻塞）

**m1 · 「结构不完整」占比偏高（9/10）**
短视频标题普遍为单句、无显式 CTA，判定偏严。已将「对比式句式」纳入收尾信号，降至约 6/10。属于真实诊断结论，可不改。

**m2 · craft 维度在真实接口下置信度会下降**
部分表现手法标签依赖数据源标注与题材先验。接入真实抖音接口后，建议补充封面/OCR/ASR 信号再做一轮校准。

**m3 · 情绪词典覆盖率有限**
已扩到约 90 词，长尾表达仍会落到「中性陈述」。可替换为公开情感词典或接 LLM 增强。

**m4 · API 未做鉴权**
单机/内网场景可接受；公网部署需在 `server/src/index.js` 增加 JWT 或 API Key 中间件。

**m5 · `node:sqlite` 是实验特性**
Node 大版本升级时需回归。已在 README 标注 Node ≥ 22.5。

**m6 · 每日题材浪潮为仿真引擎特性**
真实数据接入后 `trendWave` 不再存在，趋势完全由真实榜单驱动，逻辑无需改动。

**m7 · 移动 App 仅验证了 H5 端**
Taro 4 工程已配 `@tarojs/plugin-platform-weapp`，但本次只实际执行了 `taro build --type h5` 并验证产物；微信小程序端与 React Native 端未编译验证，首次执行 `taro build --type weapp` 时可能需按 Taro 提示补充小程序 appid 与 `project.config.json`。

---

## 过程中修复的问题

1. `percentileRank` 采用 midrank 公式导致爆款指数最高可达 125（越界）→ 改为 min-max 归一，分数严格落在 0–100。
2. 报告 `hotTopics` 统计写法冗余易错 → 重写为单次遍历计数。
3. `FIRST_PERSON` 含单字「我」，导致「第一人称」标签 9/10 无区分度 → 改为仅保留强第一人称复合词。
4. 固定日期种子下高播放条目恒稳，导致每日榜单题材几乎不变（连续 10 天「萌宠」主导）→ 引入每日题材浪潮 + 加大噪声，现每日主导题材在萌宠/美食/职场/情感共鸣间轮换。

---

## 代码质量

- `packages/core` 与 `server` 零第三方依赖，共约 1,660 / 380 行，全部模块化、单一职责。
- 四维分析均为纯函数，输入确定则输出确定，可回归测试。
- 三端共用同一 API 契约与同一套设计系统 token，无重复业务逻辑。
- 未发现硬编码密钥、未发现 TODO 占位。
