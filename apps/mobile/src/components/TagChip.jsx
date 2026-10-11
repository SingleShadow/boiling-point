import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'
import { pct } from '../utils/format'

// 标签 chip：可选置信度（0-1）与维度色
export default function TagChip({ name, confidence, color = COLORS.orange, size = 'md' }) {
  const fontSize = size === 'sm' ? 11 : 12
  const padY = size === 'sm' ? 3 : 5
  const padX = size === 'sm' ? 8 : 10
  const showConf = confidence !== undefined && confidence !== null

  return (
    <View
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${padY}px ${padX}px`,
        borderRadius: 14,
        background: color + '14', // 10% 透明度底色
        border: `1px solid ${color}33`,
        margin: '0 6px 6px 0',
        lineHeight: 1.2,
      }}
    >
      <Text style={{ fontSize, color }}>{name}</Text>
      {showConf ? (
        <Text style={{ fontSize: fontSize - 1, color: COLORS.sub, marginLeft: 4 }}>
          {pct(confidence)}%
        </Text>
      ) : null}
    </View>
  )
}
