import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

const QUICK_PROMPTS = [
  '推荐一支均衡的队伍',
  '皮卡丘怎么样？',
  '火系克制什么属性？',
  '分析我的队伍短板',
  '伊布的进化链',
];

export function ChatWindow({
  messages,
  busy,
  error,
  onSend,
  onStop,
  onClear,
}: {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    onSend(t);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scroll p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-8">
            <div className="text-4xl mb-2">⚡</div>
            <p className="text-sm">你好，训练家！我是宝可梦队伍策略师。</p>
            <p className="text-xs mt-1">告诉我你想组什么队，或试试下面的快捷入口。</p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={m.id} message={m} busy={busy && i === messages.length - 1} />
        ))}
        {error && (
          <div className="text-center">
            <span className="inline-block bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full">
              {error}
            </span>
          </div>
        )}
      </div>

      {/* 快捷入口 */}
      <div className="px-3 pt-2 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            disabled={busy}
            className="text-[11px] bg-white border-2 border-slate-200 rounded-full px-2.5 py-0.5 hover:border-poke-blue disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="描述你的对战需求或想要的宝可梦…"
          className="flex-1 resize-none text-sm border-2 border-slate-300 rounded-lg px-3 py-2 focus:border-poke-blue outline-none gb-card"
        />
        {busy ? (
          <button
            onClick={onStop}
            className="bg-slate-500 text-white px-4 py-2 rounded-lg text-sm shadow-gbsm"
          >
            停止
          </button>
        ) : (
          <button
            onClick={submit}
            className="bg-poke-red text-white px-4 py-2 rounded-lg text-sm shadow-gbsm hover:bg-poke-darkred"
          >
            发送
          </button>
        )}
        {messages.length > 0 && (
          <button
            onClick={onClear}
            title="清空对话"
            className="text-slate-400 text-xs px-2 py-2"
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}
