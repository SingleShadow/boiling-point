import React, { useEffect, useState } from 'react';
import { useNavigate } from 'umi';
import { DatePicker, Drawer, Tag, Table, Spin, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { api, Report, TopItem, DimensionBlock } from '../api';
import { DonutChart, BarChart, HBarChart, ConfidenceBar } from '../components/Charts';
import { formatNum, scoreColor, GRADE_COLOR, DIM_COLOR, DIM_NAME } from '../utils';

function DimensionPanel({
  title,
  dim,
  color,
}: {
  title: string;
  dim: DimensionBlock;
  color: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
          }}
        />
        {title}
      </div>
      <div style={{ fontSize: 13, color: '#C0C4CC', marginBottom: 12 }}>
        {dim.summary}
      </div>
      {/* 关键指标 */}
      {dim.metrics && (
        <div
          style={{
            background: '#F7F8FA',
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 14px',
          }}
        >
          {Object.entries(dim.metrics).map(([k, v]) => {
            if (Array.isArray(v)) v = v.join('、') || '—';
            if (typeof v === 'object') v = '—';
            return (
              <div key={k} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--bp-sub)' }}>{k}：</span>
                <span style={{ color: '#1F2329', fontWeight: 600 }}>{String(v)}</span>
              </div>
            );
          })}
        </div>
      )}
      {/* 标签 + 置信度 */}
      <div style={{ display: 'grid', gap: 10 }}>
        {dim.tags.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag
              color={color}
              style={{ margin: 0, minWidth: 76, textAlign: 'center' }}
            >
              {t.name}
            </Tag>
            <ConfidenceBar value={t.confidence || 0} color={color} />
            <span style={{ fontSize: 12, color: 'var(--bp-sub)', width: 38 }}>
              {Math.round((t.confidence || 0) * 100)}%
            </span>
          </div>
        ))}
        {dim.tags.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--bp-sub)' }}>无显著标签</div>
        )}
      </div>
    </div>
  );
}

function TagFrequencyList({ items }: { items: Report['tagFrequencies'] }) {
  const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, 12);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {sorted.map((t) => {
        const up = t.delta > 0;
        const down = t.delta < 0;
        const deltaColor = up ? '#FF5A1F' : down ? '#7C9885' : '#8A919F';
        return (
          <div
            key={t.tagId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#F7F8FA',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: DIM_COLOR[t.dimension] || '#8A919F',
                width: 30,
              }}
            >
              {DIM_NAME[t.dimension] || t.dimension}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
              {t.name}
            </span>
            <span style={{ fontSize: 13, color: 'var(--bp-sub)' }}>
              {t.count} 条
            </span>
            {t.isNew ? (
              <span
                style={{
                  fontSize: 12,
                  color: '#fff',
                  background: '#FF5A1F',
                  padding: '1px 8px',
                  borderRadius: 999,
                }}
              >
                NEW
              </span>
            ) : (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: deltaColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  width: 52,
                }}
              >
                {up && <ArrowUpOutlined />}
                {down && <ArrowDownOutlined />}
                {up || down ? Math.abs(t.delta) : '—'}
              </span>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && (
        <div style={{ color: 'var(--bp-sub)' }}>暂无标签频次数据</div>
      )}
    </div>
  );
}

export default function Trend() {
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dayValue, setDayValue] = useState<any>(undefined);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TopItem | null>(null);

  const load = (d: string) => {
    setLoading(true);
    api
      .today(d === new Date().toISOString().slice(0, 10) ? undefined : d)
      .then(setData)
      .catch(() => message.error('加载失败，请确认后端服务已启动'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (val: any, str: string) => {
    setDayValue(val);
    setDate(str);
    load(str);
  };

  const ai = data?.audienceInsight;
  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 64,
      render: (r: number) => (
        <span
          style={{
            fontWeight: 900,
            fontSize: 16,
            color: r <= 3 ? '#FF5A1F' : '#C5CAD3',
          }}
        >
          {r}
        </span>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (t: string, r: TopItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t}</div>
          <div style={{ fontSize: 12, color: 'var(--bp-sub)' }}>
            {r.author} · {r.headline}
          </div>
        </div>
      ),
    },
    {
      title: '题材',
      width: 110,
      render: (_: any, r: TopItem) =>
        r.dimensions.topic.primary?.name || r.dimensions.topic.tags[0]?.name || '-',
    },
    {
      title: '形式',
      width: 90,
      render: (_: any, r: TopItem) => r.dimensions.craft.metrics?.form || '-',
    },
    {
      title: '时长',
      width: 90,
      render: (_: any, r: TopItem) => `${r.duration}s`,
    },
    {
      title: '播放',
      width: 100,
      render: (_: any, r: TopItem) => formatNum(r.stats.play),
    },
    {
      title: '爆款指数',
      width: 110,
      render: (_: any, r: TopItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: scoreColor(r.boilingScore),
            }}
          >
            {r.boilingScore}
          </span>
          <span
            style={{
              ...GRADE_COLOR[r.grade.level],
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {r.grade.level}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="bp-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
      {/* 标题栏 + 日期选择 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
            今日趋势 <span className="bp-gradient-text">数据门户</span>
          </h1>
          <div style={{ fontSize: 14, color: 'var(--bp-sub)', marginTop: 6 }}>
            {data?.date} · 样本 {ai?.sampleSize ?? '-'} 条 ·{' '}
            {data?.source === 'douyin' ? '真实榜单' : '仿真引擎'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <DatePicker
            value={dayValue}
            onChange={onChange}
            allowClear={false}
            placeholder="选择日期"
          />
          <button
            className="bp-btn-ghost"
            onClick={() => {
              setLoading(true);
              api
                .backfill(7)
                .then(() => {
                  message.success('已触发回溯生成（最近 7 天）');
                  load(date);
                })
                .catch(() => message.error('回溯失败'));
            }}
          >
            回溯 7 天
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 受众洞察 */}
          <div
            className="bp-card"
            style={{ padding: 24, marginBottom: 24 }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ width: 4, height: 18, background: '#FF5A1F', borderRadius: 2 }} />
              受众今天偏爱什么
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 16,
                marginBottom: 18,
              }}
            >
              <Conclusion label="主导题材" value={ai?.topTopics?.[0]?.name || '-'} />
              <Conclusion label="时长偏好" value={ai?.preferredDuration || '-'} />
              <Conclusion label="主流形式" value={ai?.preferredForm || '-'} />
              <Conclusion label="情绪倾向" value={ai?.emotionBias || '-'} />
              <Conclusion
                label="平均爆款指数"
                value={String(ai?.avgBoilingScore ?? '-')}
              />
              <Conclusion
                label="热门钩子"
                value={(ai?.preferredHooks || []).join('、') || '-'}
              />
            </div>
            <div
              style={{
                padding: '14px 18px',
                background: '#FFF8F2',
                border: '1px solid #FFE2D0',
                borderRadius: 12,
                fontSize: 15,
                lineHeight: 1.7,
                color: '#7A3A16',
              }}
            >
              {ai?.summaryText}
            </div>
          </div>

          {/* 分布图 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div className="bp-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>题材分布</div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <DonutChart data={data?.distribution.topic || []} />
                <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                  {(data?.distribution.topic || []).map((d, i) => (
                    <div
                      key={d.name}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: [
                            '#FF5A1F',
                            '#E8362B',
                            '#FFB020',
                            '#2F6BFF',
                            '#36C2A6',
                          ][i % 5],
                        }}
                      />
                      {d.name}
                      <span style={{ color: 'var(--bp-sub)', marginLeft: 'auto' }}>
                        {Math.round(d.share * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bp-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>时长分布</div>
              <BarChart data={data?.distribution.duration || []} />
            </div>
          </div>

          {/* TOP10 表格 */}
          <div
            className="bp-card"
            style={{ padding: 8, marginBottom: 24, overflowX: 'auto' }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                padding: '12px 16px',
              }}
            >
              今日 TOP10 爆款（点击行查看四维拆解）
            </div>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data?.top10 || []}
              pagination={false}
              onRow={(record) => ({
                onClick: () => setActive(record as TopItem),
                style: { cursor: 'pointer' },
              })}
            />
          </div>

          {/* 标签频次 + 创作方向 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)',
              gap: 24,
            }}
          >
            <div className="bp-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>
                标签热度 TOP（含环比）
              </div>
              <TagFrequencyList items={data?.tagFrequencies || []} />
            </div>
            <div className="bp-card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>
                创作方向建议
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                {(data?.directions || []).map((d) => (
                  <div
                    key={d.no}
                    style={{
                      border: '1px solid var(--bp-border)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: '#FFF1E9',
                          color: '#FF5A1F',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {d.no}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{d.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#3D4452', lineHeight: 1.7 }}>
                      <b style={{ color: '#FF5A1F' }}>钩子：</b>
                      {d.hookTemplate}
                    </div>
                    <div style={{ fontSize: 13, color: '#3D4452', lineHeight: 1.7, marginTop: 4 }}>
                      <b>角度：</b>
                      {d.angle}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        marginTop: 8,
                        flexWrap: 'wrap',
                        fontSize: 12,
                        color: 'var(--bp-sub)',
                      }}
                    >
                      <span>⏱ {d.durationAdvice}</span>
                      <span>🎬 {d.craftAdvice}</span>
                      <span>💬 {d.ctaAdvice}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#E8362B',
                        background: '#FFF1E9',
                        padding: '6px 10px',
                        borderRadius: 8,
                      }}
                    >
                      {d.whyHot}
                    </div>
                  </div>
                ))}
                {(data?.directions || []).length === 0 && (
                  <div style={{ color: 'var(--bp-sub)' }}>暂无方向建议</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 四维拆解抽屉 */}
      <Drawer
        title={
          active ? (
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{active.title}</div>
              <div style={{ fontSize: 12, color: 'var(--bp-sub)', fontWeight: 400 }}>
                {active.headline} · 爆款指数 {active.boilingScore}（{active.grade.label}）
              </div>
            </div>
          ) : (
            '四维拆解'
          )
        }
        width={Math.min(960, window.innerWidth - 40)}
        open={!!active}
        onClose={() => setActive(null)}
      >
        {active && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <DimensionPanel
              title="题材"
              dim={active.dimensions.topic}
              color={DIM_COLOR.topic}
            />
            <DimensionPanel
              title="文案"
              dim={active.dimensions.copy}
              color={DIM_COLOR.copy}
            />
            <DimensionPanel
              title="节奏"
              dim={active.dimensions.rhythm}
              color={DIM_COLOR.rhythm}
            />
            <DimensionPanel
              title="表现手法"
              dim={active.dimensions.craft}
              color={DIM_COLOR.craft}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Conclusion({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#F7F8FA',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--bp-sub)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}
