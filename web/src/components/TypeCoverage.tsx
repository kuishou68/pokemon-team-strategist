import { useMemo, useState } from 'react';
import type { PokemonSnapshot, TypeName } from '../types';
import { analyzeTeam } from '../lib/analysis';
import { TYPE_COLORS } from './TypeBadge';

// 双视图：简单图标摘要 ↔ 详细表格
export function TypeCoverage({ team }: { team: PokemonSnapshot[] }) {
  const [detailed, setDetailed] = useState(false);
  const analysis = useMemo(() => analyzeTeam(team), [team]);

  if (team.length === 0) {
    return (
      <div className="gb-panel p-3">
        <h3 className="font-bold text-sm mb-1">🛡️ 克制覆盖</h3>
        <p className="text-[11px] text-slate-400">队伍为空。组队后这里会显示属性攻防覆盖与短板。</p>
      </div>
    );
  }

  const weakSet = new Set(analysis.weaknesses.map((w) => w.type));

  return (
    <div className="gb-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🛡️ 克制覆盖</h3>
        <button
          onClick={() => setDetailed((d) => !d)}
          className="text-[10px] text-poke-blue underline"
        >
          {detailed ? '简洁视图' : '详细表格'}
        </button>
      </div>

      {analysis.weaknesses.length > 0 && (
        <div className="mb-2 text-[11px]">
          <span className="text-poke-red font-semibold">⚠️ 短板：</span>
          {analysis.weaknesses.map((w) => (
            <span
              key={w.type}
              className="inline-block text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 weak-highlight"
              style={{ backgroundColor: TYPE_COLORS[w.type as TypeName] }}
              title={w.reason}
            >
              {w.typeZh}
            </span>
          ))}
        </div>
      )}

      {!detailed ? (
        <SimpleView analysis={analysis} weakSet={weakSet} />
      ) : (
        <DetailedView analysis={analysis} weakSet={weakSet} />
      )}
    </div>
  );
}

function SimpleView({
  analysis,
  weakSet,
}: {
  analysis: ReturnType<typeof analyzeTeam>;
  weakSet: Set<TypeName>;
}) {
  // 每属性一个色块：被克(红边)/有抵抗(绿点)/能克制(剑)
  return (
    <div className="grid grid-cols-6 gap-1">
      {analysis.defensive.map((d) => {
        const off = analysis.offensive.find((o) => o.type === d.type)!;
        const isWeak = weakSet.has(d.type);
        return (
          <div
            key={d.type}
            className={`relative rounded text-center py-1 text-white text-[9px] border ${isWeak ? 'weak-highlight border-poke-red border-2' : 'border-black/10'}`}
            style={{ backgroundColor: TYPE_COLORS[d.type as TypeName] }}
            title={`${d.typeZh}：被克 ${d.weakCount}，抵抗 ${d.resistCount}，免疫 ${d.immuneCount}；可克制 ${off.coveredBy}`}
          >
            {d.typeZh}
            <div className="text-[8px] opacity-90">
              {d.resistCount + d.immuneCount > 0 ? '🛡' : ''}
              {off.coveredBy > 0 ? '⚔' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailedView({
  analysis,
  weakSet,
}: {
  analysis: ReturnType<typeof analyzeTeam>;
  weakSet: Set<TypeName>;
}) {
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="text-[10px] w-full">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left">属性</th>
            <th>被克</th>
            <th>抵抗</th>
            <th>免疫</th>
            <th>可克制</th>
          </tr>
        </thead>
        <tbody>
          {analysis.defensive.map((d) => {
            const off = analysis.offensive.find((o) => o.type === d.type)!;
            return (
              <tr key={d.type} className={weakSet.has(d.type) ? 'bg-red-50' : ''}>
                <td className="font-semibold">{d.typeZh}</td>
                <td className="text-center text-poke-red">{d.weakCount || ''}</td>
                <td className="text-center text-green-600">{d.resistCount || ''}</td>
                <td className="text-center text-blue-600">{d.immuneCount || ''}</td>
                <td className="text-center">{off.coveredBy || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
