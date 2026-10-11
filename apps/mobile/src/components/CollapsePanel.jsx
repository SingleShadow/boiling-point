import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'

// 可折叠面板（维度明细默认收起，便于长列表阅读）
export default function CollapsePanel({
  title,
  defaultOpen = false,
  children,
  extra,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <View
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 10,
      }}
    >
      <View
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: COLORS.bg,
        }}
      >
        <View style={{ display: 'flex', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>
            {title}
          </Text>
          {extra}
        </View>
        <Text style={{ fontSize: 12, color: COLORS.sub }}>{open ? '收起 ▲' : '展开 ▼'}</Text>
      </View>
      {open ? (
        <View style={{ padding: 12, background: COLORS.card }}>{children}</View>
      ) : null}
    </View>
  )
}
