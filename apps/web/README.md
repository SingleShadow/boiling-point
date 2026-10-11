# 沸点创意 Boiling Point · 官网 / 数据门户

抖音爆款内容每日拆解与趋势报告系统的官方网站，基于 **Umi 4 + React 18 + antd 5**。

## 技术栈

- 构建：Umi 4.7.17（约定式路由、webpack/mfsu）
- UI：antd 5.29.3 + @ant-design/icons + React 18
- Markdown：`marked`（报告渲染，约 30KB）
- 图表：全部为内联 SVG / CSS 自绘（环形、柱状、横向条形、置信度进度条），未引入 echarts/antv

## 目录结构

```
apps/web/
├─ .umirc.ts            # base/publicPath=/web/、/api 代理、主题说明
├─ .npmrc               # 使用 npmmirror 镜像（默认 registry 在本机极慢）
├─ tsconfig.json
├─ package.json         # @boiling/web
└─ src/
   ├─ global.less        # 设计系统 token（品牌色/圆角/阴影/字体）
   ├─ api.ts             # 统一 API 封装（相对路径 /api/...）
   ├─ utils.ts           # 数字格式化 / 等级与分数配色
   ├─ components/
   │  ├─ Charts.tsx       # 内联 SVG 图表
   │  └─ Markdown.tsx     # marked 渲染
   ├─ layouts/index.tsx   # 导航 + Footer + antd <ConfigProvider> 主题注入
   └─ pages/
      ├─ index.tsx        # 首页 /
      ├─ trend.tsx        # 今日趋势 /trend
      ├─ report.tsx       # 趋势报告 /report
      ├─ tags.tsx         # 标签体系 /tags
      └─ about.tsx        # 关于我们 /about
```

## 快速开始

```bash
# 1. 安装依赖（已配置 apps/web/.npmrc 走 npmmirror 镜像）
npm install          # 或 npm --workspace apps/web install

# 2. 开发（需要后端 8787 在跑；/api 由 umi proxy 转发）
npm run dev          # 浏览器访问 http://localhost:8000/web/

# 3. 构建
npm run build        # 产物输出到 apps/web/dist

# 4. 预览构建产物（需后端把 dist 挂在 /web/ 并提供 SPA fallback）
npm run preview
```

## 说明

- **路由 base 为 `/web/`**：生产构建产物由 Node 服务挂在 `/web/` 路径下，
  `index.html` 内资源均引用 `/web/...`，页面内所有接口统一使用相对路径 `/api/...`，
  因此开发态（proxy）与生产态（同域）表现一致。
- **主题**：品牌色 `#FF5A1F` 等通过 `src/layouts/index.tsx` 中的 antd
  `<ConfigProvider theme.token>` 注入（运行时注入，效果等同 umi antd 插件，
  避免额外依赖 `@umijs/preset-react`）。
- **API**：所有数据来自 `http://localhost:8787/api`（见 `src/api.ts`），
  统一响应 `{ ok, data }` / `{ ok:false, error }`。
