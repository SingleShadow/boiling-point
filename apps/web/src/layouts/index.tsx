import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet, Link } from 'umi';
import { ConfigProvider, App as AntApp } from 'antd';

const NAV = [
  { key: '/', label: '首页' },
  { key: '/trend', label: '今日趋势' },
  { key: '/tags', label: '标签体系' },
  { key: '/#products', label: '产品矩阵', anchor: 'products' },
  { key: '/about', label: '关于我们' },
];

function FlameLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="fl" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#FF5A1F" />
          <stop offset="1" stopColor="#E8362B" />
        </linearGradient>
      </defs>
      <path
        d="M16 2c1 5-3 7-3 11a3 3 0 0 0 6 0c0-1-.5-2-1-3 4 2 8 6 8 12a10 10 0 0 1-20 0c0-6 5-9 8-13 1 2 .5 3 2 3Z"
        fill="url(#fl)"
      />
    </svg>
  );
}

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goAnchor = (anchor: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 350);
    } else {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const onNav = (item: (typeof NAV)[number]) => {
    if (item.anchor) goAnchor(item.anchor);
    else navigate(item.key);
  };

  const isActive = (item: (typeof NAV)[number]) =>
    !item.anchor && location.pathname === item.key;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: scrolled
          ? '1px solid var(--bp-border)'
          : '1px solid transparent',
        transition: 'all .2s ease',
      }}
    >
      <div
        className="bp-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 18,
          }}
          onClick={() => navigate('/')}
        >
          <FlameLogo />
          <span>
            沸点创意 <span className="bp-gradient-text">Boiling Point</span>
          </span>
        </div>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {NAV.map((item) => (
            <div
              key={item.label}
              onClick={() => onNav(item)}
              style={{
                padding: '8px 14px',
                fontSize: 15,
                fontWeight: isActive(item) ? 700 : 500,
                color: isActive(item) ? 'var(--bp-orange)' : 'var(--bp-text)',
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background .15s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#F2F3F5')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {item.label}
            </div>
          ))}
          <button
            className="bp-btn-primary"
            style={{ marginLeft: 8, padding: '9px 20px' }}
            onClick={() => goAnchor('pricing')}
          >
            免费试用
          </button>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer
      style={{
        background: 'var(--bp-graphite)',
        color: '#C8CCD4',
        marginTop: 40,
        padding: '48px 0 32px',
      }}
    >
      <div
        className="bp-container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 40,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#fff',
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 12,
            }}
          >
            <FlameLogo />
            沸点创意 Boiling Point
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#9AA0AB' }}>
            把「爆款」从玄学变成可拆解、可复用、可预测的工程问题。每天告诉你，
            今天的观众在为什么而停留。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>
              产品
            </div>
            {['官网数据门户', '移动 App', '桌面工作台'].map((t) => (
              <div key={t} style={{ fontSize: 14, margin: '8px 0', color: '#9AA0AB' }}>
                {t}
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>
              资源
            </div>
            {['标签体系', '今日趋势', '历史日报', '关于我们'].map((t) => (
              <div key={t} style={{ fontSize: 14, margin: '8px 0', color: '#9AA0AB' }}>
                {t}
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>
              联系
            </div>
            <div style={{ fontSize: 14, margin: '8px 0', color: '#9AA0AB' }}>
              hello@boilingpoint.ai
            </div>
            <div style={{ fontSize: 14, margin: '8px 0', color: '#9AA0AB' }}>
              商务合作 / 媒体咨询
            </div>
          </div>
        </div>
      </div>
      <div
        className="bp-container"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          marginTop: 32,
          paddingTop: 20,
          fontSize: 13,
          color: '#6B7280',
        }}
      >
        © {new Date().getFullYear()} 沸点创意 Boiling Point · 数据每日自动更新 ·
        爆款指数与榜单仅供参考
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#FF5A1F',
          colorError: '#E8362B',
          colorLink: '#FF5A1F',
          borderRadius: 8,
          fontFamily:
            '-apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
          colorTextHeading: '#1F2329',
        },
      }}
    >
      <AntApp>
        <div
          style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
        >
          <NavBar />
          <main style={{ flex: 1 }}>
            <Outlet />
          </main>
          <Footer />
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
