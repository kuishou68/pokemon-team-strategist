// ============================================================
// SSE 客户端：fetch + ReadableStream（非 EventSource，因为是 POST）
// ============================================================

import type { SSEEvent } from '../types';

export interface ChatStreamHandlers {
  onEvent: (event: SSEEvent) => void;
  signal?: AbortSignal;
}

/**
 * 发起一轮聊天，逐事件回调。cookie 自动带上（credentials: 'include' 同源）。
 */
export async function streamChat(
  message: string,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    credentials: 'include',
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    let msg = `请求失败（${res.status}）`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    handlers.onEvent({ type: 'error', message: msg });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以 \n\n 分隔事件
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = rawEvent
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim());
      if (dataLines.length === 0) continue; // 心跳 ": ping"
      const payload = dataLines.join('\n');
      try {
        const event = JSON.parse(payload) as SSEEvent;
        handlers.onEvent(event);
      } catch {
        /* 忽略无法解析的行 */
      }
    }
  }
}

/** 拉取当前队伍（刷新恢复） */
export async function fetchTeam() {
  const res = await fetch('/api/team', { credentials: 'include' });
  if (!res.ok) return [];
  const j = await res.json();
  return j.pokemon ?? [];
}

/** 把本地缓存的队伍（按 id）回灌给服务端（重启后重建 session.team）。 */
export async function restoreTeam(ids: number[]) {
  const res = await fetch('/api/team/restore', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pokemon: ids }),
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j.pokemon ?? [];
}
