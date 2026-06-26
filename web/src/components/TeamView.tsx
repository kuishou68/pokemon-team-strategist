import type { PokemonSnapshot } from '../types';
import { TypeBadge } from './TypeBadge';
import { Sprite } from './Sprite';

const MAX = 6;

export function TeamView({
  team,
  onRemove,
}: {
  team: PokemonSnapshot[];
  onRemove: (p: PokemonSnapshot, slot: number) => void;
}) {
  const slots = Array.from({ length: MAX }, (_, i) => team[i] ?? null);
  return (
    <div className="gb-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🎒 当前队伍</h3>
        <span className="text-[11px] text-slate-500 font-pixel">{team.length}/{MAX}</span>
      </div>
      {/* 横向一排 6 格，窄屏可横向滚动；卡片缩小 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {slots.map((p, i) =>
          p ? (
            <div
              key={p.id}
              className="gb-card p-1 flex flex-col items-center relative animate-slide-in shrink-0 w-[60px]"
              data-testid="team-slot-filled"
            >
              <button
                onClick={() => onRemove(p, i + 1)}
                className="absolute -top-1.5 -right-1.5 bg-poke-red text-white rounded-full w-4 h-4 text-[9px] leading-none border border-white shadow"
                title={`移除 ${p.nameZh}`}
                aria-label={`移除 ${p.nameZh}`}
              >
                ×
              </button>
              <Sprite src={p.spriteUrl} alt={p.nameZh} className="w-10 h-10 object-contain" />
              <span className="text-[10px] font-semibold truncate w-full text-center leading-tight">
                {p.nameZh}
              </span>
              <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                {p.types.map((t) => (
                  <TypeBadge key={t.name} type={t} small />
                ))}
              </div>
            </div>
          ) : (
            <div
              key={`empty-${i}`}
              className="flex flex-col items-center justify-center p-1 shrink-0 w-[60px]"
              data-testid="team-slot-empty"
            >
              <div className="pokeball-slot w-9" />
              <span className="text-[9px] text-slate-400 mt-1">空位</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
