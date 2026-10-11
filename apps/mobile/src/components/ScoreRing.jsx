import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'

// 爆款指数环形进度（纯 View + conic-gradient，H5 生效）
// score: 0-100
export default function ScoreRing({
  score = 0,
  size = 96,
  color = COLORS.orange,
  showLabel = true,
}) {
  const s = Math.max(0, Math.min(100, Number(score) || 0))
  const track = '#EDEFF3'

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${s}%, ${track} 0)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <View
        style={{
          width: size - 14,
          height: size - 14,
          borderRadius: '50%',
          background: COLORS.card,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.28, fontWeight: '800', color, lineHeight: 1 }}>
          {s}
        </Text>
        {showLabel ? (
          <Text style={{ fontSize: 11, color: COLORS.sub, marginTop: 2 }}>爆款指数</Text>
        ) : null}
      </View>
    </View>
  )
}
