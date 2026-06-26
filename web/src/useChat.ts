// ============================================================
// 聊天状态管理 + localStorage 持久化（历史）+ team 状态（服务端权威）
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, fetchTeam, restoreTeam } from './api/chat';
import type {
  ChatMessage,
  Card,
  PokemonSnapshot,
  ToolStepInfo,
} from './types';

const HISTORY_KEY = 'pts_history_v1';
const TEAM_KEY = 'pts_team_v1';

function loadTeamLocal(): PokemonSnapshot[] {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (raw) return JSON.parse(raw) as PokemonSnapshot[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveTeamLocal(team: PokemonSnapshot[]) {
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(team));
  } catch {
    /* ignore */
  }
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    // 避免存太多
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-50)));
  } catch {
    /* ignore */
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${Date.now()}_${idCounter}`;
}

export interface UseChat {
  messages: ChatMessage[];
  team: PokemonSnapshot[];
  busy: boolean;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useChat(): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [team, setTeam] = useState<PokemonSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 刷新恢复：先拉服务端队伍；若服务端为空但本地有（重启/tsx watch 清了内存），回灌
  useEffect(() => {
    (async () => {
      try {
        const serverTeam = await fetchTeam();
        if (serverTeam.length > 0) {
          setTeam(serverTeam);
          saveTeamLocal(serverTeam);
          return;
        }
        const localTeam = loadTeamLocal();
        if (localTeam.length > 0) {
          const restored = await restoreTeam(localTeam.map((p) => p.id));
          setTeam(restored);
          saveTeamLocal(restored);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setBusy(true);

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: trimmed };
      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        cards: [],
        steps: [],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const ac = new AbortController();
      abortRef.current = ac;

      const updateAssistant = (fn: (m: ChatMessage) => ChatMessage) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? fn(m) : m)),
        );
      };

      streamChat(trimmed, {
        signal: ac.signal,
        onEvent: (event) => {
          switch (event.type) {
            case 'token':
              updateAssistant((m) => ({ ...m, content: m.content + event.text }));
              break;
            case 'cards':
              updateAssistant((m) => ({
                ...m,
                cards: [...(m.cards ?? []), ...event.cards],
              }));
              break;
            case 'step_start':
              updateAssistant((m) => ({
                ...m,
                steps: [...(m.steps ?? []), event.step],
              }));
              break;
            case 'tool_output':
              updateAssistant((m) => ({
                ...m,
                steps: (m.steps ?? []).map((s: ToolStepInfo) =>
                  s.id === event.id ? { ...s, status: event.status } : s,
                ),
              }));
              break;
            case 'team':
              setTeam(event.pokemon);
              saveTeamLocal(event.pokemon); // 持久化，重启后可回灌
              break;
            case 'notice':
              if (event.level === 'error') setError(event.text);
              break;
            case 'error':
              setError(event.message);
              break;
            case 'done':
              break;
            default:
              break;
          }
        },
      })
        .catch((e) => {
          if (!ac.signal.aborted) setError(String(e));
        })
        .finally(() => {
          setBusy(false);
          abortRef.current = null;
        });
    },
    [busy],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    // 注意：不清队伍（队伍是服务端权威 + 本地回灌缓存）；如需清队伍走"清空队伍"操作
  }, []);

  return { messages, team, busy, error, send, stop, clear };
}

export type { Card };
