import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { api } from '../../api'
import { COLORS } from '../../theme'
import { formatCount, formatDateCN, weekdayCN } from '../../utils/format'
import BrandHeader from '../../components/BrandHeader'
import Card from '../../components/Card'
import BarRow from '../../components/BarRow'
import ScoreRing from '../../components/ScoreRing'
import StateView from '../../components/StateView'

function RankBadge({ rank }) {
  const top = rank <= 3
  const bg = rank === 1 ? COLORS.red : rank === 2 ? COLORS.orange : rank === 3 ? COLORS.yellow : COLORS.bg
  const color = top ? '#fff' : COLORS.sub
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: 10,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color }}>{rank}</Text>
    </View>
  )
}

function MetricCell({ label, value, color }) {
  return (
    <View
      style={{
        flex: 1,
        background: COLORS.bg,
        borderRadius: 8,
        padding: '10px 8px',
        margin: '0 4px 8px 0',
      }}
    >
      <Text style={{ fontSize: 11, color: COLORS.sub, display: 'block' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: color || COLORS.text, display: 'block', marginTop: 4 }}>
        {value}
      </Text>
    </View>
  )
}

export default function Index() {
  const router = useRouter()
  const date = router.params.date
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const load = () => {
    setStatus('loading')
    api
      .today(date)
      .then((d) => {
        setData(d)
        setStatus('success')
      })
      .catch((e) => {
        setErrMsg(e.message || '加载失败')
        setStatus('error')
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status !== 'success' || !data) {
    return (
      <View style={{ minHeight: '100vh', background: COLORS.bg }}>
        <BrandHeader title="今日趋势" date={date} source={data && data.source} />
        <StateView status={status} onRetry={load} errorText={errMsg} emptyText="今日报告尚未生成" />
      </View>
    )
  }

  const { source, top10 = [], distribution = {}, audienceInsight = {} } = data
  const topicDist = distribution.topic || []
  const maxPlay = Math.max(1, ...topicDist.map((t) => t.totalPlay || 0))
  const ai = audienceInsight

  const goDetail = (v) => {
    Taro.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(v.id)}&date=${encodeURIComponent(date || data.date || '')}`,
    })
  }

  return (
    <View style={{ minHeight: '100vh', background: COLORS.bg, paddingBottom: 12 }}>
      <BrandHeader title="今日趋势" date={data.date} source={source} />

      <View style={{ padding: 12 }}>
        {/* 受众偏爱 */}
        <Card title="今日受众偏爱什么">
          {ai.summaryText ? (
            <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>{ai.summaryText}</Text>
          ) : (
            <Text style={{ fontSize: 13, color: COLORS.sub }}>暂无受众洞察</Text>
          )}
          <View style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
            <MetricCell label="主导题材" value={(ai.topTopics && ai.topTopics[0] && ai.topTopics[0].name) || '-'} color={COLORS.orange} />
            <MetricCell label="时长偏好" value={ai.preferredDuration || '-'} />
            <MetricCell label="主流形式" value={ai.preferredForm || '-'} color={COLORS.blue} />
            <MetricCell label="情绪倾向" value={ai.emotionBias || '-'} color={COLORS.red} />
            <MetricCell label="平均爆款指数" value={ai.avgBoilingScore != null ? ai.avgBoilingScore : '-'} color={COLORS.yellow} />
          </View>
        </Card>

        {/* 题材分布 */}
        {topicDist.length > 0 ? (
          <Card title="题材分布（按播放量）">
            {topicDist.map((t, i) => (
              <BarRow
                key={i}
                label={t.name}
                value={t.totalPlay}
                max={maxPlay}
                color={COLORS.orange}
                valueText={formatCount(t.totalPlay)}
                bold={i === 0}
              />
            ))}
          </Card>
        ) : null}

        {/* TOP10 */}
        <Card title="爆款 TOP10" extra={
          <Text style={{ fontSize: 12, color: COLORS.sub }}>点击查看拆解</Text>
        }>
          {top10.length === 0 ? (
            <Text style={{ fontSize: 13, color: COLORS.sub }}>今日暂无上榜视频</Text>
          ) : (
            top10.map((v) => (
              <View
                key={v.id}
                onClick={() => goDetail(v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 4px',
                  borderBottom: `1px solid ${COLORS.border}`,
                  minHeight: 64,
                }}
              >
                <RankBadge rank={v.rank} />
                <View style={{ flex: 1, marginRight: 10, overflow: 'hidden' }}>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '600',
                      color: COLORS.text,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.sub, display: 'block', marginTop: 3 }}>
                    @{v.author} · {v.headline}
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.blue, display: 'block', marginTop: 3 }}>
                    {formatCount(v.stats && v.stats.play)} 播放
                  </Text>
                </View>
                <ScoreRing score={v.boilingScore} size={60} />
              </View>
            ))
          )}
        </Card>
      </View>
    </View>
  )
}
