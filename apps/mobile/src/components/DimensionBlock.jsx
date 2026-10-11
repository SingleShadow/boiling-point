import { View, Text } from '@tarojs/components'
import { COLORS, DIM_COLOR, DIM_NAME } from '../theme'
import TagChip from './TagChip'

// 指标中文标签映射（覆盖四个维度可能出现的 key）
const METRIC_LABELS = {
  primary: '主导题材',
  length: '文案字数',
  lengthBand: '长度区间',
  sentenceCount: '句数',
  patterns: '句式',
  hook: '开头钩子',
  emotion: '情绪',
  polarity: '倾向',
  intensity: '强度',
  cta: '行动引导',
  keywords: '关键词',
  duration: '时长',
  durationBand: '时长区间',
  speed: '节奏速度',
  density: '信息密度',
  structureComplete: '结构完整度',
  form: '表现形式',
  techniques: '手法',
  interactions: '互动设计',
}

function MetricRow({ label, children }) {
  return (
    <View style={{ display: 'flex', marginBottom: 8 }}>
      <Text
        style={{
          width: 76,
          fontSize: 12,
          color: COLORS.sub,
          flexShrink: 0,
          lineHeight: 1.6,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, flexWrap: 'wrap' }}>{children}</View>
    </View>
  )
}

// 渲染单个指标值，返回 React 节点
function renderValue(key, value, color) {
  const label = METRIC_LABELS[key] || key

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <MetricRow label={label} key={key}>
        {value.map((item, i) => {
          let name = ''
          if (item && typeof item === 'object') name = item.name || item.word || item.id || ''
          else name = String(item)
          if (!name) return null
          return (
            <TagChip key={i} name={name} size="sm" color={color} />
          )
        })}
      </MetricRow>
    )
  }

  if (value && typeof value === 'object') {
    // 含 name 的对象（如 hook / primary）直接展示名称
    if (value.name) {
      return (
        <MetricRow label={label} key={key}>
          <Text style={{ fontSize: 12, color: COLORS.text }}>{String(value.name)}</Text>
        </MetricRow>
      )
    }
    const parts = Object.entries(value).map(([k, v]) => {
      const l = METRIC_LABELS[k] || k
      if (v && typeof v === 'object') return `${l}: ${JSON.stringify(v)}`
      return `${l}: ${v}`
    })
    return (
      <MetricRow label={label} key={key}>
        <Text style={{ fontSize: 12, color: COLORS.text }}>{parts.join(' · ')}</Text>
      </MetricRow>
    )
  }

  if (value === '' || value === null || value === undefined) return null
  return (
    <MetricRow label={label} key={key}>
      <Text style={{ fontSize: 12, color: COLORS.text }}>{String(value)}</Text>
    </MetricRow>
  )
}

// 单个维度区块：题材 / 文案 / 节奏 / 表现手法
export default function DimensionBlock({ dimKey, data }) {
  const color = DIM_COLOR[dimKey] || COLORS.orange
  const title = DIM_NAME[dimKey] || dimKey
  if (!data) return null

  const tags = data.tags || []
  const metrics = data.metrics || {}
  const summary = data.summary

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 4,
            height: 16,
            borderRadius: 2,
            background: color,
            marginRight: 8,
          }}
        />
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{title}</Text>
      </View>

      {data.primary ? (
        <View style={{ flexWrap: 'wrap', marginBottom: tags.length > 0 ? 4 : 0 }}>
          <TagChip name={data.primary.name} color={color} />
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={{ flexWrap: 'wrap', marginBottom: 4 }}>
          {tags.map((t, i) => (
            <TagChip
              key={i}
              name={t.name}
              confidence={t.confidence}
              color={color}
              size="sm"
            />
          ))}
        </View>
      ) : null}

      {Object.entries(metrics).map(([k, v]) => renderValue(k, v, color))}

      {summary ? (
        <View
          style={{
            marginTop: 8,
            padding: 10,
            background: COLORS.bg,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 12.5, color: COLORS.text, lineHeight: 1.6 }}>{summary}</Text>
        </View>
      ) : null}
    </View>
  )
}
