// ============================================================
// 会话存储：有状态内存 Map + TTL/LRU + 单 session mutex
// session.team 是队伍单一数据源（注入块/team 事件/GET 都从它派生）
// ============================================================

import { randomUUID } from 'node:crypto';
import type { PokemonSnapshot } from '../../shared/types.js';

export interface ChatTurnMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  // assistant tool_calls / tool 关联（OpenAI 消息格式）
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

export interface Session {
  id: string;
  team: PokemonSnapshot[]; // ≤6，唯一真相
  messages: ChatTurnMessage[]; // 真实 user/assistant/tool 消息（注入块绝不写入）
  createdAt: number;
  lastAccess: number;
  turnCount: number;
  // 单 session mutex
  lock: Promise<void>;
}

const TTL_MS = 1000 * 60 * 60 * 2; // 2h
const MAX_SESSIONS = 500;
const MAX_TURNS = 100; // 单 session 轮数上限（滥用防护）
const MAX_MESSAGES = 80; // 历史消息上限（截断保留近期）

const store = new Map<string, Session>();

function evictIfNeeded() {
  const now = Date.now();
  for (const [id, s] of store) {
    if (now - s.lastAccess > TTL_MS) store.delete(id);
  }
  while (store.size > MAX_SESSIONS) {
    // 删最久未访问
    let oldestId: string | null = null;
    let oldest = Infinity;
    for (const [id, s] of store) {
      if (s.lastAccess < oldest) {
        oldest = s.lastAccess;
        oldestId = id;
      }
    }
    if (oldestId) store.delete(oldestId);
    else break;
  }
}

export function createSession(): Session {
  evictIfNeeded();
  const id = randomUUID();
  const s: Session = {
    id,
    team: [],
    messages: [],
    createdAt: Date.now(),
    lastAccess: Date.now(),
    turnCount: 0,
    lock: Promise.resolve(),
  };
  store.set(id, s);
  return s;
}

export function getSession(id: string | undefined): Session | undefined {
  if (!id) return undefined;
  const s = store.get(id);
  if (!s) return undefined;
  if (Date.now() - s.lastAccess > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  s.lastAccess = Date.now();
  return s;
}

export function getOrCreateSession(id: string | undefined): Session {
  return getSession(id) ?? createSession();
}

export function trimMessages(s: Session) {
  if (s.messages.length > MAX_MESSAGES) {
    s.messages = s.messages.slice(s.messages.length - MAX_MESSAGES);
  }
}

export const MAX_TURNS_PER_SESSION = MAX_TURNS;

/**
 * 单 session mutex：串行化对同一 session 的修改（队伍变更也在锁内）。
 * 返回 release 函数。
 */
export async function acquireLock(s: Session): Promise<() => void> {
  const prev = s.lock;
  let release!: () => void;
  s.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  return release;
}

export function sessionCount(): number {
  return store.size;
}
