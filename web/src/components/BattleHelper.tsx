import { useState } from 'react';

// 对战助手：输入对手 → 转成 chat 消息发给 Agent（Agent 为真相源）
export function BattleHelper({
  onAsk,
  disabled,
}: {
  onAsk: (text: string) => void;
  disabled?: boolean;
}) {
  const [opponent, setOpponent] = useState('');

  const submit = () => {
    const o = opponent.trim();
    if (!o || disabled) return;
    onAsk(`对手派出了 ${o}，我应该换上队伍里的谁？`);
    setOpponent('');
  };

  return (
    <div className="gb-panel p-3">
      <h3 className="font-bold text-sm mb-2">⚔️ 对战助手</h3>
      <div className="flex gap-1.5">
        <input
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="对手宝可梦（如 喷火龙）"
          className="flex-1 text-xs border-2 border-slate-300 rounded px-2 py-1 focus:border-poke-blue outline-none"
          disabled={disabled}
        />
        <button
          onClick={submit}
          disabled={disabled}
          className="bg-poke-red text-white text-xs px-3 rounded shadow-gbsm disabled:opacity-50"
        >
          建议
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">
        基于属性和种族值的快速参考。
      </p>
    </div>
  );
}
