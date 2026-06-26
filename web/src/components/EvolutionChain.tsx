import type { EvolutionChain as Chain, EvolutionNode } from '../types';
import { Sprite } from './Sprite';

function NodeTile({ node }: { node: EvolutionNode }) {
  return (
    <div className="flex flex-col items-center text-center shrink-0">
      <div className="gb-panel p-1 w-16 h-16 flex items-center justify-center">
        <Sprite src={node.spriteUrl} alt={node.nameZh} className="w-14 h-14 object-contain" />
      </div>
      <span className="text-[11px] font-semibold mt-1">{node.nameZh}</span>
    </div>
  );
}

function Arrow({ condition }: { condition?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0">
      <span className="text-poke-blue text-lg leading-none">→</span>
      {condition && (
        <span className="text-[9px] text-slate-500 max-w-[80px] text-center leading-tight">
          {condition}
        </span>
      )}
    </div>
  );
}

// 线性链：横向；分支：第一阶段左，多去向纵向堆叠右
function ChainNode({ node }: { node: EvolutionNode }) {
  if (node.evolvesTo.length === 0) {
    return <NodeTile node={node} />;
  }
  if (node.evolvesTo.length === 1) {
    const child = node.evolvesTo[0];
    return (
      <div className="flex items-center">
        <NodeTile node={node} />
        <Arrow condition={child.condition} />
        <ChainNode node={child} />
      </div>
    );
  }
  // 分支：纵向堆叠
  return (
    <div className="flex items-center">
      <NodeTile node={node} />
      <div className="flex flex-col gap-2 ml-1">
        {node.evolvesTo.map((child) => (
          <div key={child.id} className="flex items-center">
            <Arrow condition={child.condition} />
            <ChainNode node={child} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 过多分支（>4）降级为列表
function BranchList({ root }: { root: EvolutionNode }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <NodeTile node={root} />
        <span className="text-xs text-slate-500">可进化为：</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {root.evolvesTo.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5 text-[11px]">
            <Sprite src={c.spriteUrl} alt={c.nameZh} className="w-8 h-8 object-contain" />
            <span className="font-semibold">{c.nameZh}</span>
            {c.condition && <span className="text-slate-400">{c.condition}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EvolutionChain({ data }: { data: Chain }) {
  const tooManyBranches = data.root.evolvesTo.length > 4;
  return (
    <div className="gb-card animate-slide-in p-3 w-full max-w-md overflow-x-auto thin-scroll" data-testid="evolution-chain">
      <div className="text-xs text-slate-500 mb-2">
        🧬 进化链 {data.isBranching && <span className="text-poke-blue">（分支进化）</span>}
      </div>
      {tooManyBranches ? (
        <BranchList root={data.root} />
      ) : (
        <div className="flex items-center min-w-max">
          <ChainNode node={data.root} />
        </div>
      )}
    </div>
  );
}
