import React from 'react';

const STEPS = [
  {
    no: '01',
    title: '抓取',
    desc: '每日定时拉取抖音公开热榜与高播放视频，真实通道优先，失败自动降级仿真引擎，保证天天有数据。',
    color: '#FF5A1F',
  },
  {
    no: '02',
    title: '拆解',
    desc: '规则引擎 + 词典对每条视频做四维结构化拆解：题材、文案、节奏、表现手法，输出带置信度的标签。',
    color: '#E8362B',
  },
  {
    no: '03',
    title: '建模',
    desc: '用当日榜单内相对分位计算爆款指数（0–100），聚合题材/标签分布、环比涨跌与受众偏好。',
    color: '#FFB020',
  },
  {
    no: '04',
    title: '输出',
    desc: '生成趋势日报、创作方向建议与可检索标签体系，通过统一 API 交付官网、App 与桌面端。',
    color: '#2F6BFF',
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section
        style={{
          background:
            'linear-gradient(180deg,#16181D,#22252C)',
          color: '#fff',
          padding: '72px 0 56px',
        }}
      >
        <div className="bp-container">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,90,31,0.15)',
              color: '#FF8A4D',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 999,
              marginBottom: 20,
            }}
          >
            关于沸点创意
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              margin: 0,
              letterSpacing: '-1px',
              lineHeight: 1.15,
            }}
          >
            把「爆款」从玄学
            <br />
            变成可复用的<span className="bp-gradient-text">工程问题</span>
          </h1>
          <p
            style={{
              fontSize: 17,
              color: '#C8CCD4',
              lineHeight: 1.8,
              maxWidth: 620,
              marginTop: 22,
            }}
          >
            沸点创意（Boiling Point Creative）的使命，是测量并复现内容引爆的临界点。
            我们每天告诉你：今天的观众，在为什么而停留。
          </p>
        </div>
      </section>

      {/* 方法论 */}
      <section className="bp-section">
        <div className="bp-container">
          <h2 className="bp-section-title">方法论：四步走通爆款工程化</h2>
          <p className="bp-section-sub">
            可解释、可回归、可复用——每一步都不依赖「感觉」
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 20,
            }}
          >
            {STEPS.map((s) => (
              <div key={s.no} className="bp-card" style={{ padding: 24 }}>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: s.color,
                    opacity: 0.85,
                  }}
                >
                  {s.no}
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, margin: '8px 0 10px' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--bp-sub)', lineHeight: 1.7 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据口径 */}
      <section className="bp-section" style={{ background: '#fff' }}>
        <div className="bp-container">
          <h2 className="bp-section-title">数据口径说明</h2>
          <p className="bp-section-sub">透明、可解释，是结果可信的前提</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,1fr)',
              gap: 18,
            }}
          >
            <Clause
              title="数据源"
              body="抖音公开热榜与高播放视频为主，第三方接口为辅；真实通道失败时自动降级仿真引擎，并在报告中标记 source 字段。"
            />
            <Clause
              title="爆款指数"
              body="0–100，基于当日榜单内的相对分位计算：播放量、互动率、完播代理、涨粉效率与传播系数加权，因此分数代表「相对今日大盘」的可比高低。"
            />
            <Clause
              title="四维拆解"
              body="题材 / 文案 / 节奏 / 表现手法由可解释规则 + 词典匹配，结果稳定、可回归测试；大模型仅作可选润色（缺省关闭）。"
            />
            <Clause
              title="统计口径"
              body="播放量为榜单内相对热度值代理，非绝对值；标签频次含环比 delta，新出现标签标记为 NEW。所有结论用于内容选题参考，不构成任何保证。"
            />
          </div>
        </div>
      </section>

      {/* 联系 */}
      <section className="bp-section">
        <div className="bp-container">
          <div
            className="bp-card"
            style={{
              padding: 40,
              background:
                'radial-gradient(800px 300px at 90% 0%, rgba(255,90,31,0.08), transparent), #16181D',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
              想用数据驱动你的内容？
            </h2>
            <p style={{ color: '#C8CCD4', marginTop: 12, fontSize: 16 }}>
              商务合作 / 媒体咨询 / 产品试用，欢迎联系我们
            </p>
            <div
              style={{
                display: 'flex',
                gap: 28,
                justifyContent: 'center',
                marginTop: 22,
                flexWrap: 'wrap',
                fontSize: 15,
              }}
            >
              <span>✉️ hello@boilingpoint.ai</span>
              <span>💬 商务合作与媒体咨询</span>
              <span>🌐 boilingpoint.ai</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Clause({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--bp-border)',
        borderRadius: 12,
        padding: 22,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--bp-sub)', lineHeight: 1.8 }}>{body}</div>
    </div>
  );
}
