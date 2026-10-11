# 沸点创意 Boiling Point · 移动端 App

抖音爆款内容每日拆解与趋势报告系统的移动端（H5 / 小程序）。原 uni-app（Vue3）版本已重写为 **Taro 4 + React 18**。

## 技术栈

- **Taro `4.2.1`**（H5 + 微信小程序）
- **React `18` + react-dom `18`**
- 构建：`@tarojs/webpack5-runner` + `@tarojs/cli`
- 样式：内联 style（px / %）+ 全局 `src/app.css`，未引入图表库（条形图 / 环形进度用 `View` + `conic-gradient` / 宽度百分比实现），保持产物轻量
- 网络：`Taro.request` 封装于 `src/api/index.js`，后端已开启 CORS

> 本工程使用 **Taro 4** 实现，未触发降级方案。

## 目录结构

```
apps/mobile
├── .npmrc                # npmmirror 镜像
├── babel.config.js
├── config/               # index / dev / prod（h5.publicPath='/app/'，router.mode='hash'）
├── src
│   ├── app.config.js     # pages + tabBar（今日 / 报告 / 我的）
│   ├── app.js / app.css
│   ├── index.html        # H5 入口模板
│   ├── config.js         # API_BASE（localhost:8787/api）
│   ├── theme.js          # 设计系统色值
│   ├── api/index.js      # 接口封装（统一 {ok,data} 响应）
│   ├── utils/format.js   # 万/亿 格式化、日期等
│   ├── components/       # Card / StateView / ScoreRing / TagChip / BarRow / CollapsePanel / BrandHeader / DimensionBlock
│   └── pages/
│       ├── index/        # 今日趋势（启动页）
│       ├── detail/       # 拆解详情
│       ├── report/       # 趋势报告
│       ├── tags/         # 标签体系
│       └── mine/         # 我的
```

## 安装依赖

> 工程是 npm workspace 成员。若作为独立工程安装（避免触碰根 monorepo），使用：

```bash
cd apps/mobile
npm install --no-workspaces
```

若在根目录统一安装（会安装全部 workspace）：

```bash
npm install
```

## 开发（H5）

```bash
npm run dev:h5          # 启动 H5 开发服务器（默认 http://localhost:10086）
```

## 构建（H5）

```bash
npm run build:h5        # 产物输出到 apps/mobile/dist/index.html
```

构建配置已设置 `h5.publicPath = '/app/'` 与 `h5.router.mode = 'hash'`，因此刷新子页面与静态资源均不会 404。

## 预览

后端（http://localhost:8787）已将 `apps/mobile/dist` 挂在 `/app/` 路径下，构建后直接访问：

```
http://localhost:8787/app/
```

真机调试：把 `src/config.js` 中的 `API_BASE` 由 `localhost` 改为运行后端的局域网 IP（如 `http://192.168.x.x:8787/api`），并确保手机与电脑同局域网、后端已开 CORS。

## 编译到微信小程序

```bash
npm run build:weapp     # 产物输出到 apps/mobile/dist（微信小程序工程）
```

用「微信开发者工具」导入 `apps/mobile/dist` 目录即可预览 / 上传。

> 说明：H5 端尺寸统一使用 px / % 以规避 rpx 内联样式转换差异；如需更精细的小程序多端适配，可将关键尺寸改为 `rpx`。

## 降级方案（备用，当前未启用）

若 Taro 4 在某环境反复构建失败，可改用 **Vite + React 18** 构建移动 Web：保留同样的页面结构与 `src/api` 适配层，仅把 `src/api/index.js` 中的 `Taro.request` 替换为 `fetch` 实现，页面代码基本不变，仍产出 `apps/mobile/dist/index.html`。触发条件与回退步骤见根目录 `plan.md`。
