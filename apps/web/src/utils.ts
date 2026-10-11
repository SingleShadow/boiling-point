// 通用工具：数字格式化、等级配色、分数配色
export function formatNum(n?: number): string {
  if (n == null || isNaN(n)) return '-';
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return String(n);
}

export function formatPlay(n?: number): string {
  return formatNum(n);
}

// 等级 → 配色
export const GRADE_COLOR: Record<string, { bg: string; color: string }> = {
  S: { bg: 'linear-gradient(135deg,#FF5A1F,#E8362B)', color: '#fff' },
  A: { bg: '#FFE9DF', color: '#FF5A1F' },
  B: { bg: '#FFF4D6', color: '#C77B00' },
  C: { bg: '#EEF0F3', color: '#8A919F' },
};

// 爆款指数 0-100 → 颜色（热力梯度）
export function scoreColor(score: number): string {
  if (score >= 80) return '#E8362B';
  if (score >= 65) return '#FF5A1F';
  if (score >= 50) return '#FFB020';
  return '#2F6BFF';
}

// 维度 → 配色（题材/文案/节奏/表现）
export const DIM_COLOR: Record<string, string> = {
  topic: '#FF5A1F',
  copy: '#2F6BFF',
  rhythm: '#FFB020',
  craft: '#E8362B',
};
export const DIM_NAME: Record<string, string> = {
  topic: '题材',
  copy: '文案',
  rhythm: '节奏',
  craft: '表现手法',
};
