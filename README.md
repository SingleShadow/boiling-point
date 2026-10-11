# 沸点创意 · Boiling Point

> 把「爆款」从玄学变成可拆解、可复用、可预测的工程问题。
> 每天告诉你，今天的抖音观众在为什么而停留。

一套为内容创作者服务的**爆款拆解与趋势系统**：每日自动获取抖音播放量 / 互动量前 10 的爆款视频，从**题材、文案、节奏、表现手法**四个维度结构化拆解并自动打标签，输出每日趋势报告，明确指出受众偏爱的内容类型、热门话题与创作方向。

---

## 快速开始（3 步）

```bash
# 1. 启动 API 服务（内核零依赖，无需 npm install）
node server/src/index.js
# → http://localhost:8787

# 2. 生成最近 10 天数据（演示用；正式环境由每日 09:00 定时任务自动跑）
curl -X POST http://localhost:8787/api/backfill -H "Content-Type: application/json" -d '{"days":10}'

# 3. 打开三端
#   官方网站   http://localhost:8787/web/
#   移动 App   http://localhost:8787/app/     （手机访问时换成电脑局域网 IP）
#   桌面工作台 cd apps/desktop && npm install && npm start
#   Agent 控制台 http://localhost:8787/agent/（值守状态、健康分、思考痕迹、长期记忆）
```

跑通内核 CLI 也可以：

```bash
node packages/core/bin/boiling.js fetch            # 抓今日 Top10 并四维拆解
node packages/core/bin/boiling.js run              # 跑完整流水线并出报
node packages/core/bin/boiling.js report --date 2026-09-15
node packages/core/bin/boiling.js tags             # 查看标签体系
node --test packages/core/test/*.test.js           # 22 项单元测试
```

---

## 内容情报 Agent

「每天产出一份可信的抖音爆款趋势报告」这件事，由一个**自主 Agent**（`packages/agent`）负责，而不是一个定时脚本。

```
感知 Sense → 规划 Plan → 执行 Act → 质检 Evaluate → 修复 Repair → 沉淀 Learn → 出简报 Brief
```

| 能力 | 说明 |
|---|---|
| **感知** | 探测真实数据源可达性（带 8s 超时）、今日报告是否缺失/过期、近 7 天历史缺口 |
| **规划** | 把观测翻译成带理由的动作序列（抓取 / 复检 / 补缺口 / 切换指标 / 登记告警） |
| **执行** | 带重试与退避地跑流水线，每个动作留痕（耗时、结果、失败原因） |
| **质检** | 8 项出厂自检（样本完整性 / 四维覆盖 / 题材多样性 / 指数区分度 / 数据真实性 / 建议可执行性 / 时效 / 环比基线），输出 0–100 健康分 |
| **自愈** | 健康分 < 85 且重跑确实能改善时，自动切换排序指标 + 扩大候选池重取（至多一轮，不死循环） |
| **记忆** | 三张表累积经验：数据源可用率、连续失败计数、质量基线滑动均分、题材稳定性、运营节点 |
| **简报** | 每轮输出 CEO 简报：干成了没有 / 出了什么问题 / 下一步做什么 |

一句话区别：**脚本只会按时跑一次，跑成什么样没人管；Agent 会判断环境、解释决策、给自己打分、失败自救、经验累积。**

控制台：<http://localhost:8787/agent/>　·　契约文档：`AGENT.md`

```bash
npm run agent:plan      # 只看它在想什么，不执行
npm run agent:run       # 值守一次（--force 强制刷新）
npm run agent:status    # 状态与 KPI
npm run agent:brief     # 打印今日 CEO 简报
npm run agent:loop      # 守护模式常驻（09:00 后自动值守，每 30 分钟巡检）
```

---

## 三款产品

| 产品 | 技术栈 | 入口 | 定位 |
|---|---|---|---|
| **沸点官网** | Umi 4 + React 18 + antd 5 | `apps/web` → `/web/` | 品牌门面 + 数据门户 + 转化 |
| **沸点 App** | Taro 4 + React 18 | `apps/mobile` → `/app/` | 创作者随身趋势雷达（可编译 H5 / 微信小程序 / React Native） |
| **沸点工作台** | Electron 44 | `apps/desktop` | 团队生产力：深度拆解、导出、原生通知 |

三端共用同一套 API 与同一份设计系统（沸腾橙 `#FF5A1F` / 熔岩红 `#E8362B` / 深石墨 `#16181D`）。

---

## 系统架构

```
数据源层   抖音公开热榜接口 │ 第三方 API(Key) │ 仿真引擎（40+ 视频池）
                    └──────────┬──────────┘
                    CompositeProvider（真实优先，失败降级）
                               │
内核层     packages/core：抓取 → 四维分析 → 打标签 → 爆款指数 → 趋势报告
                               │  SQLite（node:sqlite）
服务层     server：Node22 内置 http，零依赖
                               │
智能层     packages/agent：感知→规划→执行→质检→自愈→记忆→简报（每日 09:00 值守）
                               │
表现层     apps/web · apps/mobile · apps/desktop · agent-console（/agent/）
```

### 目录

```
packages/core/      沸点内核（零第三方依赖）
  src/providers/    composite / douyin / simulated 三个数据适配器
  src/analyzers/    topic / copy / rhythm / craft + scoring
  src/taxonomy/     4 维度 79 个标签的标签体系
  src/report/       趋势报告生成 + Markdown 渲染
  src/store/        SQLite 持久化
  bin/boiling.js    CLI
packages/agent/     内容情报 Agent（零第三方依赖）
  src/sense.js      感知：数据源探测 / 报告新鲜度 / 历史缺口
  src/plan.js       规划：带理由的动作序列 + 修复策略
  src/act.js        执行：重试退避、动作留痕
  src/evaluate.js   质检：8 项自检 → 健康分
  src/memory.js     记忆：运行档案 / 问题洞察 / 长期知识
  src/brief.js      简报：CEO 三分钟读完
  bin/agent.js      CLI（run/plan/status/brief/backfill/memory/findings/loop）
server/             API 服务（:8787）
apps/web/           官方网站（Umi）
apps/mobile/        移动 App（Taro 4 + React 18）
apps/desktop/       桌面工作台（Electron）
agents/             软件研发中心组织（v2）：
                    产品 阿产/阿析 · 设计 阿设 · 研发管理 阿枢/阿序
                    开发 志帅(人·前端)+阿服(后端) · 测试 阿测 · 运维 阿维 · 文档 阿档
                    业务支撑 阿燃(内容SME) 阿渠(增长) 阿源(数据)
                    ORG.md=组织与岗位 · WORKFLOWS.md=每日/迭代流程
                    python agents/scaffold.py 重建岗位包 && python agents/build.py 打包
agent-console/      Agent 控制台（零构建 HTML，挂在 /agent/）
AGENT.md            Agent 契约文档
design.md           设计文档
plan.md             实施计划
review.md           代码评审报告
final_report.md     交付总结
```

---

## 四维分析体系

| 维度 | 分析内容 |
|---|---|
| **题材** | 18 个一级题材（剧情演绎 / 搞笑段子 / 知识科普 / 美食 / 旅行 / 情感共鸣 / 颜值变装 / 科技数码 / 萌宠 / 亲子育儿 / 健身运动 / 职场 / 国风文化 / 汽车 / 游戏 / 三农 / 探店 / 时尚穿搭） |
| **文案** | 长度分档、8 种句式、6 类黄金 3 秒钩子、情绪极性与强度、2–4gram 关键词、5 类 CTA |
| **节奏** | 时长分档、文案投放速率、信息密度、三段式结构完整度 |
| **表现手法** | 10 种形式、6 类技法、4 类元素、4 类互动设计 |

**爆款指数 Boiling Score（0–100）** = 30% 播放量分位 + 25% 互动率分位 + 20% 完播代理分位 + 15% 涨粉效率分位 + 10% 传播系数分位。采用**当日榜单内分位**而非绝对值，使分数跨天可比。

---

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 + 运行状态 |
| GET | `/api/today` | 今日 Top10 + 四维拆解 + 洞察 + 创作方向 |
| GET | `/api/report?date=` | 指定日期日报 |
| GET | `/api/reports?limit=` | 历史日报列表 |
| GET | `/api/tags` | 完整标签体系 |
| GET | `/api/trends?days=` | 标签趋势序列 |
| GET | `/api/videos?date=` | 视频明细 |
| GET | `/api/stats` | 运行统计 |
| POST | `/api/run` | 手动触发一次抓取分析 |
| POST | `/api/backfill` | 回溯生成最近 N 天 |
| GET | `/api/agent/status` | Agent 状态快照（今日值守 + KPI + 记忆 + 问题） |
| GET | `/api/agent/plan` | 只感知与规划，返回思考过程 |
| POST | `/api/agent/run` | 触发一次完整值守（`{force:true}` 强制刷新） |
| GET | `/api/agent/brief?date=` | 当日 CEO 简报（Markdown） |
| GET | `/api/agent/memory` | 长期记忆 |
| GET | `/api/agent/findings` | 问题与洞察 |
| GET | `/api/agent/runs` | 值守历史 |
| GET | `/api/agent/stats` | Agent KPI（成功率 / 平均健康分） |

---

## 接入真实数据源

### 先说实测结论（2026-09-16 亲测）

| 端点 | 状态 | 能拿到 |
|---|---|---|
| `iesdouyin.com/web/api/v2/hotsearch/billboard/word/` | ✅ 200 | **50 条真实热搜词 + 热度值**（免 Key） |
| `iesdouyin.com/aweme/v1/web/hot/search/list/` | ❌ 403 | 无（抖音已封免签名视频榜） |
| `iesdouyin.com/web/api/v2/hotsearch/billboard/aweme/` | ⚠️ 200 空数组 | 无 |

**一句话**：抖音官方没有开放"全站视频热榜"的免签名接口。免费通道只能拿**热搜话题**，拿不到**视频级播放数据**。所以视频榜必须走第三方或自建采集。

### 三条路径

| 路径 | 能拿到 | 成本 | 风险 | 建议 |
|---|---|---|---|---|
| **A. 官方热搜词榜** | 今日热搜话题 TOP50 | 0 元 | 无 | ✅ **已默认启用**，开箱即用 |
| **B. 第三方数据服务**（新抖/蝉妈妈/飞瓜/卡思） | 视频榜 + 播放/互动全量 | 数千元/年起 | 低（合规） | ✅ 商业化必选 |
| **C. 自建采集**（Playwright 跑签名 / 逆向 a_bogus） | 理论全量 | 高运维 | ⚠️ 封 IP、合规灰区 | ❌ 不建议做公司底座 |

> 抖音**开放平台**（open.douyin.com）只能拿自己账号的视频数据，拿不到全站榜单——这条路走不通，别浪费时间申请。

### 路径 A：已默认生效，无需配置

`GET /api/hotwords?limit=20` 实时返回抖音官方热搜榜。无论视频榜走哪条通道，报告里的 **`audienceInsight.realHotWords`** 都是这份真实数据，并在日报 Markdown 中单独成段、标注抓取时间。

```
# 1 巨人之旅330 · 1210万        （新）
# 2 2026年国家网络安全宣传周 · 1142万  （爆）
```

### 路径 B/C：自定义数据源（推荐，零改代码）

任何能返回 JSON 的 HTTP 端点都能接 —— 第三方数据商、你自己写的中转服务、n8n、甚至内部数仓。**不用改一行业务代码**，配环境变量即可：

```bash
# .env
CUSTOM_API_URL=https://api.example.com/douyin/hot?size={{limit}}&date={{date}}
CUSTOM_API_METHOD=GET
CUSTOM_API_KEY=your_token
CUSTOM_API_LIST_PATH=data.list              # 列表数组在哪，支持 a.b.c
CUSTOM_API_MAP={"id":"aweme_id","title":"desc","play":"statistics.play_count",
                "digg":"statistics.digg_count","author":"author.nickname",
                "challenges":"text_extra[].cha_name","duration":"duration"}
CUSTOM_DURATION_UNIT=ms                     # duration 是毫秒还是秒
```

- `CUSTOM_API_MAP` 支持 `a.b.c` 嵌套路径；`challenges` 支持 `arr[].field` 语法。
- 配好 `CUSTOM_API_URL` 后优先级**高于**抖音通道，Agent 健康分里的「非真实数据」扣 15 分会**自动消失**，报告升到 A 级。
- 完整参数见 `.env.example`。

接入后自检三步：

```bash
curl "http://localhost:8787/api/agent/plan"       # 看 Agent 是否识别到真实源（live.ok=true）
curl -X POST http://localhost:8787/api/agent/run -H "Content-Type: application/json" -d '{"force":true}'
curl "http://localhost:8787/api/agent/status"     # 健康分应为 100 / A 级
```

### 离线演示

`BOILING_DATA_MODE=simulated` 只用内置仿真引擎。仿真按日期种子化随机，并叠加**每日题材浪潮**（每天随机 3 个题材获得流量加成），榜单逐日变化、环比可信、结果可复现。

---

## 技术约束

- `packages/core` 与 `server` **零第三方依赖**，仅用 Node 22 内置模块（`node:sqlite`、`node:test`、`node:http`）。
- 需要 Node ≥ 22.5。
- 三端前端依赖各自独立安装（`apps/*` 下 `npm install`）。
