import type { SwitchRecommendation } from '../types';
import { TypeBadge } from './TypeBadge';
import { Sprite } from './Sprite';

export function SwitchCard({ data }: { data: SwitchRecommendation }) {
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md" data-testid="switch-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-slate-500">⚔️ 对战换人建议 · 对手</span>
        <Sprite src={data.opponent.spriteUrl} alt={data.opponent.nameZh} className="w-8 h-8 object-contain" />
        <span className="text-sm font-bold">{data.opponent.nameZh}</span>
        <div className="flex gap-1">
          {data.opponent.types.map((t) => <TypeBadge key={t.name} type={t} small />)}
        </div>
      </div>
      <ol className="space-y-1.5">
        {data.ranked.map((s, i) => (
          <li
            key={s.pokemon.id}
            className={`flex items-center gap-2 p-1.5 rounded ${i === 0 ? 'bg-poke-yellow/30 border border-poke-gold' : ''}`}
          >
            <span className="font-pixel text-[10px] w-5 text-center">{i + 1}</span>
            <Sprite src={s.pokemon.pixelSpriteUrl} alt={s.pokemon.nameZh} className="w-8 h-8 object-contain" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">{s.pokemon.nameZh}</span>
                <span className="text-[10px] text-slate-500">综合 {s.score}</span>
                {s.fasterThanOpponent && <span className="text-[9px] text-green-600">先手</span>}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{s.reason}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[10px] text-slate-400 mt-2 border-t pt-1">{data.note}</p>
    </div>
  );
}
