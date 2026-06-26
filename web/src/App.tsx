import { useState } from 'react';
import { useChat } from './useChat';
import { ChatWindow } from './components/ChatWindow';
import { Dashboard } from './components/Dashboard';
import { AudioToggle } from './components/AudioToggle';

export default function App() {
  const { messages, team, busy, error, send, stop, clear } = useChat();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* 顶栏 */}
      <header className="relative z-[60] flex items-center justify-between px-4 py-2 bg-poke-red text-white shadow-md border-b-4 border-poke-darkred">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔴</span>
          <h1 className="font-pixel text-xs sm:text-sm">宝可梦队伍策略师</h1>
        </div>
        <div className="flex items-center gap-2">
          <AudioToggle />
          {/* 移动端切换 Dashboard 抽屉（toggle：再点可收起） */}
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            className="lg:hidden gb-card px-2 py-1 text-xs text-black"
          >
            {drawerOpen ? '✕ 收起' : `🎒 队伍 ${team.length}/6`}
          </button>
        </div>
      </header>

      {/* 双栏布局 */}
      <div className="flex-1 min-h-0 flex">
        {/* 左：Chat */}
        <main className="flex-1 min-w-0 border-r-2 border-slate-200">
          <ChatWindow
            messages={messages}
            busy={busy}
            error={error}
            onSend={send}
            onStop={stop}
            onClear={clear}
          />
        </main>

        {/* 右：常驻 Dashboard（桌面） */}
        <aside className="hidden lg:block w-[360px] shrink-0 p-3 bg-slate-50/50">
          <Dashboard team={team} onAsk={send} busy={busy} />
        </aside>
      </div>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="w-[85%] max-w-sm bg-white p-3 overflow-y-auto thin-scroll">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold">面板</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-500 text-lg">×</button>
            </div>
            <Dashboard
              team={team}
              onAsk={(t) => {
                send(t);
                setDrawerOpen(false);
              }}
              busy={busy}
            />
          </div>
        </div>
      )}
    </div>
  );
}
