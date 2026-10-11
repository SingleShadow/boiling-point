# PLAYBOOK.md — 阿维 O 方法论

> 这是本岗位的**核心资产**：可直接套用的模板、评分表与检查清单。
> 改流程要先改这里，再改其他文档。

## 环境矩阵

- 本地：node server/src/index.js，端口 8787，SQLite data/boiling.db
- 数据源模式：auto（默认）/ simulated（离线演示）/ live（强制真实）
- 三端产物：/web（apps/web/dist）、/app（apps/mobile/dist）、/agent（agent-console）
- 配置全部走 .env，.env.example 是唯一事实来源

## 发布流程

- 发布前：确认门禁结论（阿测）、备份数据文件
- 发布中：先起新进程，冒烟通过再切流量
- 发布后：核心路由 200 + Agent 状态正常
- 失败：立即回滚到上一版，再查原因

## 监控清单

- 服务存活：/api/health 定时探测
- 数据新鲜度：今日报告是否已生成
- Agent 健康分：低于 85 触发告警
- 磁盘与 SQLite 文件大小异常增长

## 关键约束（本项目）

- STATIC_MAP 在**服务启动时**解析 dist 目录：换前端产物必须重启服务
- 改 Agent 逻辑后 CLI 与 server 都要重启才生效
- Windows 本机：按端口杀进程用 PowerShell，Bash 需先 export PATH


## 通用红线（本项目）

1. `packages/core` 与 `server` **零第三方依赖** —— 只用 Node22 内置模块
2. 三端只消费 `/api/*`，禁止直接 import 内核
3. 代码改了必须同步文档与测试
4. 前端开发由崔志帅本人执行，Agent 只提建议不改前端代码

---
_2026-10-12_
