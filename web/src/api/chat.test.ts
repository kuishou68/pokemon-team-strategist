import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamChat } from './chat';
import type { SSEEvent } from '../types';

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('streamChat SSE 解析', () => {
  it('解析多事件 + 跨 chunk 边界 + 忽略心跳', async () => {
    const body = sseStream([
      'data: {"type":"token","text":"你好"}\n\n: ping\n\ndata: {"type":"to',
      'ken","text":"训练家"}\n\n',
      'data: {"type":"done"}\n\n',
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const events: SSEEvent[] = [];
    await streamChat('hi', { onEvent: (e) => events.push(e) });

    const tokens = events.filter((e) => e.type === 'token').map((e: any) => e.text);
    expect(tokens).toEqual(['你好', '训练家']);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('解析 team 事件', async () => {
    const body = sseStream([
      'data: {"type":"team","pokemon":[{"id":25,"name":"pikachu","nameZh":"皮卡丘","types":[],"stats":{},"total":0,"spriteUrl":"","pixelSpriteUrl":""}]}\n\n',
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const events: SSEEvent[] = [];
    await streamChat('hi', { onEvent: (e) => events.push(e) });
    const teamEvt = events.find((e) => e.type === 'team') as any;
    expect(teamEvt.pokemon[0].nameZh).toBe('皮卡丘');
  });

  it('非 2xx 返回 error 事件', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: '轮数上限' }), { status: 429 })),
    );
    const events: SSEEvent[] = [];
    await streamChat('hi', { onEvent: (e) => events.push(e) });
    expect(events[0]).toEqual({ type: 'error', message: '轮数上限' });
  });
});
