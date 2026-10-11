# 沸点创意 Boiling Point — 设计文档

> Superpowers Phase 1/2 · 需求澄清 + 设计验证
> 决策记录：品牌=**沸点创意 Boiling Point**；数据源=**双通道适配器（仿真 + 真实抓取）**；技术栈=**Umi+React 官网 / Taro4+React 移动 App / Electron 桌面端**

---

## 1. 公司与产品定位

**公司**：沸点创意（Boiling Point Creative）
**使命**：把「爆款」从玄学变成可拆解、可复用、可预测的工程问题。
**一句话**：每天告诉你，今天的抖音观众在为什么而停留。

品牌隐喻：**沸点** = 内容引爆的临界温度。我们做的事，就是测量并复现那个临界点。
品牌色：沸腾橙 `#FF5A1F` / 熔岩红 `#E8362B` / 深石墨 `#16181D`，辅助 数据蓝 `#2F6BFF`、热力黄 `#FFB020`。

### 三款产品（共用同一内核 + 同一 API）

| 产品 | 技术栈 | 定位 | 主力场景 |
|---|---|---|---|
| **沸点官网** `apps/web` | Umi 4 + React 18 + antd 5 | 品牌门面 + 数据门户 | SEO/获客/报告浏览/转化 |
| **沸点 App** `apps/mobile` | Taro 4 + React 18 | 创作者随身趋势雷达 | 每天 3 分钟看榜、选题灵感 |
| **沸点工作台** `apps/desktop` | Electron 44 | 团队生产力工具 | 深度拆解、批量导出、盯盘 |

---

## 2. 系统架构

```
┌──────────────── 数据源层 ────────────────┐
│  抖音公开热榜接口  │  第三方 API(Key)  │  仿真数据引擎  │
└────────┬──────────────┬──────────────┬───┘
         └──────────────▼──────────────┘
              Provider 适配器（CompositeProvider：真实优先，失败降级仿真）
                          │
                  ┌───────▼────────┐
                  │  packages/core │  沸点内核（零依赖 Node）
                  │  抓取→清洗→分析→标签→评分→报告
                  └───────┬────────┘
                     SQLite 持久化
                          │
                  ┌───────▼────────┐
                  │  server (8787) │  Node22 内置 http · 零依赖 · 每日定时
                  └───────┬────────┘
         ┌────────────────┼────────────────┐
      apps/web        apps/mobile       apps/desktop
      (Umi)         (Taro4+React)       (Electron)
```

**关键设计决策**

1. **内核零依赖**：`packages/core` 与 `server` 只用 Node 22 内置模块（`node:sqlite`、`node:test`）。安装成本≈0，任何机器都能跑。
2. **双通道数据源**：`CompositeProvider` 先尝试真实抓取，失败/空榜自动降级到 `SimulatedProvider`（按日期种子化的 40+ 条真实感视频池），保证演示与离线开发永远有数据。
3. **三端共用一份 API 契约**：前端不碰内核，只消费 `/api/*`。
4. **规则引擎优先，LLM 可选**：四维分析用可解释的规则 + 词典，结果稳定、可回归测试；`LLM_ENHANCE=1` 时才调用大模型润色结论（缺省关闭）。

---

## 3. 数据模型

```js
Video = {
  id,              // 视频唯一 id
  title,           // 标题/文案（抖音 desc）
  author: { id, nickname, fans },
  stats:  { play, digg, comment, share, collect },
  duration,        // 秒
  createTime,      // ISO
  cover, url,
  music:  { title, author },
  challenges: [String],
  source,          // 'douyin' | 'simulated'
  raw: {}
}
```

## 4. 四维分析引擎

每个维度输出：`{ tags: [{id,name,confidence,evidence}], summary }`

| 维度 | 分析内容 |
|---|---|
| **题材 topic** | 18 类一级题材：剧情演绎 / 搞笑段子 / 知识科普 / 美食 / 旅行 / 情感共鸣 / 颜值变装 / 科技数码 / 萌宠 / 亲子育儿 / 健身运动 / 职场 / 国风文化 / 汽车 / 游戏 / 三农 / 探店 / 时尚穿搭。关键词加权匹配 + 作者/话题/BGM 佐证 |
| **文案 copy** | 长度分档；句式（疑问/数字/悬念/命令/对比/第一人称）；黄金 3 秒钩子类型（提问/冲突/反转/承诺/情绪）；情绪极性与强度；关键词 2–4gram 提取；CTA 识别（关注/点赞/评论/购物车） |
| **节奏 rhythm** | 时长分档（超短<15s/短15–30s/中30–60s/长>60s）；语速（字/秒）；信息密度；三段式结构（钩子/铺垫/收尾）完整性 |
| **表现 craft** | 形式（口播/剧情表演/Vlog/图文轮播/卡点剪辑/第一视角/监控视角/街头采访）；手法（变装转场/字幕特效/分屏/慢动作/对比反差）；元素（BGM 类型/滤镜/贴纸/字幕样式）；互动设计（争议点/投票/悬念留白/彩蛋） |

**爆款指数 Boiling Score（0–100）**

```
score = 30×播放量分位 + 25×互动率分位 + 20×完播代理分位 + 15×涨粉效率分位 + 10×传播系数分位
```
分位指当日榜单内的相对位置，因此分数是「相对今日大盘」的可比指标。

## 5. 趋势报告结构

```js
Report = {
  date, generatedAt,
  top10: [ { video, analysis, boilingScore } ],
  distribution: { topic: [{name,count,share}], duration, emotion, rhythm },
  tagFrequencies: [ {tagId,name,dimension,count,totalPlay,deltaVsYesterday} ],
  rising: [...],   // 环比上升最快标签
  falling: [...],
  audienceInsight: {              // 「受众偏爱什么」
    topTopics: [...], hotTopics: [...], preferredDuration,
    preferredHooks: [...], emotionBias, summaryText
  },
  directions: [                   // 「创作方向」可执行选题
    { title, topic, hookTemplate, durationAdvice, craftAdvice, ctaAdvice, whyHot }
  ],
  markdown,                        // 预渲染 Markdown
}
```

## 6. API 契约（server · :8787）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 + provider 状态 |
| GET | `/api/today` | 今日 Top10 + 四维分析 + 爆款指数 |
| GET | `/api/report?date=YYYY-MM-DD` | 指定日期日报（默认今天） |
| GET | `/api/reports?limit=30` | 历史日报列表 |
| GET | `/api/tags` | 完整标签体系 |
| GET | `/api/trends?days=7` | 标签趋势序列 |
| GET | `/api/videos?date=&limit=` | 视频明细 |
| POST | `/api/run` | 手动触发一次抓取+分析+出报 |
| GET | `/api/stats` | 运行统计 |

统一响应：`{ ok: true, data }` / `{ ok: false, error: { code, message } }`；全部响应带 CORS 头，方便三端本地直连。

## 7. 目录结构

```
E:\opc
├── design.md / plan.md / review.md / final_report.md
├── package.json                 # npm workspaces
├── packages/core/               # 沸点内核（零依赖）
│   ├── src/{providers,analyzers,taxonomy,report,store,utils}
│   ├── test/*.test.js
│   └── bin/boiling.js           # CLI
├── server/                      # API 服务（零依赖）
├── apps/web/                    # Umi 官网
├── apps/mobile/                 # Taro 4 + React 18
└── apps/desktop/                # Electron
```

## 8. 假设与风险

| 假设 | 处理方式 |
|---|---|
| 抖音公开接口可能签名/反爬失效 | 双通道降级，真实失败自动切仿真并在响应中标记 `source` |
| 无法获取真实播放量绝对值 | 用榜单内相对分位 + 热度值代理，报告口径统一说明 |
| Electron 二进制下载受网络影响 | 桌面端安装失败时保留完整源码与启动说明，不影响其它两端 |
