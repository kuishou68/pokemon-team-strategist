import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pokemon } from '../../shared/types.js';
import { BLASTOISE, mkPokemon } from './fixtures.js';

// ---- 桩 pokeapi ----
const KNOWN: Record<string, Pokemon> = {
  blastoise: { ...BLASTOISE, abilities: [] } as Pokemon,
  jolteon: { ...mkPokemon(135, 'jolteon', '雷伊布', ['electric']), abilities: [] } as Pokemon,
};
vi.mock('../src/services/pokeapi.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/pokeapi.js')>(
    '../src/services/pokeapi.js',
  );
  return {
    ...actual,
    getPokemon: vi.fn(async (q: string | number) => {
      const key = String(q).toLowerCase();
      if (KNOWN[key]) return KNOWN[key];
      throw new Error('not found');
    }),
  };
});

// ---- 桩 LLM：脚本化的 completion 序列 ----
// 用一个队列驱动：每次 create 调用弹出一个脚本响应。
type ScriptResp =
  | { kind: 'tool'; calls: { name: string; args: Record<string, unknown> }[] }
  | { kind: 'text'; text: string };

let script: ScriptResp[] = [];
let createCallCount = 0;

vi.mock('../src/llm.js', async () => {
  const actual = await vi.importActual<typeof import('../src/llm.js')>('../src/llm.js');
  return {
    ...actual,
    MODEL: 'stub-model',
    openai: {
      chat: {
        completions: {
          create: vi.fn(async (params: { stream?: boolean }) => {
            createCallCount += 1;
            const resp = script.shift();
            if (!resp) {
              // 默认收尾文本
              if (params.stream) {
                return (async function* () {
                  yield { choices: [{ delta: { content: '好的。' } }] };
                })();
              }
              return { choices: [{ message: { content: '好的。', tool_calls: undefined } }] };
            }
            if (resp.kind === 'text') {
              if (params.stream) {
                // 终答流式轮
                return (async function* () {
                  for (const ch of resp.text) {
                    yield { choices: [{ delta: { content: ch } }] };
                  }
                })();
              }
              // 决策轮（非流式）：返回无工具调用的空响应，
              // 把本条 text 留给随后的终答流式轮消费。
              script.unshift(resp);
              return { choices: [{ message: { content: '', tool_calls: undefined } }] };
            }
            // tool 调用响应（决策轮非流式）
            return {
              choices: [
                {
                  message: {
                    content: '',
                    tool_calls: resp.calls.map((c, i) => ({
                      id: `call_${createCallCount}_${i}`,
                      type: 'function',
                      function: { name: c.name, arguments: JSON.stringify(c.args) },
                    })),
                  },
                },
              ],
            };
          }),
        },
      },
    },
  };
});

import { runAgent } from '../src/agent.js';
import type { Session } from '../src/session.js';
import type { SSEEvent } from '../../shared/types.js';

function mkSession(): Session {
  return {
    id: 's', team: [], messages: [], createdAt: 0, lastAccess: 0,
    turnCount: 0, lock: Promise.resolve(),
  };
}

async function runTurn(session: Session, msg: string) {
  const events: SSEEvent[] = [];
  const ac = new AbortController();
  await runAgent({
    session,
    userMessage: msg,
    emit: (e) => events.push(e),
    signal: ac.signal,
  });
  return events;
}

describe('agent 集成（桩 LLM + 内存 sink）', () => {
  beforeEach(() => {
    script = [];
    createCallCount = 0;
  });

  it('纯文本回答：无工具 → 流式 token + done', async () => {
    script = [{ kind: 'text', text: '你好训练家！' }];
    const session = mkSession();
    const events = await runTurn(session, '你好');
    const tokens = events.filter((e) => e.type === 'token').map((e: any) => e.text).join('');
    expect(tokens).toBe('你好训练家！');
    expect(events.some((e) => e.type === 'done')).toBe(true);
    // 无队伍变更 → 不应有 team 事件
    expect(events.some((e) => e.type === 'team')).toBe(false);
  });

  it('调 update_team(add) → emit team 事件 + cards 时序正确', async () => {
    script = [
      { kind: 'tool', calls: [{ name: 'update_team', args: { action: 'add', pokemon: 'blastoise' } }] },
      { kind: 'text', text: '已加入水箭龟。' },
    ];
    const session = mkSession();
    const events = await runTurn(session, '加入水箭龟');

    expect(session.team.map((p) => p.name)).toEqual(['blastoise']);

    const teamEvents = events.filter((e) => e.type === 'team');
    expect(teamEvents.length).toBe(1); // 每轮统一 emit 一次
    expect((teamEvents[0] as any).pokemon.map((p: any) => p.name)).toEqual(['blastoise']);

    // 时序：step_start → tool_output(done) → team → done
    const types = events.map((e) => e.type);
    expect(types.indexOf('step_start')).toBeLessThan(types.indexOf('team'));
    expect(types.indexOf('team')).toBeLessThan(types.indexOf('done'));
  });

  it('多轮"换掉水系换电系"：能读注入队伍并 replace', async () => {
    const session = mkSession();
    // 第一轮：先有水箭龟
    script = [
      { kind: 'tool', calls: [{ name: 'update_team', args: { action: 'add', pokemon: 'blastoise' } }] },
      { kind: 'text', text: 'ok' },
    ];
    await runTurn(session, '加入水箭龟');
    expect(session.team.map((p) => p.name)).toEqual(['blastoise']);

    // 第二轮：换掉水系换电系（模型用 replace，target 用中文名）
    script = [
      { kind: 'tool', calls: [{ name: 'update_team', args: { action: 'replace', target: '水箭龟', pokemon: 'jolteon' } }] },
      { kind: 'text', text: '已换成雷伊布' },
    ];
    const events = await runTurn(session, '换掉水系，换一个电系');
    expect(session.team.map((p) => p.name)).toEqual(['jolteon']);
    expect(events.filter((e) => e.type === 'team').length).toBe(1);
  });

  it('stopWhen：连续工具调用达到 6 步上限不死循环', async () => {
    // 脚本一直返回 tool 调用（analyze_team 无副作用），应在 6 步内停止
    script = Array.from({ length: 10 }, () => ({
      kind: 'tool' as const,
      calls: [{ name: 'analyze_team', args: {} }],
    }));
    const session = mkSession();
    const events = await runTurn(session, '反复分析');
    // create 调用次数不超过 6
    expect(createCallCount).toBeLessThanOrEqual(6);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('注入块不写入 session.messages', async () => {
    script = [{ kind: 'text', text: 'hi' }];
    const session = mkSession();
    await runTurn(session, '你好');
    const hasInjection = session.messages.some(
      (m) => typeof m.content === 'string' && m.content.includes('=== 当前队伍'),
    );
    expect(hasInjection).toBe(false);
  });
});
