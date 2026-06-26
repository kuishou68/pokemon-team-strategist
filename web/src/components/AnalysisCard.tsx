import type { TeamAnalysis, TypeName } from '../types';
import { TYPE_COLORS } from './TypeBadge';

export function AnalysisCard({ data }: { data: TeamAnalysis }) {
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md" data-testid="analysis-card">
      <div className="text-xs text-slate-500 mb-2">🛡️ 队伍克制覆盖分析（{data.teamSize} 只）</div>
      {data.weaknesses.length > 0 ? (
        <div className="mb-2">
          <div className="text-[11px] font-semibold text-poke-red">⚠️ 短板属性</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.weaknesses.map((w) => (
              <span
                key={w.type}
                className="text-white text-[10px] px-2 py-0.5 rounded-full border border-black/20 weak-highlight"
                style={{ backgroundColor: TYPE_COLORS[w.type as TypeName] }}
                title={w.reason}
              >
                {w.typeZh}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-green-600 mb-2">✓ 无明显短板，属性覆盖均衡</div>
      )}
      <div className="text-[10px] text-slate-400">
        详细攻防热力见右侧 Dashboard 的「克制覆盖」面板。
      </div>
    </div>
  );
}
