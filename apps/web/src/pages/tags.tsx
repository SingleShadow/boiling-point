import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { api } from '../api';
import { DIM_COLOR, DIM_NAME } from '../utils';

interface TagGroup {
  id: string;
  name: string;
  tags: { id: string; name: string; desc?: string; keywords?: string[] }[];
}
interface TagsResp {
  dimensions: { id: string; name: string; desc: string }[];
  groups: TagGroup[];
  total: number;
}

const ORDER = ['topic', 'copy', 'rhythm', 'craft'];

export default function TagsPage() {
  const [data, setData] = useState<TagsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .tags()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const groups = [...(data?.groups || [])].sort(
    (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)
  );

  return (
    <div className="bp-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
        标签<span className="bp-gradient-text">体系</span>
      </h1>
      <div style={{ fontSize: 14, color: 'var(--bp-sub)', marginTop: 6, marginBottom: 24 }}>
        {data ? `共 ${data.total} 个标签 · 4 大维度` : '加载中…'} —— 从选题到表现手法，全链路可检索的爆款配方
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} style={{ marginBottom: 36 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 24,
                  borderRadius: 3,
                  background: DIM_COLOR[g.id] || '#FF5A1F',
                }}
              />
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                {DIM_NAME[g.id] || g.name}
              </h2>
              <span style={{ fontSize: 13, color: 'var(--bp-sub)' }}>
                {g.tags.length} 个标签
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
                gap: 16,
              }}
            >
              {g.tags.map((t) => (
                <div key={t.id} className="bp-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: DIM_COLOR[g.id] || '#FF5A1F',
                      }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--bp-sub)',
                      lineHeight: 1.6,
                      margin: '8px 0 12px',
                    }}
                  >
                    {t.desc}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(t.keywords || []).slice(0, 8).map((k) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 11,
                          color: '#6B7280',
                          background: '#F2F3F5',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
