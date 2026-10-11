import { View, Text } from '@tarojs/components'
import { COLORS, RADIUS } from '../theme'

// 通用卡片容器
export default function Card({ title, extra, children, style, bodyStyle }) {
  return (
    <View
      style={{
        background: COLORS.card,
        borderRadius: RADIUS,
        padding: 16,
        marginBottom: 12,
        border: `1px solid ${COLORS.border}`,
        ...style,
      }}
    >
      {title ? (
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          {typeof title === 'string' ? (
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>{title}</Text>
          ) : (
            title
          )}
          {extra}
        </View>
      ) : null}
      <View style={bodyStyle}>{children}</View>
    </View>
  )
}
