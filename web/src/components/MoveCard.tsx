import type { MoveDetail } from '../types';
import { TypeBadge } from './TypeBadge';

export function MoveCard({ data }: { data: MoveDetail }) {
  const dcColor =
    data.damageClass === 'physical'
      ? 'bg-orange-500'
      : data.damageClass === 'special'
        ? 'bg-indigo-500'
        : 'bg-gray-400';
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md" data-testid="move-card">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-bold">{data.nameZh}</span>
        <span className="text-xs text-slate-500">{data.name}</span>
        <TypeBadge type={data.type} small />
        <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${dcColor}`}>
          {data.damageClassZh}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Stat label="威力" value={data.power ?? '—'} />
        <Stat label="命中" value={data.accuracy != null ? `${data.accuracy}%` : '—'} />
        <Stat label="PP" value={data.pp ?? '—'} />
      </div>
      {data.descriptionZh && (
        <p className="text-[11px] text-slate-600 mt-3 leading-snug">{data.descriptionZh}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gb-panel py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
