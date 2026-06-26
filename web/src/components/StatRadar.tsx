import type { Stats } from '../types';

// 自绘 SVG 六维种族值雷达图（不引图表库）
const AXES: { key: keyof Stats; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: '攻击' },
  { key: 'defense', label: '防御' },
  { key: 'spAtk', label: '特攻' },
  { key: 'spDef', label: '特防' },
  { key: 'speed', label: '速度' },
];

const MAX = 180; // 种族值单项上限（大致）

export function StatRadar({ stats, size = 200 }: { stats: Stats; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = AXES.length;

  const pointFor = (value: number, i: number) => {
    const ratio = Math.min(value / MAX, 1);
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio];
  };
  const axisEnd = (i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const labelPos = (i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * (r + 16), cy + Math.sin(angle) * (r + 16)];
  };

  const dataPoints = AXES.map((a, i) => pointFor(stats[a.key], i));
  const polygon = dataPoints.map((p) => p.join(',')).join(' ');

  // 背景网格圈
  const rings = [0.33, 0.66, 1].map((f) => {
    const pts = AXES.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(angle) * r * f, cy + Math.sin(angle) * r * f].join(',');
    }).join(' ');
    return pts;
  });

  const total = AXES.reduce((s, a) => s + stats[a.key], 0);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`种族值雷达图，总和 ${total}：${AXES.map((a) => `${a.label}${stats[a.key]}`).join('，')}`}
    >
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#cbd5e1" strokeWidth={1} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = axisEnd(i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#cbd5e1" strokeWidth={1} />;
      })}
      <polygon
        points={polygon}
        fill="rgba(59,76,202,0.35)"
        stroke="#3b4cca"
        strokeWidth={2}
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#ee1515" />
      ))}
      {AXES.map((a, i) => {
        const [x, y] = labelPos(i);
        return (
          <text
            key={a.key}
            x={x}
            y={y}
            fontSize={10}
            fill="#334155"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {a.label} {stats[a.key]}
          </text>
        );
      })}
    </svg>
  );
}
