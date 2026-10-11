import React, { useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import { api, Report } from '../api';
import { Markdown } from '../components/Markdown';

interface ReportMeta {
  date: string;
  createdAt: string;
  avgBoilingScore: number;
  topTopic: string;
  sampleSize: number;
}

export default function ReportPage() {
  const [list, setList] = useState<ReportMeta[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [report, setReport] = useState<Report | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    setLoadingList(true);
    api
      .reports(30)
      .then((r) => {
        setList(r || []);
        if (r && r.length) {
          setSelected(r[0].date);
          loadDoc(r[0].date);
        }
      })
      .catch(() => setList([]))
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDoc = (date: string) => {
    setLoadingDoc(true);
    setReport(null);
    api
      .report(date)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoadingDoc(false));
  };

  const onSelect = (date: string) => {
    setSelected(date);
    loadDoc(date);
  };

  return (
    <div className="bp-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
        趋势<span className="bp-gradient-text">报告</span>
      </h1>
      <div style={{ fontSize: 14, color: 'var(--bp-sub)', marginTop: 6, marginBottom: 24 }}>
        历史每日爆款拆解日报 · 一键回看任意一天
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '300px minmax(0,1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* 历史列表 */}
        <div className="bp-card" style={{ padding: 12, maxHeight: '72vh', overflowY: 'auto' }}>
          {loadingList ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : list.length === 0 ? (
            <Empty description="暂无历史报告" style={{ padding: 30 }} />
          ) : (
            list.map((r) => (
              <div
                key={r.date}
                onClick={() => onSelect(r.date)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background:
                    selected === r.date ? '#FFF1E9' : 'transparent',
                  border:
                    selected === r.date
                      ? '1px solid #FFD0B8'
                      : '1px solid transparent',
                  transition: 'background .15s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.date}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color:
                        r.avgBoilingScore >= 65
                          ? '#FF5A1F'
                          : r.avgBoilingScore >= 50
                          ? '#FFB020'
                          : '#2F6BFF',
                    }}
                  >
                    {r.avgBoilingScore}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--bp-sub)', marginTop: 4 }}>
                  主导 {r.topTopic} · 样本 {r.sampleSize}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Markdown 报告 */}
        <div className="bp-card" style={{ padding: '20px 28px', minHeight: 400 }}>
          {loadingDoc ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Spin size="large" />
            </div>
          ) : report ? (
            <Markdown source={report.markdown} />
          ) : (
            <Empty description="请选择左侧报告" style={{ padding: 60 }} />
          )}
        </div>
      </div>
    </div>
  );
}
