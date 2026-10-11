import React from 'react';
import { formatNum } from '../utils';

const PALETTE = [
  '#FF5A1F',
  '#E8362B',
  '#FFB020',
  '#2F6BFF',
  '#36C2A6',
  '#9B5DE5',
  '#F15BB5',
  '#00BBF9',
  '#8AC926',
  '#FF924C',
];

export function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/* ===== 环形图（题材分布） ===== */
export function DonutChart({
  data,
  size = 220,
  thickness = 26,
}: {
  data: { name: string; share: number; count?: number }[];
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const total = data.reduce((s, d) => s + (d.share || 0), 0) || 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#EEF0F3"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const frac = (d.share || 0) / total;
          const dash = frac * C;
          const el = (
            <circle
              key={d.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colorAt(i)}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${d.name} ${Math.round(frac * 100)}%`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="#1F2329"
      >
        {data.length}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="11"
        fill="#8A919F"
      >
        类题材
      </text>
    </svg>
  );
}

/* ===== 柱状图（时长/形式分布） ===== */
export function BarChart({
  data,
  height = 200,
  colorKey = 0,
}: {
  data: { name: string; count: number; avgScore?: number }[];
  height?: number;
  colorKey?: number;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 100; // viewBox 百分比宽度
  const pad = 6;
  const bw = (w - pad * (data.length + 1)) / data.length;
  const baseY = 78;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} 100`}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const h = (d.count / max) * (baseY - 8);
        const x = pad + i * (bw + pad);
        const y = baseY - h;
        return (
          <g key={d.name}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={h}
              rx={1.4}
              fill={colorAt(colorKey + i)}
              opacity={0.92}
            >
              <title>{`${d.name}: ${d.count}`}</title>
            </rect>
            <text
              x={x + bw / 2}
              y={y - 2}
              textAnchor="middle"
              fontSize="4.2"
              fill="#1F2329"
              fontWeight="700"
            >
              {d.count}
            </text>
            <text
              x={x + bw / 2}
              y={92}
              textAnchor="middle"
              fontSize="3.6"
              fill="#8A919F"
            >
              {d.name.length > 6 ? d.name.slice(0, 6) : d.name}
            </text>
          </g>
        );
      })}
      <line
        x1={0}
        y1={baseY}
        x2={w}
        y2={baseY}
        stroke="#E5E6EB"
        strokeWidth={0.6}
      />
    </svg>
  );
}

/* ===== 横向条形图（受众题材偏好） ===== */
export function HBarChart({
  data,
  color = '#FF5A1F',
}: {
  data: { name: string; count: number; share?: number; avgScore?: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ width: '100%' }}>
      {data.map((d, i) => {
        const pct = Math.round((d.count / max) * 100);
        return (
          <div
            key={d.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 88,
                fontSize: 14,
                color: '#1F2329',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {d.name}
            </div>
            <div
              style={{
                flex: 1,
                height: 22,
                background: '#F2F3F5',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 6,
                  transition: 'width .4s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 34,
                }}
              >
                {d.count}
              </div>
            </div>
            <div
              style={{
                width: 52,
                fontSize: 13,
                color: '#8A919F',
                flexShrink: 0,
              }}
            >
              {Math.round((d.share || 0) * 100)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== 标签置信度进度条 ===== */
export function ConfidenceBar({
  value,
  color = '#FF5A1F',
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div
      style={{
        height: 6,
        background: '#F2F3F5',
        borderRadius: 4,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
        }}
      />
    </div>
  );
}

export { formatNum };
