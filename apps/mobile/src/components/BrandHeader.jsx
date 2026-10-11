import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'
import { formatDateCN, weekdayCN } from '../utils/format'

// 顶部品牌头：沸点创意 + 标题 + 日期 + 数据源角标
// source: 'simulated' | 'douyin' | undefined
export default function BrandHeader({ title, date, source }) {
  const isSim = source === 'simulated'
  return (
    <View
      style={{
        background: COLORS.graphite,
        padding: '16px 16px 14px',
      }}
    >
      <View style={{ display: 'flex', alignItems: 'center' }}>
        <View
          style={{
            width: 8,
            height: 18,
            borderRadius: 4,
            background: COLORS.orange,
            marginRight: 8,
          }}
        />
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>沸点创意</Text>
        <Text style={{ fontSize: 13, color: '#C9CDD4', marginLeft: 8 }}>· {title}</Text>
        {isSim ? (
          <View
            style={{
              marginLeft: 'auto',
              padding: '3px 9px',
              borderRadius: 10,
              background: 'rgba(255,176,32,0.18)',
              border: '1px solid rgba(255,176,32,0.5)',
            }}
          >
            <Text style={{ fontSize: 11, color: COLORS.yellow }}>演示数据</Text>
          </View>
        ) : null}
      </View>
      {date ? (
        <View style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: '#8A919F' }}>
            {formatDateCN(date)} {weekdayCN(date)}
          </Text>
          {source && !isSim ? (
            <Text style={{ fontSize: 11, color: '#5B6270', marginLeft: 8 }}>· 数据来源：抖音</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
