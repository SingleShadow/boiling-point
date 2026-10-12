# 标题体检工具 · 0 预算部署指南

本工具已**纯前端化**：打分逻辑在浏览器本地算完（不传你的标题到任何服务器），
只有「留邮箱」会 POST 到 Formspree（在 `index.html` 顶部配置表单 ID，无需服务器）。因此整套可以免费、零运维地托管在静态平台。

## 目录结构（部署时把本目录作为站点根）

```
tools/title-score/
├─ index.html         # 页面
├─ engine.js          # 打分逻辑（window.TitleEngine，由 packages/core/src/scorer/title.js 派生）
├─ baseline.json      # 真实 B站热门 Top50 基准快照（决定打分口径）
├─ api/subscribe.js   # 留资 serverless 函数（Vercel）
└─ vercel.json
```

## 方式一：GitHub Pages（本项目实际部署，0 预算、免新账号）✅

站点已上线：**https://singleshadow.github.io/boiling-point/**

- 站点内容在仓库的 `gh-pages` 分支（仅含 `tools/title-score/` 作为站点根）。
- 每次推送 `master` 且改动 `tools/title-score/**` 时，GitHub Actions（`.github/workflows/deploy-pages.yml`）自动同步部署到 `gh-pages`，无需手动操作。
- 留资走 Formspree（前端直发，见下）。

### 接好「留邮箱」（一次性，约 2 分钟）

1. 去 https://formspree.io 免费注册 → 新建表单 → 复制表单 ID（表单 URL 里 `/f/` 后面那段，形如 `xabcd123`）。
2. 打开 `tools/title-score/index.html`，把脚本顶部的
   `const FORMSPREE_FORM_ID = 'YOUR_FORMSPREE_FORM_ID';`
   改成你的 ID，例如 `const FORMSPREE_FORM_ID = 'xabcd123';`
3. 提交并推送：`git add tools/title-score/index.html && git commit -m "chore: 配置 Formspree" && git push`
   → Actions 自动重新部署，约 1 分钟后生效。
4. 打开站点测试留资，去 Formspree 后台确认收到（免费版 50 封/月）。

> 没填 ID 时，订阅按钮会提示「留资接口还没配置」，页面其余功能完全正常。

## 方式二：Vercel（备选，免费额度足够验证期）

1. 把 `tools/title-score/` 整个目录推到一个 GitHub 仓库（或 Fork 后直接拖进去）。
2. 在 Vercel 新建项目，**根目录（Root Directory）选 `tools/title-score`**。
3. Framework Preset 选 `Other`，Build Command 留空，Output 默认即可（vercel.json 已配）。
4. 部署完就有公网 URL，打开即用。

### 接好「留邮箱」

函数 `api/subscribe.js` 默认只 `console.log`，不留痕。要真收到线索，二选一（在 Vercel 项目 → Settings → Environment Variables 里加）：

- **Telegram（免费、即时，推荐）**
  - 找 @BotFather 建个 bot，拿到 `TELEGRAM_BOT_TOKEN`
  - 给 bot 发条消息，再访问 `https://api.telegram.org/bot<TOKEN>/getUpdates` 拿到你的 `chat_id`
  - 加变量：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`
- **Formspree（网页后台看，免费 50 条/月）**
  - 在 formspree.io 建表单，拿到表单 ID（URL 里的 `f/xxxx`）
  - **Vercel 路径**：加环境变量 `FORMSPREE_ID=xxxx`
  - **GitHub Pages 路径**：不用环境变量，直接在 `index.html` 顶部填 `FORMSPREE_FORM_ID`（见方式一）

> 两者都不配也能跑，只是留资只打印在 Vercel 函数日志里，看不到。

## 方式二：Netlify / Cloudflare Pages

- 静态部分同上，把 `index.html / engine.js / baseline.json` 作为站点根部署即可。
- 留资函数需换成对应平台的 Functions（Netlify 放 `netlify/functions/subscribe.js`，Cloudflare 用 Pages Functions `/api/subscribe.js`）。
  逻辑直接复用 `api/subscribe.js` 的转发部分，按平台签名微调即可。
- Netlify 还可加 `netlify.toml`：
  ```toml
  [build]
    publish = "."
  ```

## 让基准「每日更新」（可选，仍 0 预算）

`baseline.json` 是固定快照。想让它每天刷新，用 GitHub Actions 定时跑生成脚本即可：

```yaml
# .github/workflows/refresh-baseline.yml
name: refresh-baseline
on:
  schedule: [{ cron: "0 1 * * *" }]   # 每天 UTC 1 点（北京 9 点）
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node scripts/refresh-baseline.mjs   # 抓取 B站热门并重写 baseline.json
      - run: |
          git config user.email "bot@local" && git config user.name "bot"
          git add tools/title-score/baseline.json && git commit -m "chore: daily baseline" && git push
```

> 验证期手动偶尔刷新就够，不必一上来就接自动化。

## 注意

- 页面里写「标题不出浏览器」是实话：打分全程在本地，只有订阅才会联网。
- 改了 `packages/core/src/scorer/title.js` 的打分逻辑后，要重新生成 `engine.js`：
  `node scripts/gen-engine.mjs`（仓库根 `scripts/`）。
- 本地预览：用任意静态服务器打开本目录即可（如 `npx serve .`），订阅会 502（因本地没有 serverless 函数），属正常。
