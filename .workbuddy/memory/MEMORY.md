# 项目长期记忆 · E:\opc（沸点创意 Boiling Point）

## 项目定位
以创意服务为核心的公司「沸点创意 Boiling Point」：每日抓取抖音播放量/互动量前 10 爆款视频 → 四维结构化拆解（题材/文案/节奏/表现手法）打标签 → 输出每日趋势报告与创作方向建议。

## 固定约定
- **数据源默认 auto**：真实抓取优先，失败/空榜降级仿真，响应 `warnings` 里标注，界面显示「演示数据」角标。
- **爆款指数**用榜单内相对分位（min-max 归一），不用绝对值，保证跨天可比。
- **内核与 server 零第三方依赖**：只用 Node22 内置 `node:sqlite` / `node:http` / `node:test`。不要给这两处加 npm 包。
- 三端只消费 `/api/*`，不直接 import 内核。
- **每日任务由 Agent 负责，不是 cron 脚本**：`packages/agent`（零依赖，与 core 同规范），六层闭环 感知→规划→执行→质检→自愈→记忆→简报。server 的 09:00 定时与 boot 补数据均已切到 `runAgent`；契约见 `AGENT.md`，控制台 `/agent/`（`agent-console/index.html`，零构建）。
- Agent 三张表 `agent_runs` / `agent_findings` / `agent_memory` 由 `ensureAgentSchema(db)` 建，server 启动时调用。改 Agent 逻辑后 CLI 与 server 都要重启才生效（server 常驻）。
- 健康分基准：8 项自检 100 分制，修复阈值 85；仿真数据源固定扣 15 分（接真实源后自动消除）。
- 品牌色：沸腾橙 `#FF5A1F`、熔岩红 `#E8362B`、深石墨 `#16181D`、数据蓝 `#2F6BFF`、热力黄 `#FFB020`；卡片圆角 12px。

## 数据源事实（2026-09/10 实测，别再试错）
- **✅ 0 预算真实视频数据 = B站公开 API**（2026-10-12 实测 200，免 Key 免签名）：
  `https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1`（今日热门，主）、
  `.../ranking/v2?rid=0&type=all`（综合榜，备）。
  返回 `data.list[]`：`stat.view/like/coin/favorite/share/reply`、`duration`(秒)、`owner.name`、`tid/tname`(分区)、`bvid`、`pic`、`desc`。
  已配进 `.env`（`CUSTOM_API_AUTH=none`、`LIST_PATH=data.list`），**实测健康分 100/A**。
  ⚠️ 两个硬约束：**无历史参数**（只返回此刻热门 → 趋势必须每天真跑攒 2-4 周）；**无粉丝数** → `fans` 用 `stat.coin` 代理。
- 因此产品平台已从抖音转向 **B站（内容层）+ 抖音热搜（话题层）**，目标用户 = B站中腰部 UP 主。
- **`.env` 加载器 `packages/core/src/env.js`**（2026-10-12 新增）：此前文档承诺"配 .env 即可"但代码从不读 .env（真 bug）。已在 4 个入口接入 `loadEnv()`：datasource-check / boiling CLI / agent CLI / server。**改配置后必须重启 server**（启动时读一次）。
- 抖音**免签名公开视频榜已关闭**：`iesdouyin.com/aweme/v1/web/hot/search/list/` 403、`billboard/aweme/` 空数组。视频级播放数据**必须**走第三方数据商或自建采集。
- **唯一免 Key 可用的真实数据**：`iesdouyin.com/web/api/v2/hotsearch/billboard/word/` → 50 条热搜词 + hot_value（label: 1新/2热/3爆）。已封装 `douyin.fetchHotWords()`，API `/api/hotwords`，报告字段 `audienceInsight.realHotWords`。
- 抖音开放平台只能拿授权账号自己的数据，**无全站榜单**。
- 接任意数据源用 `custom.js` provider：配 `CUSTOM_API_URL` + `CUSTOM_API_MAP`（支持 `a.b.c` 与 `arr[].field`），不改代码；配好后优先级高于抖音通道，Agent 健康分的「非真实数据」扣 15 分消失。
- **`CUSTOM_API_AUTH`**（bearer 默认 / appcode / raw / none）：国内云市场（阿里云、京东万象）用 **APPCODE**，原来写死 Bearer 导致这类源接不进来。
- `custom.js` 内置字段映射体检：play/duration/challenges 三个维度全 0 会告警，防「通了但产出废数据」。
- 热搜**双通道**：主 `iesdouyin` + 备 `60s.viki.moe/v2/douyin`，主挂自动降级并在 `warnings` 标注（已实测降级成功）。
- 各类"免费抖音 API"聚合站（vvhan/alapi/天聚数行等）实测**返回的都是热搜词，没有播放量**，别再试。
- 真实源判定：`LIVE_SOURCES = {douyin, custom}`，仅 `simulated` 算非真实。
- **B站热门榜只出头部，不是客户池**：抽 15 个上榜 UP 主，百万粉以上 10/15。`popular` 是"全站综合热门"，用来捞「中腰部 1-10 万粉」客户是错的。分区榜 `ranking/v2?rid=X` 实测 **-352 风控**；粉丝数只能靠 `x/relation/stat?vmid=` 逐个补（公开但有频限）。
- **UP 主公开联系方式几乎拿不到**：50 条热门视频简介中微信/QQ/商务合作迹象 **0/50**。
- **获客路径已改为「拉」不是「推」**：每日拆解内容发 B站动态/小红书/知乎为主（产品产出物=获客素材，边际成本近零），精准私信每天 ≤5 个为辅。原「私信 50/150 人」方案已作废，见 `VALIDATION_PLAN.md`。
- **数据源自检：`npm run datasource:check`**（`packages/core/bin/datasource-check.js`）——打印当前配置/热搜通道/视频榜三通道实测/下一步建议。改数据源相关代码后先跑它。
- `packages/core/test/custom.test.js` 用**本地 mock HTTP 服务**端到端验证适配器（10 用例）。接数据商不通时，问题只在 URL/Key/映射三处。

## 平台适配（2026-10-12 起，B站为主平台）
- **`packages/core/src/platform.js`** 是平台差异的唯一去处：时长分档、哪些节奏指标成立、能否回溯历史、B站分区→题材/形式映射。分析器只消费参数，不写死阈值。
- 关键口径：**B站不输出语速与信息密度**（接口无字幕，标题字数÷时长≈0.1，套抖音阈值会全判「慢+低密度」），改在 `rhythm.metrics.unavailable` 声明。
- **B站 `supportsHistory=false`**：接口只返回「此刻热门」，Agent **跳过 backfill**。强行补录 = 把同一批数据复制成多天假历史。真趋势只能靠每天真跑累积（2-4 周）。
- `topic.js`/`craft.js` 通过 `video.raw.topicHint`/`raw.craftHint` 吃数据源标注；**标注优先于关键词猜测**（顺序反了会误判）。
- 无形式信号时输出 `form_unknown`，**不默认判口播**（默认口播曾让 B站 9/10 变口播）。维度不能为空，否则质检判"维度缺失"。
- 标签体系 **79 → 86**：新增题材 音乐/动画影视、4 个 B站时长档、form_unknown。**改 taxonomy 必须同步阿燃 `PLAYBOOK.md` 的标签翻译表**（铁律）。

## 免费获客工具：标题体检（2026-10-12 上线）
- 位置：内核 `packages/core/src/scorer/title.js`（纯函数，10 例测试）· 页面 `tools/title-score/index.html`（零构建）· 路由 `/tool/`（服务 STATIC_MAP 新增，改了要重启）
- 接口：`GET /api/score-title?title=` `/api/score-title/baseline` `POST /api/subscribe` `GET /api/subscribers`
- 基准 = 库内近 7 天标题 + 实时 popular 50 条，缓存 1h；`.env` 的 `ps=50` 不能改小（基准越大，建议里的占比越可信）
- DB `subscribers` 表存留资邮箱（验证期不发邮件、不做密码、不接支付）
- **核心设计：每条建议必须带真实占比**，不给主观点评——这是它能获客的原因
- **B站热门标题写法分布（50 条实测，反直觉）**：情绪词 22% · 【】22% · 疑问 18% · **数字仅 8%**（抖音直觉是"必须有数字"，在 B站是错的）；长度主流 10–21 字
- **教训：评分阈值必须相对、得分曲线必须归一化**。固定 rate≥20% 在真实数据下会让"没有任何热门写法"→ 分数永远卡在长度分；累加权重会让满分不可达（最高 73 分永远拿不到 A）。现用「覆盖率」= 命中的热门写法占比之和 ÷ 全部热门写法占比之和
- **踩坑（写分析脚本时）**：`extractFeatures()` 的 `hits` 是 **Set** 不是普通对象（`JSON.stringify` 会显示成 `{}`，极易误判成"特征全没命中"）；`scoreTitle` 在 `baseline.size < 10` 时**按设计返回 0 分 + 空 features**（「基准样本不足」），抽样验证时基准样本必须 ≥10 条。两者都曾让我误以为打分器坏了，实际无 bug。
- **信任陷阱（2026-10-13 实测，对外前必修）**：只有 ≥15% 的写法算「热门」，冷门写法命中**不加分** → 「我花了30天复刻了这道菜，结局谁也没想到」命中 4 个写法仍只有 **20 分 D**（覆盖率 0%）。用户会困惑「用了技巧为何最低分」。见 `REQUIREMENTS.md` R2。
- **能力缺口（2026-10-13 发现）**：落地页 CTA 承诺「每天收到一份当日爆款拆解」，但项目**没有邮件通道**（验证期明确不发邮件）。留资了却发不出 = 违约，要么建邮件能力要么改文案。见 `REQUIREMENTS.md` R4。

## 环境铁律（本机）
- Bash 工具必须先 `export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"`，否则 ls/grep/tail 不可用。
- PowerShell 工具输出捕获不到，只用来执行（如按端口杀进程），不要用来读取结果。
- Node：**``C:/Users/cui/.workbuddy/binaries/node/versions/22.22.2-6/node.exe``**（2026-10 实测 `-3` 已不存在，用前先确认目录）；npm 同目录 `npm.cmd`。
- Windows 路径给 node 要带盘符 `E:/opc/...`。
- npm 用 npmmirror 镜像（默认源极慢）。
- `node --test` 传 glob，不能传目录。
- **server 的 `STATIC_MAP` 在启动时解析 dist 目录**：新增/更换前端构建产物后必须**重启 API 服务**，否则新站点 404。已支持多候选目录，但解析只在启动时做一次。
- 移动 App 现为 **Taro 4.2.1 + React 18**（uni-app 版已删除）。Taro 注意：① `config/index.js` 的 `cssModules` 不能带 `namingPattern`/`generateScopedName`，会被配置校验拦；② 必须装 `@babel/preset-react`，否则 JSX 编译失败；③ 用 `npm install --no-workspaces` 装依赖，避免触碰根 monorepo；④ H5 挂子路径需 `h5.publicPath='/app/'` + `h5.router.mode='hash'`。
- Electron 在本环境只能装到占位二进制，GUI 跑不起来。
- **Edit 工具偶发「返回成功但文件未改」**：关键改动（尤其是 server/src/index.js 这类多处编辑）后必须 grep/sed 复核，必要时重发一次编辑。

## 经营现状（2026-10-12 体检 + 当晚修复后）
- 体检时：报告 16 份全 `source=simulated`、停机 21 天、无 git、无用户表/鉴权/埋点（用户 0 收入 0）
- **当晚已修复**：✅ 真实源（B站，健康分 100/A）✅ `git init`+首提交 `5d95592` ✅ 服务常驻 :8787
  ✅ DB 清洗为「仅真实数据」（备份 `data/boiling.db.bak-20261012`）
- **仍是 0 用户 0 收入** —— 这才是当前唯一的核心问题
- 已确认经营约束：**订阅制 / 0 数据源预算 / 0 潜客（需冷启动）/ 1 人 / 20h 每周 / 先验证**
- **下一个必修（约 2 天）**：分析层还停在「抖音尺子量 B站」——题材 8/10 判「其他/综合」、形式 9/10 判「口播」、话题空、节奏全判慢、报告标题写死"抖音"。见 `VALIDATION_PLAN.md` 的 R1–R6
- **趋势/环比现在不可用**（B站无历史接口），靠每天真跑积累，2-4 周后才开放
- 停止清单：桌面端 / App 小程序·RN / 新增 Agent 岗位 / 抖音数据采购 / 趋势功能 / 注册鉴权（W4 前）

## 战略基线（人才方向，HIRING.md）
- 工程能力已过剩（13.6k 行 / 79 标签 / 三端齐活），**缺的不是程序员**
- 第一优先 = 内容策略负责人（必须给股份，硬条件是自己做号到 10 万粉或操盘过 MCN 内容中台）
- 数据岗**不招全职**：`custom.js` 万能适配器已就绪，接数据商是 1 人周 → 买 API 或外包
- 增长建议创始人先自己干 3 个月再招
- 不招：产品经理 / 测试 / 运维 / 管理层 / 内容编辑
- 该岗已固化为 Agent「阿燃」：`agents/content-strategist/`（SOUL/IDENTITY/AGENTS/PLAYBOOK），产物 `dist/content-strategist.skill`。**PLAYBOOK 的 79 标签人话翻译表是核心资产**——改 taxonomy.js 必须同步改它

## 组织原则（2026-10-12 重构为软件研发中心，ORG.md v2）
- **11 岗位 = 1 人 + 10 Agent**。**前端开发是唯一人岗（崔志帅）**，其余全部 Agent
- 工程条线：阿产 PM / 阿析 BA / 阿设 UI-UX / 阿枢 架构师 / 阿序 ScrumMaster / 阿服 后端 / 阿测 QA / 阿维 DevOps / 阿档 文档
- 业务支撑层（不占工程编制）：阿燃=内容 SME、阿渠=用户反馈（挂产品条线）、阿源=数据工程（挂研发条线）
- **小沸 = 产品运行时服务，不是员工**（健康分是 SLA 指标，非组织成员）
- 铁律：Agent **不改前端代码**，只出规格/契约/建议/缺陷，由人落笔；交付物不完整要退回不许补全
- 打包：`python agents/scaffold.py`（重建岗位包）&& `python agents/build.py`（打包 .skill）
- `frontend/` 故意无 SKILL.md → build.py 自动跳过（人岗不打包为 Agent）
- 各 Agent 的 PLAYBOOK 是核心资产，改流程先改它（尤其阿燃的 79 标签翻译表）
- **每个 Agent 只有一个第一指标**，考核三个等于没考核
- Agent 接管不了：战略判断、关系、签字 —— 可以准备到 90 分，最后一下必须是人
- 日常/迭代流程规则：`agents/WORKFLOWS.md`（含 6 个可复制模板）

## agent-creator 打包流程（本机已验证）
1. `create_agent_bundle.py` 先用**英文参数**生成标准包（bash 传中文给 python 有编码风险）
2. 用 Write 工具覆写 `assets/workspace-template/*.md` 为中文定制内容
3. python `zipfile` 重打包，arcname 用 `relpath(p, dirname(base))` 保持 slug 前缀
4. `quick_validate.py` 校验——**必须传解压后的目录，传 .skill 会报 SKILL.md not found**

## 文档
`AGENT.md`（Agent 契约）· **`ORG.md`（组织与岗位配置 v2）** · **`WORKFLOWS.md`（每日/迭代协作流程）** · `HIRING.md`（人才与组织规划）· **`DATA_SOURCING.md`（数据源接通执行手册：门牌号/价格/接线四步/排查/验收）** · `design.md`（设计）· `plan.md`（计划）· `review.md`（评审）· `final_report.md`（交付总结）· `README.md`（使用）
