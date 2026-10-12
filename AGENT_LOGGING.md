# Agent 工作留痕规范

> v1 · 2026-10-13 · 目标：**事后能复盘、出事能定位到人**。
> 每个 Agent 执行任务时自动/约定记录一条结构化日志，写入永不阻塞主流程，失败也有降级。

---

## 一、存储位置

| 用途 | 路径 |
|---|---|
| 根目录 | `logs/`（可用环境变量 `AGENT_LOG_DIR` 或 CLI `--root` 覆盖） |
| 正常归档 | `logs/agents/<agentId>/<YYYY-MM-DD>.jsonl` |
| 降级归档 | `logs/_fallback/<YYYY-MM-DD>.jsonl`（主目录不可写时） |

`logs/` 已加入 `.gitignore`——留痕是运行数据，不进版本库。

## 二、命名规则

- **目录名 = agentId**：直接复用 `agents/<slug>/` 的英文 slug，与仓库目录一致、不用另记一套 id
- **文件名 = 本地日期** `YYYY-MM-DD.jsonl`（一天一个文件，天然按天分片）
- **格式 = JSONL**：一行一条 JSON。选它是因为追加写入永不破坏已有内容，坏行也不会污染其他行，还方便 `grep` / `jq` / 按行流式读取。

| agentId（= `agents/<slug>`） | 谁 | agentId | 谁 |
|---|---|---|---|
| `product-manager` | 阿产（产品） | `backend-dev` | 阿服（后端） |
| `business-analyst` | 阿析（需求分析） | `qa` | 阿测（QA） |
| `design-officer` | 阿设（UI/UX） | `devops` | 阿维（DevOps） |
| `architect` | 阿枢（架构） | `tech-writer` | 阿档（文档） |
| `scrum-master` | 阿序（Scrum） | `content-strategist` | 阿燃（内容策略） |
| `xiaofei` | **小沸（运行时，自动记）** | `growth-officer` | 阿渠（增长） |
| | | `data-officer` | 阿源（数据源） |

## 三、每条记录包含什么

| 字段 | 含义 | 备注 |
|---|---|---|
| `ts` | 记录写入时间（ISO） | |
| `date` | 归档日 | 决定落在哪个文件 |
| `traceId` | 单次任务唯一 ID | 复盘时串起同一件事 |
| `agentId` / `agentName` | **Agent 标识** | 责任定位用 |
| `task` | **任务名称** | |
| `source` | **任务来源** | 如 `cron:09:00`、`story-12`、`api:/api/agent/run` |
| `startAt` / `endAt` / `durationMs` | 起止与**耗时** | |
| `status` | **执行结果** | `ok` / `fail` |
| `steps[]` | **执行的关键步骤** | `{name, at, detail}` |
| `tools[]` | **调用的工具或接口** | `{name, at, meta}`，如 `db.query`、`api.bilibili` |
| `result` | 成功时的结果摘要 | 大对象自动摘要，避免日志爆炸 |
| `error` | **异常与错误** | `{name, message, stack(前6行)}` |
| `context` | 额外上下文 | 日期、样本数等 |
| `degraded` / `writeError` | 是否走了降级写入 | 用于发现磁盘/权限问题 |

## 四、谁在记

**1）自动——小沸（`packages/agent` 运行时）**
六层闭环每步都埋点：感知 → 规划 → 执行 → 质检 →（修复重跑）→ 沉淀记忆 → 出简报，
每层的 DB/接口调用也记录为 `tools`。失败自动记 `fail` 并带上异常，然后**继续向上抛**（不吞异常）。

**2）约定——12 个岗位 Agent**
每完成一个任务补一条（命令见第六节）。规则已写进 `agents/scaffold.py` 生成的每个 `AGENTS.md`，
重建岗位包后全员自带这条纪律。

## 五、不阻塞与三级降级

```
调用方只入队 → setImmediate 异步 flush（调用方不 await）
   ├─ ① 主目录写入成功              ✅ 正常
   ├─ ② 主目录失败 → 写 _fallback/   ⚠️ 降级，记录 degraded=true + writeError
   └─ ③ 再失败 → console.error       ⚠️ 绝不抛错、绝不中断主流程
```
外加：进程 `beforeExit` / `exit` 时同步兜底刷写残留队列，避免「日志还没写完进程就退了」。

## 六、查看方式

```bash
# 今天全部留痕
node packages/core/bin/agentlog.js view
# 某个 agent 某天
node packages/core/bin/agentlog.js view --agent xiaofei --date 2026-10-13
# 只看失败（责任定位）
node packages/core/bin/agentlog.js view --status fail
# 最近 5 条
node packages/core/bin/agentlog.js view --agent afu --last 5
# 有哪些 agent / 哪些天有记录
node packages/core/bin/agentlog.js list
# 成功率与耗时统计
node packages/core/bin/agentlog.js stats
# 机器可读（接 CI / 看板）
node packages/core/bin/agentlog.js view --json
```

岗位 Agent 补录：

```bash
node packages/core/bin/agentlog.js add \
  --agent backend-dev --name 阿服 \
  --task "设计 /api/score-title 契约" --source story-12 \
  --status ok --duration 1200 [--error "失败原因"] [--note "备注"]
```

## 七、脱敏规则

写入前自动递归脱敏，防的是「日志里躺着密钥」：

| 规则 | 处理 |
|---|---|
| 键名命中 `token / password / secret / authorization / api_key / cookie / credential / phone` 等 | 整值替换为 `***已脱敏***` |
| 邮箱 | `zhishuai.cui@example.com` → `zhi***@example.com` |
| 超长字符串（>500 字） | 截断并标注「已截断 N 字」 |
| 对象深度 >6、数组 >50 | 截断，避免日志爆炸 |

## 八、与其他文档的关系

- `ORG.md`：岗位定义（谁是谁）
- `agents/WORKFLOWS.md`：日常节奏与交接
- `COLLAB.md`：契约先行机制
- 本文件：留痕的存储、字段、查看与降级
