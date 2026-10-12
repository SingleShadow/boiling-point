# 多 Agent 协作工作流 · 契约先行落地方案

> v1 · 2026-10-13 · 前提：**前端由崔志帅本人开发，其余全部工作由 Agent 承担**
> 配套：`ORG.md`（岗位定义）、`agents/WORKFLOWS.md`（日常节奏）。本文件只讲**契约机制与交接物**。

---

## 0. 一句话机制

**`contracts/api.json` 是唯一真源。**
契约冻结 → 自动生成类型与 mock → 前端开工（不必等后端写完）；
契约变更 → diff 判定破坏性 → 写进 CHANGELOG → 前端 ack 闸门放行。

---

## 1. 职责边界

| 岗位 | 负责 | **明确不做** | 交接产出物 |
|---|---|---|---|
| 阿析 B | 需求拆解、验收标准（3–7 条可判定） | 不做实现决策 | `STORY-N` + 验收标准 |
| 阿产 P | 优先级（RICE）、迭代范围 | 不定技术方案 | 迭代范围清单 |
| 阿枢 A | 技术选型、ADR、分层边界 | 不定需求优先级 | ADR |
| 阿设 🎨 | 信息架构、交互、**数值化**设计规格 | 不给「差不多」的描述 | 设计稿（含尺寸/色值/间距/状态） |
| **阿服 E** | **契约 owner**：`contracts/api.json`、数据模型、接口实现、迁移 | **不改前端代码** | 契约条目 + 实现 + 迁移脚本 |
| 阿测 Q | 用例、回归、发布门禁 | 不改代码 | 用例 + 门禁结论 |
| 阿维 O | 构建、部署、监控、回滚 | — | 发布记录 |
| 阿档 D | 文档同步 | — | 文档 diff |
| **崔志帅（人）** | **前端页面与交互实现**、构建配置、子路径部署、**ack 契约同步** | **不猜字段**（字段不对就退回阿服） | 页面代码 |

> 沿用 `ORG.md` 铁律：Agent 只产出规格/契约/建议/缺陷，**不直接改前端代码**。

---

## 2. 协作顺序（含 3 道门禁）

```
① 需求就绪   阿析 → 阿产        STORY + 验收标准
                                  ┆ 门禁1：无验收标准不许开工（WORKFLOWS 2.2）
② 架构       阿枢                ADR（涉及架构时）
③ 契约       阿服                新端点写进 contracts/api.json，status=draft
                                  ┆ 门禁2：npm run contract:check 必须通过
                                  ┆        （draft → 阿服确认后改 frozen）
④ 生成物     自动                 types/api.d.ts + fixtures + mock 服务
⑤ 前端开工   崔志帅               ┆ 门禁3：端点必须 frozen 且 .ack 版本匹配
   ∥ 后端实现 阿服                （并行！前端用 mock，不等后端）
⑥ 联调       双方                mock → 真实服务（npm run server）
⑦ 测试/发布  阿测 → 阿维         门禁结论 → 发布
```

**关键点**：③④ 让前端和后端**并行**。契约一冻结，前端就能用 mock 写完整个页面，后端同时按契约实现，最后联调只对齐真实数据。

---

## 3. 交接必须产出的中间物

| 交接 | 必须产出 | 落地文件 | 谁验收 |
|---|---|---|---|
| 需求 → 设计 | 用户场景、边界 | `STORY-N` | 阿设 |
| 设计 → 前端 | **数值化**设计规格 | 设计稿 | 志帅 |
| 需求 → 后端 | 字段/行为/错误码要求 | 契约新条目（draft） | 阿服 |
| **后端 → 前端** | **① 契约 ② 类型 ③ mock ④ 变更说明** | `contracts/api.json`(frozen)<br>`types/api.d.ts`<br>`contracts/fixtures.json`<br>`contracts/CHANGELOG.md` | **志帅**（四项缺一可退回） |
| 前端/后端 → QA | 自测通过的实现 + 结论 | — | 阿测 |
| QA → 发布 | 门禁结论 | — | 阿维 |
| 任意 → 文档 | 变更点 | 文档 | 阿档 |

**交接铁律（沿用 WORKFLOWS）**：交付物不完整 = 没交付。收到不完整的东西**退回**，不要自己补全——补全会让问题消失在链条里。

---

## 4. 保证「契约先于页面」的三道闸

| 闸 | 机制 | 失败表现 |
|---|---|---|
| **闸 1 · draft 不可用** | 新端点默认 `draft`；mock 服务对 draft 端点返回 **409** | 前端想调 draft 接口直接被拒 |
| **闸 2 · 契约自检** | `npm run contract:check`：frozen 端点必须字段齐 + 有 mock，否则**命令失败** | 阿服漏字段/mock 会被当场拦下 |
| **闸 3 · 同步版本** | `contracts/.ack` 记录前端已同步的版本；`npm run contract:sync` 落后即报错 | 契约变了但前端没改 → 报错挡住 |

---

## 5. 变更同步机制（五步，缺一不可）

1. **阿服改契约** → 改 `contracts/api.json` 并 **bump `version`**
2. **判定影响**：`npm run contract:diff`
   - 自动对比上一版归档，判定 **BREAKING / 兼容**
   - 追加到 `contracts/CHANGELOG.md`，归档 `contracts/archive/api-<version>.json`
   - 有 BREAKING → 命令以 **2** 退出（强制前端处理）
3. **重生类型**：`npm run contract:types` → `types/api.d.ts`
4. **前端感知**：`npm run contract:sync` → 提示「契约有更新，请查看 CHANGELOG」
5. **改完确认**：`npm run contract:ack` → 闸门放行

> 建议：把 `contract:check` 和 `contract:sync` 挂进 CI / pre-commit，机器兜底，不靠自觉。

---

## 6. 命令表

| 命令 | 作用 | 谁用 |
|---|---|---|
| `npm run contract:check` | 校验契约完整性（frozen 必须有 mock） | 阿服 / CI |
| `npm run contract:types` | 契约 → `types/api.d.ts` | 阿服（契约变更后） |
| `npm run contract:mock` | 起 mock 服务（默认 `:8788`） | **志帅（前端开发时）** |
| `npm run contract:diff` | 变更 diff + 写 CHANGELOG + 归档 | 阿服 |
| `npm run contract:sync` | 检查前端是否已同步最新契约 | **志帅（每日开工前）** |
| `npm run contract:ack` | 确认已同步 | **志帅** |

---

## 7. 铁律（违反即退回）

1. **契约没冻结（draft）不许开工**——猜出来的字段最后都要重写。
2. **前端不猜字段**：发现字段缺失/类型不对，**退回阿服补契约**，不要自己在前端兜。
3. **`types/api.d.ts` 禁止手改**——手改会在下次生成时被覆盖，改契约才是正路。
4. **Agent 不改前端代码**——只给契约、类型、mock、缺陷报告。
5. **交付物不完整要退回，不替别人补全。**

---

## 8. 当前状态

- 契约初版 `2026-10-13.1`：**24 个端点，全部 frozen**（由现有实现反推，字段精度由阿服逐条确认后冻结）。
- 已归档基线 `contracts/archive/api-2026-10-13.1.json`，`CHANGELOG.md` 已建。
- 新增端点一律先 `draft`，走完第 2 节流程再冻结。
