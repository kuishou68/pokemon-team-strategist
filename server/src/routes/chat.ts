// ============================================================
// /api/chat SSE 适配：HTTP <-> agent emit 解耦
// - cookie/header 在 writeHead 之前一次性写出
// - res.on('close') 取消传导（非 req.on('close')）
// - 单 session mutex（队伍变更也在锁内）
// ============================================================

import type { Request, Response } from 'express';
import { serialize, parse } from 'cookie';
import {
  getOrCreateSession,
  getSession,
  acquireLock,
  MAX_TURNS_PER_SESSION,
} from '../session.js';
import { runAgent } from '../agent.js';
import type { SSEEvent } from '../../../shared/types.js';
import { logger } from '../logger.js';

const COOKIE_NAME = 'pts_sid';
const MAX_INPUT_LEN = 2000;

function readSid(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return parse(header)[COOKIE_NAME];
}

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const message: unknown = req.body?.message;

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '缺少 message 字段' });
    return;
  }
  if (message.length > MAX_INPUT_LEN) {
    res.status(400).json({ error: `消息过长（上限 ${MAX_INPUT_LEN} 字）` });
    return;
  }

  // 找/建 session
  const existingSid = readSid(req);
  let session = getSession(existingSid);
  const isNew = !session;
  if (!session) session = getOrCreateSession(undefined);

  if (session.turnCount >= MAX_TURNS_PER_SESSION) {
    res.status(429).json({ error: '本会话轮数已达上限，请刷新开始新会话。' });
    return;
  }

  // header + cookie 一次性在 writeHead 之前写出（防 ERR_HTTP_HEADERS_SENT）
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
  if (isNew) {
    headers['Set-Cookie'] = serialize(COOKIE_NAME, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    });
  }
  res.writeHead(200, headers);

  const ac = new AbortController();
  // res.on('close')（非 req）：客户端断开 → abort LLM 流与上游 fetch
  res.on('close', () => {
    ac.abort();
  });

  const send = (event: SSEEvent) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // 心跳
  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  // 单 session mutex（队伍变更也在锁内）
  const release = await acquireLock(session);
  try {
    session.turnCount += 1;
    await runAgent({
      session,
      userMessage: message,
      emit: send,
      signal: ac.signal,
    });
  } catch (e) {
    logger.error('chat handler error', { err: String(e) });
    send({ type: 'error', message: '服务器内部错误。' });
  } finally {
    release();
    clearInterval(ping);
    if (!res.writableEnded) res.end();
  }
}
