import type { ToolStepInfo } from '../types';

// 工具调用链可视化：人话标签 + 时间线 + 状态动效
const TOOL_ICON: Record<string, string> = {
  search_pokemon: '🔍',
  get_type_matchups: '⚡',
  get_move_detail: '📖',
  get_evolution_chain: '🧬',
  analyze_team: '🛡️',
  recommend_switch: '⚔️',
  update_team: '🎒',
};

function StatusDot({ status }: { status: ToolStepInfo['status'] }) {
  if (status === 'running') return <span className="pokeball-spin inline-block" style={{ width: 14, height: 14, borderWidth: 2 }} />;
  if (status === 'done') return <span className="text-green-600">✓</span>;
  return <span className="text-poke-red">✕</span>;
}

export function ToolTrace({ steps }: { steps: ToolStepInfo[] }) {
  if (!steps.length) return null;
  return (
    <details className="mt-1 text-[11px]" open>
      <summary className="cursor-pointer text-slate-500 select-none">
        🔧 工具调用（{steps.length}）
      </summary>
      <ul className="mt-1 ml-1 border-l-2 border-slate-200 pl-3 space-y-1">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span>{TOOL_ICON[s.tool] ?? '•'}</span>
            <span className="text-slate-600">{s.label}</span>
            <StatusDot status={s.status} />
          </li>
        ))}
      </ul>
    </details>
  );
}
