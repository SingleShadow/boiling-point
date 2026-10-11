import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'

// 横向条形行：用于题材分布 / 标签榜等
// value 相对 max 计算占比；valueText 为右侧展示文本
export default function BarRow({
  label,
  value = 0,
  max = 1,
  color = COLORS.orange,
  valueText,
  bold = false,
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const pctWidth = (ratio * 100).toFixed(1)

  return (
    <View style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
      <Text
        style={{
          width: 84,
          fontSize: 13,
          color: COLORS.text,
          flexShrink: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          height: 10,
          background: COLORS.bg,
          borderRadius: 5,
          overflow: 'hidden',
          margin: '0 10px',
        }}
      >
        <View
          style={{
            width: pctWidth + '%',
            height: '100%',
            background: color,
            borderRadius: 5,
          }}
        />
      </View>
      <Text
        style={{
          width: 56,
          fontSize: 12,
          color: bold ? color : COLORS.sub,
          textAlign: 'right',
          flexShrink: 0,
          fontWeight: bold ? '700' : '400',
        }}
      >
        {valueText != null ? valueText : value}
      </Text>
    </View>
  )
}
