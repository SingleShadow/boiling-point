import React, { useEffect, useState } from 'react';
import { useNavigate } from 'umi';
import { api, Report } from '../api';
import { HBarChart, DonutChart, BarChart } from '../components/Charts';
import { formatNum, scoreColor, GRADE_COLOR } from '../utils';

function Icon({ name }: { name: string }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#FF5A1F',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, React.ReactNode> = {
    fetch: (
      <>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        <path d="M3 21v-5h5" />
      </>
    ),
    cube: (
      <>
        <path d="M12 2 3 7v10l9 5 9-5V7z" />
        <path d="M3 7l9 5 9-5" />
        <path d="M12 22V12" />
      </>
    ),
    tags: (
      <>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="#FF5A1F" stroke="none" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 14l3-4 4 3 5-7" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const ABILITIES = [
  {
    icon: 'fetch',
    title: '每日自动抓取',
    desc: '每日定时拉取抖音公开热榜与高播放视频，真实优先、失败自动降级仿真，保证天天有数据。',
  },
  {
    icon: 'cube',
    title: '四维结构化拆解',
    desc: '题材 / 文案 / 节奏 / 表现手法四个维度，用可解释规则引擎给每条爆款打标签与置信度。',
  },
  {
    icon: 'tags',
    title: '完整标签体系',
    desc: '79 个标签覆盖 4 大维度，从选题到表现手法全链路可检索，沉淀可复用的爆款配方。',
  },
  {
    icon: 'chart',
    title: '趋势日报',
    desc: '受众偏爱、题材分布、标签热度环比、创作方向建议，一页读懂今天的观众在为什么停留。',
  },
];

const PLANS = [
  {
    name: '尝鲜版',
    price: '¥0',
    unit: '/ 永久',
    desc: '个人创作者体验核心能力',
    features: ['今日趋势日报', 'TOP10 榜单查看', '标签体系浏览', '基础爆款指数'],
    highlight: false,
  },
  {
    name: '创作者版',
    price: '¥99',
    unit: '/ 月',
    desc: '高频产出内容的独立创作者',
    features: [
      '全部历史日报（30 天）',
      '四维拆解详情导出',
      '标签频次与环比跟踪',
      '创作方向建议每日推送',
    ],
    highlight: true,
  },
  {
    name: '团队版',
    price: '¥499',
    unit: '/ 月',
    desc: '内容团队与 MCN 批量作战',
    features: [
      '多账号趋势监控',
      '批量导出与团队协作',
      '自定义题材看板',
      '专属客户成功对接',
    ],
    highlight: false,
  },
];

const PRODUCTS = [
  {
    title: '沸点官网',
    tag: '数据门户',
    desc: '品牌门面 + 趋势日报浏览 + 标签体系检索，PC 端最佳阅读体验。',
    color: '#FF5A1F',
  },
  {
    title: '沸点 App',
    tag: '随身雷达',
    desc: '每天 3 分钟看榜、选题灵感随手存，创作者口袋里的趋势雷达。',
    color: '#2F6BFF',
  },
  {
    title: '沸点工作台',
    tag: '团队生产力',
    desc: '深度四维拆解、批量导出、盯盘提醒，内容团队的作战大屏。',
    color: '#E8362B',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .today()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const top1 = data?.top10?.[0];
  const ai = data?.audienceInsight;
  const topicDist = data?.distribution?.topic || [];

  return (
    <>
      {/* ===== HERO ===== */}
      <section
        style={{
          background:
            'radial-gradient(1200px 480px at 80% -10%, rgba(255,90,31,0.10), transparent), linear-gradient(180deg,#fff,#F7F8FA)',
          padding: '72px 0 56px',
        }}
      >
        <div
          className="bp-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.85fr)',
            gap: 48,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#FFF1E9',
                color: '#FF5A1F',
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 999,
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: '#FF5A1F',
                }}
              />
              抖音爆款内容 · 每日自动拆解
            </div>
            <h1
              style={{
                fontSize: 50,
                lineHeight: 1.12,
                fontWeight: 900,
                margin: 0,
                letterSpacing: '-1px',
                color: '#16181D',
              }}
            >
              把爆款从玄学
              <br />
              变成<span className="bp-gradient-text">工程问题</span>
            </h1>
            <p
              style={{
                fontSize: 18,
                color: 'var(--bp-sub)',
                lineHeight: 1.7,
                margin: '22px 0 30px',
                maxWidth: 480,
              }}
            >
              沸点创意每天测量并复现内容引爆的临界点——拆解今日 TOP10 爆款的
              题材、文案、节奏与表现手法，告诉你今天的观众在为什么而停留。
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button className="bp-btn-primary" onClick={() => navigate('/trend')}>
                查看今日趋势 →
              </button>
              <button
                className="bp-btn-ghost"
                onClick={() => navigate('/about')}
              >
                了解方法论
              </button>
            </div>
          </div>

          {/* 实时数据卡 */}
          <div
            className="bp-card"
            style={{ padding: 24, borderRadius: 16, position: 'relative' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                今日实时数据
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#fff',
                  background: data?.source === 'douyin' ? '#36C2A6' : '#8A919F',
                  padding: '3px 10px',
                  borderRadius: 999,
                }}
              >
                {data?.source === 'douyin' ? '真实榜单' : '仿真引擎'}
              </span>
            </div>
            {loading ? (
              <div style={{ color: 'var(--bp-sub)', padding: '20px 0' }}>
                加载中…
              </div>
            ) : top1 ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--bp-sub)' }}>
                  今日 TOP1
                </div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    margin: '6px 0 18px',
                    lineHeight: 1.4,
                  }}
                >
                  {top1.title}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  <Metric
                    label="爆款指数"
                    value={String(top1.boilingScore)}
                    color={scoreColor(top1.boilingScore)}
                  />
                  <Metric
                    label="样本数"
                    value={String(ai?.sampleSize ?? 10)}
                    color="#2F6BFF"
                  />
                  <Metric
                    label="等级"
                    value={top1.grade.level}
                    color="#E8362B"
                  />
                  <Metric
                    label="平均指数"
                    value={String(ai?.avgBoilingScore ?? '-')}
                    color="#FFB020"
                  />
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: 'var(--bp-sub)',
                  }}
                >
                  更新于 {data?.generatedAt?.slice(0, 16).replace('T', ' ')}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--bp-sub)' }}>暂无可展示数据</div>
            )}
          </div>
        </div>
      </section>

      {/* ===== 核心能力 ===== */}
      <section className="bp-section">
        <div className="bp-container">
          <h2 className="bp-section-title">四个能力，一套工程化爆款方法论</h2>
          <p className="bp-section-sub">
            从抓取到输出，每一步都可解释、可回归、可复用。
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 20,
            }}
          >
            {ABILITIES.map((a) => (
              <div key={a.title} className="bp-card" style={{ padding: 24 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: '#FFF1E9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Icon name={a.icon} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--bp-sub)', lineHeight: 1.7 }}>
                  {a.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 受众偏爱 ===== */}
      <section className="bp-section" style={{ background: '#fff' }}>
        <div className="bp-container">
          <h2 className="bp-section-title">今日受众偏爱什么</h2>
          <p className="bp-section-sub">
            基于 {ai?.sampleSize ?? 10} 条样本的结构化洞察（数据每日更新）
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
              gap: 32,
              alignItems: 'start',
            }}
          >
            <div className="bp-card" style={{ padding: 24 }}>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 16,
                    background: '#FF5A1F',
                    borderRadius: 2,
                  }}
                />
                题材分布（按上榜条数）
              </div>
              <HBarChart data={topicDist} />
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <InsightChip
                label="主导题材"
                value={ai?.topTopics?.[0]?.name || '-'}
                sub={`占比 ${Math.round((ai?.topTopics?.[0]?.share || 0) * 100)}%`}
              />
              <InsightChip
                label="时长偏好"
                value={ai?.preferredDuration || '-'}
                sub="完播压力最小区间"
              />
              <InsightChip
                label="主流形式"
                value={ai?.preferredForm || '-'}
                sub="榜单最高频拍摄形式"
              />
              <InsightChip
                label="情绪倾向"
                value={ai?.emotionBias || '-'}
                sub="整体表达情绪"
              />
            </div>
          </div>
          <div
            style={{
              marginTop: 20,
              padding: '16px 20px',
              background: '#FFF8F2',
              border: '1px solid #FFE2D0',
              borderRadius: 12,
              fontSize: 15,
              lineHeight: 1.7,
              color: '#7A3A16',
            }}
          >
            {ai?.summaryText || '今日受众洞察生成中…'}
          </div>
        </div>
      </section>

      {/* ===== 今日 TOP10 缩略 ===== */}
      <section className="bp-section">
        <div className="bp-container">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 24,
            }}
          >
            <div>
              <h2 className="bp-section-title">今日 TOP10 速览</h2>
              <p className="bp-section-sub" style={{ margin: 0 }}>
                前 5 条热门爆款，点击查看完整榜单
              </p>
            </div>
            <button
              className="bp-btn-ghost"
              onClick={() => navigate('/trend')}
            >
              查看完整榜单 →
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {(data?.top10 || []).slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="bp-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '14px 20px',
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: v.rank <= 3 ? '#FF5A1F' : '#C5Cad3',
                    width: 34,
                    textAlign: 'center',
                  }}
                >
                  {v.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {v.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--bp-sub)', marginTop: 4 }}>
                    {v.headline} · {formatNum(v.stats.play)} 播放
                  </div>
                </div>
                <div
                  style={{
                    ...GRADE_COLOR[v.grade.level],
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {v.grade.level}
                </div>
                <div style={{ textAlign: 'right', width: 70 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: scoreColor(v.boilingScore),
                    }}
                  >
                    {v.boilingScore}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--bp-sub)' }}>
                    爆款指数
                  </div>
                </div>
              </div>
            ))}
            {!data && (
              <div style={{ color: 'var(--bp-sub)' }}>榜单加载中…</div>
            )}
          </div>
        </div>
      </section>

      {/* ===== 产品矩阵 ===== */}
      <section
        id="products"
        className="bp-section"
        style={{ background: '#fff', scrollMarginTop: 80 }}
      >
        <div className="bp-container">
          <h2 className="bp-section-title">产品矩阵</h2>
          <p className="bp-section-sub">
            同一内核、同一 API，覆盖 Web / App / 桌面三大场景
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 20,
            }}
          >
            {PRODUCTS.map((p) => (
              <div
                key={p.title}
                className="bp-card"
                style={{
                  padding: 26,
                  borderTop: `4px solid ${p.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: p.color,
                    letterSpacing: 1,
                  }}
                >
                  {p.tag.toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 12px' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--bp-sub)', lineHeight: 1.7 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 定价 ===== */}
      <section id="pricing" className="bp-section" style={{ scrollMarginTop: 80 }}>
        <div className="bp-container">
          <h2 className="bp-section-title">简单透明的定价</h2>
          <p className="bp-section-sub">从免费体验到团队作战，按需选择</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 20,
              alignItems: 'stretch',
            }}
          >
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="bp-card"
                style={{
                  padding: 28,
                  border: p.highlight
                    ? '2px solid var(--bp-orange)'
                    : '1px solid var(--bp-border)',
                  position: 'relative',
                  boxShadow: p.highlight ? 'var(--bp-shadow-lg)' : 'var(--bp-shadow)',
                }}
              >
                {p.highlight && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg,#FF5A1F,#E8362B)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 14px',
                      borderRadius: 999,
                    }}
                  >
                    最受欢迎
                  </div>
                )}
                <div style={{ fontSize: 17, fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--bp-sub)', margin: '4px 0 16px' }}>
                  {p.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: p.highlight ? '#FF5A1F' : '#1F2329',
                    }}
                  >
                    {p.price}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--bp-sub)' }}>
                    {p.unit}
                  </span>
                </div>
                <div
                  style={{
                    borderTop: '1px solid var(--bp-border)',
                    margin: '18px 0',
                  }}
                />
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {p.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        fontSize: 14,
                        margin: '10px 0',
                        color: '#3D4452',
                      }}
                    >
                      <span
                        style={{
                          color: '#36C2A6',
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={p.highlight ? 'bp-btn-primary' : 'bp-btn-ghost'}
                  style={{ width: '100%', marginTop: 18 }}
                >
                  {p.price === '¥0' ? '免费开始' : '立即开通'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: '#F7F8FA',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--bp-sub)' }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color,
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InsightChip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="bp-card"
      style={{
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--bp-sub)' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--bp-sub)' }}>{sub}</div>
    </div>
  );
}
