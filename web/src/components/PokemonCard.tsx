import type { Pokemon, Stats } from '../types';
import { TypeBadge, TYPE_COLORS } from './TypeBadge';
import { StatRadar } from './StatRadar';
import { Sprite } from './Sprite';

const STAT_ROWS: { key: keyof Stats; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: '攻击' },
  { key: 'defense', label: '防御' },
  { key: 'spAtk', label: '特攻' },
  { key: 'spDef', label: '特防' },
  { key: 'speed', label: '速度' },
];

const MAX_STAT = 180;

function barColor(v: number): string {
  if (v >= 120) return '#22c55e';
  if (v >= 90) return '#84cc16';
  if (v >= 60) return '#eab308';
  if (v >= 40) return '#f97316';
  return '#ef4444';
}

export function PokemonCard({ data }: { data: Pokemon }) {
  const primaryColor = TYPE_COLORS[data.types[0]?.name] ?? '#888';
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md" data-testid="pokemon-card">
      <div className="flex gap-3">
        <div
          className="shrink-0 rounded-lg flex items-center justify-center w-28 h-28"
          style={{ background: `${primaryColor}22` }}
        >
          <Sprite
            src={data.spriteUrl}
            alt={data.nameZh}
            className="w-24 h-24 object-contain drop-shadow"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-bold">{data.nameZh}</span>
            <span className="text-xs text-slate-500">{data.name}</span>
            <span className="text-xs text-slate-400 font-pixel">#{String(data.id).padStart(3, '0')}</span>
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {data.types.map((t) => (
              <TypeBadge key={t.name} type={t} small />
            ))}
          </div>
          {data.flavorTextZh && (
            <p className="text-[11px] text-slate-600 mt-2 leading-snug line-clamp-3">
              {data.flavorTextZh}
            </p>
          )}
          {data.abilities && data.abilities.length > 0 && (
            <div className="text-[11px] text-slate-500 mt-1">
              特性：{data.abilities.map((a) => a.nameZh + (a.isHidden ? '(隐藏)' : '')).join('、')}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-3 items-center">
        {/* HP 条样式种族值 */}
        <div className="flex-1 w-full space-y-1">
          {STAT_ROWS.map((row) => {
            const v = data.stats[row.key];
            return (
              <div key={row.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-8 text-slate-600 shrink-0">{row.label}</span>
                <span className="w-7 text-right font-mono shrink-0">{v}</span>
                <div className="stat-bar-track flex-1">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min((v / MAX_STAT) * 100, 100)}%`, background: barColor(v) }}
                  />
                </div>
              </div>
            );
          })}
          <div className="text-[11px] text-right font-semibold text-slate-700 pt-0.5">
            种族值总和 {data.total}
          </div>
        </div>
        <div className="shrink-0">
          <StatRadar stats={data.stats} size={150} />
        </div>
      </div>
    </div>
  );
}
