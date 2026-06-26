import type { Card, TypeMatchup, TypeName } from '../types';
import { TYPE_COLORS } from './TypeBadge';

type MatchupData = Extract<Card, { kind: 'matchups' }>['data'];

function Chip({ m }: { m: TypeMatchup }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-white text-[10px] px-2 py-0.5 border border-black/20"
      style={{ backgroundColor: TYPE_COLORS[m.attackingType as TypeName] ?? '#888' }}
    >
      {m.attackingTypeZh}
      <b>{m.multiplier}×</b>
    </span>
  );
}

function Row({ title, items, empty }: { title: string; items: TypeMatchup[]; empty?: string }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-slate-600">{title}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {items.length ? items.map((m) => <Chip key={m.attackingType} m={m} />) : (
          <span className="text-[11px] text-slate-400">{empty ?? '无'}</span>
        )}
      </div>
    </div>
  );
}

export function MatchupsCard({ data }: { data: MatchupData }) {
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md" data-testid="matchups-card">
      <div className="flex items-center gap-2">
        <span
          className="text-white text-xs px-3 py-1 rounded-full"
          style={{ backgroundColor: TYPE_COLORS[data.type.name as TypeName] }}
        >
          {data.type.nameZh}系
        </span>
        <span className="text-xs text-slate-500">属性克制关系</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500 border-t pt-1">⚔️ 进攻视角</div>
      <Row title="效果拔群（克制）" items={data.strongAgainst} />
      <Row title="效果不佳" items={data.weakAgainst} />
      <div className="mt-2 text-[11px] text-slate-500 border-t pt-1">🛡️ 防御视角</div>
      <Row title="弱点（怕）" items={data.weakTo} />
      <Row title="抵抗" items={data.resists} />
      <Row title="免疫（0×）" items={data.immuneTo} empty="无" />
    </div>
  );
}
