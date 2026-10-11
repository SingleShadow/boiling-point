import { defineConfig } from 'umi';

export default defineConfig({
  base: '/web/',
  publicPath: '/web/',
  npmClient: 'npm',
  jsMinifier: 'esbuild',
  /**
   * 开发态把 /api 代理到本地后端（8787）。
   * 生产构建产物挂载在 /web/，后端在同域下，统一用相对路径 /api/... 即可。
   */
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true,
    },
  },
  // 主题 token 通过 src/layouts 的 antd <ConfigProvider> 注入（运行时，
  // 效果等同 umi antd 插件；避免额外依赖 preset-react）
});
