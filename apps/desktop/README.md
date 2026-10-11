# 沸点创意 Boiling Point · 桌面工作台（Electron）

跨平台桌面应用，连接独立运行的后端 API（`http://localhost:8787`），为创作者提供抖音爆款 TOP10 的**每日趋势报告工作台**。本应用**不内嵌后端**，只做前端工作台。

## 功能

- **今日看板**：后端连接状态灯、日期选择器、「立即抓取 / 导出报告 / 测试通知」按钮；受众偏爱洞察卡、题材分布条形图、TOP10 表格，点击行展开四维拆解（题材 / 文案 / 节奏 / 表现手法，含标签置信度与关键指标）。
- **爆款拆解**：单条视频的四维大卡片，「复制拆解结论」（原生剪贴板）+「打开原视频」（原生外链）。
- **趋势报告**：历史日期列表 + 手写简易 Markdown 渲染（h1–h3 / 表格 / 列表 / 粗体 / 引用 / 分隔线）。
- **标签体系**：题材 / 文案 / 节奏 / 表现手法 四维标签卡片，顶部搜索框过滤。
- **系统状态**：`/api/health` + `/api/stats`、数据源模式说明、一键启动 / 停止后端并实时显示日志。

## 原生能力

1. **导出报告**：`dialog.showSaveDialog` + `fs.writeFile` 把当日 Markdown 存成 `.md`（`ipcMain.handle('export-report')`）。
2. **桌面通知**：`new Notification({title:'沸点创意', body:'今日趋势报告已更新'})`，「测试通知」按钮触发，启动连上后端且当天已有报告时提示一次。
3. **剪贴板**：`clipboard.writeText` 复制拆解结论（`ipcMain.handle('copy-text')`）。
4. **打开外链**：`shell.openExternal` 打开原始视频链接。
5. **一键后端**：`child_process.spawn` 启动 `node server/src/index.js`（相对项目根）。

## 环境要求

- Node.js ≥ 22.5（后端为 Node 22 内置 `node:sqlite` + `http`，零第三方依赖）
- Electron 44.3.0（仅开发依赖）

## 安装与运行

```bash
# 1) 安装依赖（在仓库根目录，npm workspaces 会自动处理）
npm install

# 2) 启动后端（另开一个终端，或在工作台「系统状态」点击「启动后端」）
npm run server          # = node server/src/index.js  → http://localhost:8787

# 3) 启动桌面工作台
npm run desktop:dev     # = npm --workspace apps/desktop run start  = electron .
```

> 也可直接进入 `apps/desktop` 目录执行 `npm install && npm start`。

## 在无 Electron 环境下验证（降级方案）

本渲染页**只依赖 `fetch` + 后端 CORS**，因此无需 Electron 也能验证界面：

1. 先启动后端：`node server/src/index.js`（确保 `http://localhost:8787` 可访问）。
2. 直接用浏览器打开 `apps/desktop/src/renderer/index.html` 即可（建议用本地静态服务器以保持 `file://` 行为一致，例如 `npx serve apps/desktop/src/renderer`）。
3. 页面会在加载时自动请求 `/api/today`；连不上后端时显示离线提示而非崩溃。

## 目录结构

```
apps/desktop/
├── package.json          # name @boiling/desktop, main src/main.js, scripts start/dev
├── src/
│   ├── main.js           # 主进程：窗口/菜单/托盘/IPC/后端进程管理
│   ├── preload.js        # contextIsolation 白名单桥接 window.bpApi
│   └── renderer/
│       ├── index.html    # 单页工作台骨架（深色侧边栏 + 浅色内容区）
│       ├── styles.css    # 设计系统（沸腾橙 #FF5A1F 等品牌色）
│       └── app.js        # 原生 JS 逻辑（5 视图 + fetch + 手写 Markdown）
└── README.md
```

## 后端 API 速览（Base `http://localhost:8787/api`）

统一响应 `{ ok: true, data }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 服务健康 / 统计 / 数据源模式 |
| GET | `/today?date=YYYY-MM-DD` | 当日报告（TOP10、分布、受众、方向、Markdown） |
| GET | `/report?date=` | 指定日期报告 |
| GET | `/reports?limit=30` | 历史报告列表 |
| GET | `/tags` | 四维标签体系 |
| GET | `/trends?days=7` | 标签趋势序列 |
| GET | `/stats` | 运行统计 |
| POST | `/run` | 手动触发一次抓取分析 |
| POST | `/backfill` | 回溯生成最近 N 天 |

## 设计系统

沸腾橙 `#FF5A1F`（主）、熔岩红 `#E8362B`、深石墨 `#16181D`、数据蓝 `#2F6BFF`、热力黄 `#FFB020`；背景 `#F7F8FA`、卡片 `#FFFFFF`、主文字 `#1F2329`、次要 `#8A919F`、边框 `#E5E6EB`、圆角 12px。

## 备注

- 主进程与预加载脚本为 CommonJS（`require`），无需 `"type":"module"`，与 Electron 兼容最佳。
- 后端文件数据库位于仓库根 `data/boiling.db`，首次启动会自动为当天生成演示数据（仿真模式）。
