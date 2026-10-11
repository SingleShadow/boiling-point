import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { api } from '../../api'
import { COLORS, DIM_COLOR, DIM_NAME } from '../../theme'
import { formatDateCN, weekdayCN, recentDates, toDateKey } from '../../utils/format'
import BrandHeader from '../../components/BrandHeader'
import Card from '../../components/Card'
import StateView from '../../components/StateView'

function DirectionCard({ d, no }) {
  return (
    <View style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <View style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            background: COLORS.orange,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{no}</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{text(d.title)}</Text>
      </View>

      {d.whyHot ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 11, color: COLORS.orange }}>为什么热</Text>
          <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6, display: 'block', marginTop: 2 }}>
            {text(d.whyHot)}
          </Text>
        </View>
      ) : null}

      <View style={{ flexWrap: 'wrap' }}>
        <Line label="开头钩子" value={d.hookTemplate} color={COLORS.red} />
        <Line label="内容切角" value={d.angle} color={COLORS.blue} />
        <Line label="时长建议" value={d.durationAdvice} color={COLORS.yellow} />
        <Line label="表现手法" value={d.craftAdvice} color={COLORS.orange} />
        <Line label="结尾引导" value={d.ctaAdvice} color={COLORS.red} />
      </View>
    </View>
  )
}

function Line({ label, value, color }) {
  if (!value) return null
  return (
    <View style={{ display: 'flex', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: COLORS.sub, width: 64, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: color || COLORS.text, flex: 1, lineHeight: 1.6 }}>{text(value)}</Text>
    </View>
  )
}

function TagBoardRow({ t }) {
  const color = DIM_COLOR[t.dimension] || COLORS.orange
  const rising = t.delta > 0
  const falling = t.delta < 0
  const deltaColor = rising ? COLORS.orange : falling ? '#3FA376' : COLORS.sub
  return (
    <View
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '9px 0',
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <View style={{ width: 6, height: 16, borderRadius: 3, background: color, marginRight: 8 }} />
      <Text style={{ flex: 1, fontSize: 13.5, color: COLORS.text }}>{text(t.name)}</Text>
      <Text style={{ fontSize: 12, color: COLORS.sub, marginRight: 10 }}>{t.count} 次</Text>
      {t.isNew ? (
        <View style={{ padding: '1px 6px', borderRadius: 8, background: 'rgba(47,107,255,0.12)' }}>
          <Text style={{ fontSize: 11, color: COLORS.blue }}>新</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 12, color: deltaColor, width: 48, textAlign: 'right' }}>
          {rising ? '↑' : falling ? '↓' : '—'} {rising || falling ? Math.abs(t.delta) : ''}
        </Text>
      )}
    </View>
  )
}

export default function Report() {
  const router = useRouter()
  const initDate = router.params.date
  const [dates] = useState(() => recentDates(10))
  const [active, setActive] = useState(initDate || recentDates(10)[0])
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const load = (d) => {
    setActive(d)
    setStatus('loading')
    const todayKey = toDateKey(new Date())
    const fetchPromise = d && d !== todayKey ? api.report(d) : api.today()
    fetchPromise
      .then((res) => {
        setData(res)
        setStatus('success')
      })
      .catch((e) => {
        setErrMsg(e.message || '加载失败')
        setStatus('error')
      })
  }

  useEffect(() => {
    load(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tags = (data && data.tagFrequencies) || []
  const directions = (data && data.directions) || []

  return (
    <View style={{ minHeight: '100vh', background: COLORS.bg }}>
      <BrandHeader title="趋势报告" date={data && data.date} source={data && data.source} />

      {/* 日期横向切换 */}
      <View style={{ background: COLORS.card, paddingVertical: 10, borderBottom: `1px solid ${COLORS.border}` }}>
        <ScrollView scrollX style={{ whiteSpace: 'nowrap', paddingHorizontal: 12 }} showScrollbar={false}>
          {dates.map((d) => {
            const sel = d === active
            return (
              <View
                key={d}
                onClick={() => load(d)}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '6px 12px',
                  marginRight: 8,
                  borderRadius: 10,
                  background: sel ? COLORS.orange : COLORS.bg,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: sel ? '700' : '400', color: sel ? '#fff' : COLORS.text }}>
                  {formatDateCN(d)}
                </Text>
                <Text style={{ fontSize: 11, color: sel ? 'rgba(255,255,255,0.85)' : COLORS.sub, marginTop: 2 }}>
                  {weekdayCN(d)}
                </Text>
              </View>
            )
          })}
        </ScrollView>
      </View>

      {status !== 'success' || !data ? (
        <StateView status={status} onRetry={() => load(active)} errorText={errMsg} emptyText="该日期暂无报告" />
      ) : (
        <View style={{ padding: 12 }}>
          <Card title="创作方向建议">
            {directions.length === 0 ? (
              <Text style={{ fontSize: 13, color: COLORS.sub }}>暂无方向建议</Text>
            ) : (
              directions.map((d, i) => <DirectionCard key={i} d={d} no={d.no || i + 1} />)
            )}
          </Card>

          <Card title="标签热度榜（环比）">
            {tags.length === 0 ? (
              <Text style={{ fontSize: 13, color: COLORS.sub }}>暂无标签数据</Text>
            ) : (
              tags.map((t, i) => <TagBoardRow key={i} t={t} />)
            )}
          </Card>
        </View>
      )}
    </View>
  )
}

function text(v, fb = '-') {
  return v === null || v === undefined || v === '' ? fb : v
}
