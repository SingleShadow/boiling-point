import { useState, useEffect, useMemo } from 'react'
import { View, Text, Input } from '@tarojs/components'
import { api } from '../../api'
import { COLORS, DIM_COLOR, DIM_NAME } from '../../theme'
import BrandHeader from '../../components/BrandHeader'
import Card from '../../components/Card'
import TagChip from '../../components/TagChip'
import StateView from '../../components/StateView'

export default function Tags() {
  const [status, setStatus] = useState('loading')
  const [raw, setRaw] = useState(null)
  const [errMsg, setErrMsg] = useState('')
  const [query, setQuery] = useState('')

  const load = () => {
    setStatus('loading')
    api
      .tags()
      .then((d) => {
        setRaw(d)
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

  // 将 groups 按 dimension 归并
  const byDim = useMemo(() => {
    if (!raw) return {}
    const map = {}
    ;(raw.dimensions || []).forEach((dim) => {
      map[dim.id] = { ...dim, tags: [] }
    })
    ;(raw.groups || []).forEach((g) => {
      const key = g.dimension || g.id
      if (map[key]) map[key].tags = map[key].tags.concat(g.tags || [])
      else {
        map[g.id] = { id: g.id, name: g.name, desc: '', tags: g.tags || [] }
      }
    })
    return map
  }, [raw])

  const q = query.trim().toLowerCase()

  const matchTag = (t) => {
    if (!q) return true
    if ((t.name || '').toLowerCase().includes(q)) return true
    if ((t.keywords || []).some((k) => String(k).toLowerCase().includes(q))) return true
    return false
  }

  const dimOrder = ['topic', 'copy', 'rhythm', 'craft']

  return (
    <View style={{ minHeight: '100vh', background: COLORS.bg }}>
      <BrandHeader title="标签体系" />

      <View style={{ padding: '12px 12px 0' }}>
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: '0 12px',
            height: 40,
          }}
        >
          <Text style={{ fontSize: 14, color: COLORS.sub, marginRight: 8 }}>🔍</Text>
          <Input
            value={query}
            onInput={(e) => setQuery(e.detail.value)}
            placeholder="搜索标签名 / 关键词"
            placeholderStyle="color:#8A919F"
            style={{ flex: 1, fontSize: 14, color: COLORS.text, height: 40 }}
          />
          {q ? (
            <Text onClick={() => setQuery('')} style={{ fontSize: 14, color: COLORS.orange, paddingLeft: 8 }}>
              清空
            </Text>
          ) : null}
        </View>
      </View>

      {status !== 'success' || !raw ? (
        <StateView status={status} onRetry={load} errorText={errMsg} />
      ) : (
        <View style={{ padding: 12 }}>
          {dimOrder.map((dimKey) => {
            const dim = byDim[dimKey]
            if (!dim) return null
            const color = DIM_COLOR[dimKey]
            const tags = (dim.tags || []).filter(matchTag)
            if (q && tags.length === 0) return null
            return (
              <Card
                key={dimKey}
                title={
                  <View style={{ display: 'flex', alignItems: 'center' }}>
                    <View style={{ width: 4, height: 16, borderRadius: 2, background: color, marginRight: 8 }} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>{DIM_NAME[dimKey] || dim.name}</Text>
                  </View>
                }
                extra={<Text style={{ fontSize: 12, color: COLORS.sub }}>{tags.length} 个</Text>}
              >
                {dim.desc ? (
                  <Text style={{ fontSize: 12.5, color: COLORS.sub, display: 'block', marginBottom: 10 }}>
                    {dim.desc}
                  </Text>
                ) : null}
                {tags.length === 0 ? (
                  <Text style={{ fontSize: 13, color: COLORS.sub }}>无匹配标签</Text>
                ) : (
                  tags.map((t, i) => (
                    <View
                      key={i}
                      style={{
                        padding: '10px 0',
                        borderBottom: i < tags.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>{t.name}</Text>
                      {t.desc ? (
                        <Text style={{ fontSize: 12.5, color: COLORS.sub, display: 'block', marginTop: 3, lineHeight: 1.6 }}>
                          {t.desc}
                        </Text>
                      ) : null}
                      {t.keywords && t.keywords.length > 0 ? (
                        <View style={{ flexWrap: 'wrap', marginTop: 6 }}>
                          {t.keywords.map((k, j) => (
                            <TagChip key={j} name={k} size="sm" color={color} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
            )
          })}
          {q ? (
            <Text style={{ fontSize: 12, color: COLORS.sub, display: 'block', textAlign: 'center', marginTop: 8 }}>
              共匹配 {dimOrder.reduce((a, k) => a + (byDim[k] ? byDim[k].tags.filter(matchTag).length : 0), 0)} 个标签
            </Text>
          ) : null}
        </View>
      )}
    </View>
  )
}
