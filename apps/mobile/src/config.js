// 后端 API 基础地址
//
// 本机开发 / 预览：后端跑在 http://localhost:8787，H5 站点挂在 /app/ 子路径下，
// 所以页面与接口同源（localhost:8787），无需跨域。
//
// 真机调试：把 localhost 换成运行后端的「局域网 IP」，例如：
//   export const API_BASE = 'http://192.168.1.10:8787/api'
// 同时确认后端已开启 CORS（项目已开启），且手机与电脑在同一局域网。
export const API_BASE = 'http://localhost:8787/api'

// 页面挂在 /app/ 下，公共静态资源前缀需与 config/index.js 的 h5.publicPath 保持一致
export const PUBLIC_PATH = '/app/'
