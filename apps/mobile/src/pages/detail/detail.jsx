import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { api } from '../../api'
import { COLORS, GRADE_COLOR } from '../../theme'
import { formatCount, formatDuration, toDateKey, text } from '../../utils/format'
import BrandHeader from '../../components/BrandHeader'
import Card from '../../components/Card'
import TagChip from '../../components/TagChip'
import ScoreRing from '../../components/ScoreRing'
import StateView from '../../components/StateView'
import DimensionBlock from '../../components/DimensionBlock'

function StatItem({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: '8px 0' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

export default function Detail() {
  const router = useRouter()
  const id = router.params.id
  const date = router.params.date
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [video, setVideo] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const load = () => {
    setStatus('loading')
    const todayKey = toDateKey(new Date())
    const fetchPromise =
      date && date !== todayKey ? api.report(date) : api.today()
    fetchPromise
      .then((d) => {
        setData(d)
        const v = (d.top10 || []).find((x) => String(x.id) === String(id))
        if (!v) {
          setErrMsg('未找到该视频的拆解数据')
          setStatus('error')
          return
        }
        setVideo(v)
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

  if (status !== 'success' || !video) {
    return (
      <View style={{ minHeight: '100vh', background: COLORS.bg }}>
        <BrandHeader title="拆解详情" date={data && data.date} source={data && data.source} />
        <StateView status={status} onRetry={load} errorText={errMsg} />
      </View>
    )
  }

  const dims = video.dimensions || {}
  const copy = dims.copy || {}
  const rhythm = dims.rhythm || {}
  const craft = dims.craft || {}
  const stats = video.stats || {}

  // 可复用要点：组合 hook 模板 + 时长建议 + 表现手法
  const hookName = copy.metrics && copy.metrics.hook && copy.metrics.hook.name
  const durBand = rhythm.metrics && rhythm.metrics.durationBand
  const durSec = rhythm.metrics && rhythm.metrics.duration
  const formName = craft.metrics && craft.metrics.form
  const advice =
    `以「${hookName || '强钩子'}」切入，视频时长控制在「${durBand || formatDuration(durSec) || '适中'}」，` +
    `运用「${formName || '主流'}」表现手法，并配合结尾引导提升互动转化。`

  return (
    <View style={{ minHeight: '100vh', background: COLORS.bg, paddingBottom: 16 }}>
      <BrandHeader title="拆解详情" date={data.date} source={data.source} />

      <View style={{ padding: 12 }}>
        {/* 头部信息 */}
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text, lineHeight: 1.4 }}>
            {text(video.title)}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.sub, marginTop: 6, display: 'block' }}>
            @{text(video.author)}
          </Text>

          <View style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
            <ScoreRing score={video.boilingScore} size={104} />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '800',
                    color: GRADE_COLOR[video.grade && video.grade.level] || COLORS.orange,
                  }}
                >
                  {video.grade && video.grade.level}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.sub, marginLeft: 8 }}>
                  {video.grade && video.grade.label}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: COLORS.text, marginTop: 6, display: 'block' }}>
                {text(video.headline)}
              </Text>
            </View>
          </View>

          <View
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              borderTop: `1px solid ${COLORS.border}`,
              marginTop: 14,
            }}
          >
            <StatItem label="播放" value={formatCount(stats.play)} />
            <StatItem label="点赞" value={formatCount(stats.digg)} />
            <StatItem label="评论" value={formatCount(stats.comment)} />
            <StatItem label="分享" value={formatCount(stats.share)} />
            <StatItem label="收藏" value={formatCount(stats.collect)} />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: COLORS.sub }}>时长</Text>
            <Text style={{ fontSize: 13, color: COLORS.text, marginLeft: 8 }}>
              {formatDuration(video.duration)}
            </Text>
            {video.music ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: COLORS.sub }}>BGM</Text>
                <Text style={{ fontSize: 13, color: COLORS.text, marginLeft: 8 }}>
                  {text(video.music)}
                </Text>
              </View>
            ) : null}
          </View>

          {video.challenges && video.challenges.length > 0 ? (
            <View style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {video.challenges.map((c, i) => (
                <TagChip key={i} name={'#' + c} size="sm" color={COLORS.blue} />
              ))}
            </View>
          ) : null}
        </Card>

        {/* 四个维度 */}
        <Card title="四维拆解">
          <DimensionBlock dimKey="topic" data={dims.topic} />
          <View style={{ height: 14 }} />
          <DimensionBlock dimKey="copy" data={dims.copy} />
          <View style={{ height: 14 }} />
          <DimensionBlock dimKey="rhythm" data={dims.rhythm} />
          <View style={{ height: 14 }} />
          <DimensionBlock dimKey="craft" data={dims.craft} />
        </Card>

        {/* 可复用要点 */}
        <Card title="可复用要点">
          <View
            style={{
              background: 'linear-gradient(135deg, rgba(255,90,31,0.10), rgba(47,107,255,0.08))',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7 }}>{advice}</Text>
          </View>
        </Card>
      </View>
    </View>
  )
}
