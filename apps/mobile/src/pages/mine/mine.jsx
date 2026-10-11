import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { api } from '../../api'
import { COLORS } from '../../theme'
import BrandHeader from '../../components/BrandHeader'
import Card from '../../components/Card'
import StateView from '../../components/StateView'

function EntryRow({ label, desc, onClick, arrow = true }) {
  return (
    <View
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 4px',
        borderBottom: `1px solid ${COLORS.border}`,
        minHeight: 44,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: COLORS.text, fontWeight: '500' }}>{label}</Text>
        {desc ? (
          <Text style={{ fontSize: 12, color: COLORS.sub, display: 'block', marginTop: 3 }}>{desc}</Text>
        ) : null}
      </View>
      {arrow ? <Text style={{ fontSize: 16, color: COLORS.sub }}>›</Text> : null}
    </View>
  )
}

function StatCell({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: '10px 0' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.orange }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

export default function Mine() {
  const [status, setStatus] = useState('loading')
  const [health, setHealth] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const load = () => {
    setStatus('loading')
    api
      .health()
      .then((h) => {
        setHealth(h)
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

  const goTags = () => Taro.navigateTo({ url: '/pages/tags/tags' })
  const goReport = () => Taro.switchTab({ url: '/pages/report/report' })

  const stats = (health && health.stats) || {}
  const isSim = health && health.dataMode === 'simulated'
  const cronHour = health && health.cronHour

  return (
    <View style={{ minHeight: '100vh', background: COLORS.bg }}>
      <BrandHeader title="我的" />

      {status !== 'success' || !health ? (
        <View style={{ padding: 12 }}>
          <StateView status={status} onRetry={load} errorText={errMsg} />
        </View>
      ) : (
        <View style={{ padding: 12 }}>
          {/* 快捷入口 */}
          <Card title="功能入口">
            <EntryRow label="标签体系" desc="四维度标签与关键词全览" onClick={goTags} />
            <EntryRow label="趋势报告" desc="创作方向 / 标签热度榜" onClick={goReport} />
          </Card>

          {/* 数据源与定时 */}
          <Card title="数据源与更新">
            <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
              数据每日自动抓取抖音播放 / 互动量前 10 的爆款视频，从题材、文案、节奏、表现手法四个维度结构化拆解并打标签。
            </Text>
            <View style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <View style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: COLORS.sub, width: 76 }}>当前数据模式</Text>
                <View
                  style={{
                    padding: '2px 10px',
                    borderRadius: 10,
                    background: isSim ? 'rgba(255,176,32,0.16)' : 'rgba(47,107,255,0.12)',
                  }}
                >
                  <Text style={{ fontSize: 12, color: isSim ? COLORS.yellow : COLORS.blue }}>
                    {isSim ? '演示数据 (simulated)' : '抖音真实数据 (douyin)'}
                  </Text>
                </View>
              </View>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: COLORS.sub, width: 76 }}>定时任务</Text>
                <Text style={{ fontSize: 13, color: COLORS.text }}>
                  每天 {cronHour != null ? cronHour : 9}:00 自动生成报告
                </Text>
              </View>
            </View>
          </Card>

          {/* 系统状态 */}
          <Card title="系统状态">
            <View style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
              <StatCell label="累计天数" value={stats.days || 0} />
              <StatCell label="拆解视频" value={stats.videos || 0} />
              <StatCell label="生成报告" value={stats.reports || 0} />
              <StatCell label="运行次数" value={stats.runs || 0} />
            </View>
            <View style={{ marginTop: 10 }}>
              <View style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: COLORS.sub, width: 76 }}>最近执行</Text>
                <Text style={{ fontSize: 13, color: COLORS.text }}>
                  {health.lastRunAt ? String(health.lastRunAt).replace('T', ' ').replace(/\.\d+Z$/, '') : '-'}
                </Text>
              </View>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: COLORS.sub, width: 76 }}>抖音密钥</Text>
                <Text style={{ fontSize: 13, color: health.hasLiveKey ? COLORS.blue : COLORS.sub }}>
                  {health.hasLiveKey ? '已配置' : '未配置（使用演示数据）'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 关于 */}
          <Card title="关于沸点创意">
            <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
              沸点创意 Boiling Point —— 用数据拆解爆款，帮创作者找到可复用的内容方法论。本移动端由 Taro 4 + React 18 构建。
            </Text>
          </Card>
        </View>
      )}
    </View>
  )
}
