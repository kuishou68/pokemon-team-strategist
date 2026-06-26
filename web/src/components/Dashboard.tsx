import type { PokemonSnapshot } from '../types';
import { TeamView } from './TeamView';
import { TypeCoverage } from './TypeCoverage';
import { BattleHelper } from './BattleHelper';

// 右栏常驻 Dashboard：队伍 + 克制覆盖 + 对战助手
export function Dashboard({
  team,
  onAsk,
  busy,
}: {
  team: PokemonSnapshot[];
  onAsk: (text: string) => void;
  busy: boolean;
}) {
  const handleRemove = (p: PokemonSnapshot, slot: number) => {
    onAsk(`把队伍里的第 ${slot} 只（${p.nameZh}）移除掉。`);
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto thin-scroll pr-1">
      <TeamView team={team} onRemove={handleRemove} />
      <TypeCoverage team={team} />
      <BattleHelper onAsk={onAsk} disabled={busy} />
    </div>
  );
}
