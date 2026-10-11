import Taro from '@tarojs/taro'
import { API_BASE } from '../config'

// 统一请求封装：基于 Taro.request（H5 端同源 + 已开 CORS）
// 后端约定响应：{ ok:true, data } / { ok:false, error:{ code, message } }
async function request(path, params) {
  let res
  try {
    res = await Taro.request({
      url: API_BASE + path,
      method: 'GET',
      data: params || {},
      header: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })
  } catch (e) {
    // 网络层错误（无响应 / 超时 / 跨域被拒）
    throw new Error(e && e.errMsg ? e.errMsg : '网络请求失败')
  }

  const body = res && res.data
  if (body && body.ok === true) return body.data
  if (body && body.ok === false) {
    const err = body.error || {}
    throw new Error(err.message || '请求失败')
  }
  // 兜底：部分端点可能直接返回数据（无 ok 包裹）
  return body
}

export const api = {
  // 当日报告（缺省今天）
  today: (date) => request('/today', date ? { date } : {}),
  // 历史某天报告
  report: (date) => request('/report', { date }),
  // 历史报告列表
  reports: (limit = 30) => request('/reports', { limit }),
  // 标签体系
  tags: () => request('/tags'),
  // 标签趋势
  trends: (days = 7) => request('/trends', { days }),
  // 系统健康 / 状态
  health: () => request('/health'),
}

export default api
