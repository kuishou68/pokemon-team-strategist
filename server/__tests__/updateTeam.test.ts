import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pokemon } from '../../shared/types.js';
import { PIKACHU, BLASTOISE, CHARIZARD, mkPokemon } from './fixtures.js';

// 桩 pokeapi：getPokemon 返回已知宝可梦，未知抛错（模拟幻觉宝可梦拒绝）
const KNOWN: Record<string, Pokemon> = {
  pikachu: { ...PIKACHU, flavorTextZh: '', height: 4, weight: 60, abilities: [] } as Pokemon,
  blastoise: { ...BLASTOISE, abilities: [] } as Pokemon,
  charizard: { ...CHARIZARD, abilities: [] } as Pokemon,
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
    toSnapshot: actual.toSnapshot,
  };
});

import { updateTeamTool } from '../src/tools/updateTeam.js';
import type { Session } from '../src/session.js';
import type { ToolContext } from '../src/tools/index.js';

function mkCtx(): { ctx: ToolContext; session: Session; changed: () => boolean } {
  const session: Session = {
    id: 'test', team: [], messages: [], createdAt: 0, lastAccess: 0,
    turnCount: 0, lock: Promise.resolve(),
  };
  let teamChanged = false;
  const ctx: ToolContext = {
    session,
    markTeamChanged: () => { teamChanged = true; },
  };
  return { ctx, session, changed: () => teamChanged };
}

async function run(tool = updateTeamTool, raw: Record<string, unknown>, ctx: ToolContext) {
  const v = tool.validate(raw);
  if (!v.ok) return { error: v.error };
  return tool.execute(v.args, ctx);
}

describe('update_team validate（按 action 分支）', () => {
  it('非法 action 报错', () => {
    const v = updateTeamTool.validate({ action: 'foo' });
    expect(v.ok).toBe(false);
  });
  it('add 缺 pokemon 报错', () => {
    const v = updateTeamTool.validate({ action: 'add' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('pokemon');
  });
  it('remove 缺 target 报错', () => {
    const v = updateTeamTool.validate({ action: 'remove' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('target');
  });
  it('replace 缺参报错', () => {
    expect(updateTeamTool.validate({ action: 'replace', target: '1' }).ok).toBe(false);
    expect(updateTeamTool.validate({ action: 'replace', pokemon: 'pikachu' }).ok).toBe(false);
  });
  it('中文名归一为英文', () => {
    const v = updateTeamTool.validate({ action: 'add', pokemon: '皮卡丘' });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.args.pokemon).toBe('pikachu');
  });
});

describe('update_team 状态机', () => {
  let env: ReturnType<typeof mkCtx>;
  beforeEach(() => { env = mkCtx(); });

  it('add 加入并标记变更', async () => {
    const r = await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    expect(env.session.team.map((p) => p.name)).toEqual(['pikachu']);
    expect(env.changed()).toBe(true);
    expect((r as { summary: string }).summary).toContain('皮卡丘');
  });

  it('add 幻觉宝可梦被拒绝（不入队）', async () => {
    const r = await run(updateTeamTool, { action: 'add', pokemon: 'fakemonxyz' }, env.ctx);
    expect(env.session.team.length).toBe(0);
    expect(env.changed()).toBe(false);
    expect((r as { summary: string }).summary).toContain('不是有效');
  });

  it('add 重复宝可梦被拒绝', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    const r = await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    expect(env.session.team.length).toBe(1);
    expect((r as { summary: string }).summary).toContain('已经在队伍');
  });

  it('满 6 拒绝', async () => {
    env.session.team = [
      mkPokemon(1, 'a', 'A', ['normal']), mkPokemon(2, 'b', 'B', ['normal']),
      mkPokemon(3, 'c', 'C', ['normal']), mkPokemon(4, 'd', 'D', ['normal']),
      mkPokemon(5, 'e', 'E', ['normal']), mkPokemon(6, 'f', 'F', ['normal']),
    ];
    const r = await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    expect(env.session.team.length).toBe(6);
    expect((r as { summary: string }).summary).toContain('已满');
  });

  it('remove 空队伍友好提示', async () => {
    const r = await run(updateTeamTool, { action: 'remove', target: '1' }, env.ctx);
    expect((r as { summary: string }).summary).toContain('队伍为空');
  });

  it('remove 按槽位号移除', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    await run(updateTeamTool, { action: 'add', pokemon: 'blastoise' }, env.ctx);
    await run(updateTeamTool, { action: 'remove', target: '1' }, env.ctx);
    expect(env.session.team.map((p) => p.name)).toEqual(['blastoise']);
  });

  it('remove 按中文名移除', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    await run(updateTeamTool, { action: 'remove', target: '皮卡丘' }, env.ctx);
    expect(env.session.team.length).toBe(0);
  });

  it('remove 找不到目标提示', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    const r = await run(updateTeamTool, { action: 'remove', target: 'nonexist' }, env.ctx);
    expect(env.session.team.length).toBe(1);
    expect((r as { summary: string }).summary).toContain('找不到');
  });

  it('replace 换掉水系换电系（核心多轮场景）', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'blastoise' }, env.ctx);
    const r = await run(updateTeamTool, { action: 'replace', target: '水箭龟', pokemon: 'jolteon' }, env.ctx);
    expect(env.session.team.map((p) => p.name)).toEqual(['jolteon']);
    expect((r as { summary: string }).summary).toContain('替换');
  });

  it('replace 目标不存在提示', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    const r = await run(updateTeamTool, { action: 'replace', target: '水箭龟', pokemon: 'jolteon' }, env.ctx);
    expect((r as { summary: string }).summary).toContain('找不到');
  });

  it('replace 新宝可梦是幻觉则拒绝', async () => {
    await run(updateTeamTool, { action: 'add', pokemon: 'pikachu' }, env.ctx);
    const r = await run(updateTeamTool, { action: 'replace', target: '皮卡丘', pokemon: 'fakemon' }, env.ctx);
    expect(env.session.team.map((p) => p.name)).toEqual(['pikachu']);
    expect((r as { summary: string }).summary).toContain('不是有效');
  });
});
