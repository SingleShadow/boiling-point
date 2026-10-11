// 沸点创意设计系统 —— 颜色与基础常量
// 说明：H5 端样式统一用 px / %（内联 style），避免依赖 rpx 转换；
// 如需编译小程序，可将数值改为 rpx 或引入对应的尺寸函数。
export const COLORS = {
  orange: '#FF5A1F', // 沸腾橙（主）
  red: '#E8362B', // 熔岩红
  graphite: '#16181D', // 深石墨
  blue: '#2F6BFF', // 数据蓝
  yellow: '#FFB020', // 热力黄
  bg: '#F7F8FA', // 背景
  card: '#FFFFFF', // 卡片
  text: '#1F2329', // 主文字
  sub: '#8A919F', // 次要文字
  border: '#E5E6EB', // 边框
}

// 等级配色
export const GRADE_COLOR = {
  S: COLORS.red,
  A: COLORS.orange,
  B: COLORS.yellow,
  C: COLORS.sub,
}

// 四个维度的主题色（用于标签 / 图表）
export const DIM_COLOR = {
  topic: COLORS.orange,
  copy: COLORS.blue,
  rhythm: COLORS.yellow,
  craft: COLORS.red,
}

export const DIM_NAME = {
  topic: '题材',
  copy: '文案',
  rhythm: '节奏',
  craft: '表现手法',
}

export const RADIUS = 12
export const GAP = 12
