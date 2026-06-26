import type { Tool, ToolContext, ToolResult } from './index.js';
import { getPokemon, toSnapshot } from '../services/pokeapi.js';
import { resolvePokemonQuery } from '../lib/aliases.js';
import type { PokemonSnapshot } from '../../../shared/types.js';

const MAX_TEAM = 6;

/**
 * 解析 target（要移除/替换的目标）：可为槽位数字(1-based)、英文名、中文名。
 * 返回 team 数组下标，未命中返回 -1。
 */
function resolveTargetIndex(team: PokemonSnapshot[], target: string): number {
  const t = target.trim();
  // 槽位数字
  if (/^\d+$/.test(t)) {
    const slot = Number(t);
    if (slot >= 1 && slot <= team.length) return slot - 1;
    // 也可能传的是 id
    const byId = team.findIndex((p) => p.id === slot);
    if (byId >= 0) return byId;
    return -1;
  }
  const norm = resolvePokemonQuery(t);
  // 英文名匹配
  const byName = team.findIndex(
    (p) => p.name === norm || p.name === t.toLowerCase(),
  );
  if (byName >= 0) return byName;
  // 中文名匹配
  const byZh = team.findIndex((p) => p.nameZh === t);
  if (byZh >= 0) return byZh;
  return -1;
}

export const updateTeamTool: Tool = {
  name: 'update_team',
  description:
    '增/删/替换当前队伍成员（队伍存在服务器，≤6 只）。根据 action 传不同参数：\n' +
    '- action="add"：把 pokemon（英文名/id）加入队伍。例：{"action":"add","pokemon":"pikachu"}\n' +
    '- action="remove"：移除 target（可为槽位号 1-6、英文名或中文名）。例：{"action":"remove","target":"水箭龟"}\n' +
    '- action="replace"：把 target 换成 pokemon。例：{"action":"replace","target":"3","pokemon":"jolteon"}\n' +
    '满 6 只时 add 会被拒绝；重复宝可梦会被拒绝。',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'remove', 'replace'] },
      pokemon: {
        type: 'string',
        description: 'add/replace 时必填：要加入的宝可梦英文名或 id',
      },
      target: {
        type: 'string',
        description: 'remove/replace 时必填：要移除的队员（槽位号 1-6 / 英文名 / 中文名）',
      },
    },
    required: ['action'],
  },
  label: (args) => {
    const a = args.action;
    if (a === 'add') return `加入队伍 ${args.pokemon ?? ''}`;
    if (a === 'remove') return `移出队伍 ${args.target ?? ''}`;
    if (a === 'replace') return `替换队员 ${args.target ?? ''} → ${args.pokemon ?? ''}`;
    return '更新队伍';
  },
  // 按 action 分支校验（合并工具的必要代价）
  validate: (args) => {
    const action = args.action;
    if (action !== 'add' && action !== 'remove' && action !== 'replace') {
      return { ok: false, error: 'action 必须是 "add" / "remove" / "replace" 之一' };
    }
    if (action === 'add') {
      if (typeof args.pokemon !== 'string' || !args.pokemon.trim()) {
        return { ok: false, error: 'action=add 需要 pokemon 参数（要加入的宝可梦英文名或 id）' };
      }
      return { ok: true, args: { action, pokemon: resolvePokemonQuery(args.pokemon) } };
    }
    if (action === 'remove') {
      if (typeof args.target !== 'string' || !args.target.trim()) {
        return { ok: false, error: 'action=remove 需要 target 参数（槽位号/英文名/中文名）' };
      }
      return { ok: true, args: { action, target: String(args.target).trim() } };
    }
    // replace
    if (typeof args.target !== 'string' || !args.target.trim()) {
      return { ok: false, error: 'action=replace 需要 target 参数（要替换掉的队员）' };
    }
    if (typeof args.pokemon !== 'string' || !args.pokemon.trim()) {
      return { ok: false, error: 'action=replace 需要 pokemon 参数（换上来的新宝可梦）' };
    }
    return {
      ok: true,
      args: { action, target: String(args.target).trim(), pokemon: resolvePokemonQuery(args.pokemon) },
    };
  },
  execute: async (args, ctx) => {
    const action = args.action as 'add' | 'remove' | 'replace';
    const team = ctx.session.team;

    if (action === 'add') return doAdd(args.pokemon as string, ctx);
    if (action === 'remove') return doRemove(args.target as string, ctx);
    return doReplace(args.target as string, args.pokemon as string, ctx);
  },
};

async function doAdd(pokemonQuery: string, ctx: ToolContext): Promise<ToolResult> {
  const team = ctx.session.team;
  if (team.length >= MAX_TEAM) {
    return {
      summary: `队伍已满（${MAX_TEAM} 只），无法加入新成员。请先移除一只，或用 replace 替换。`,
    };
  }
  // server 端先确认宝可梦存在（防加入幻觉宝可梦）
  let snap: PokemonSnapshot;
  try {
    const p = await getPokemon(pokemonQuery, ctx.signal);
    snap = toSnapshot(p);
  } catch {
    return { summary: `"${pokemonQuery}" 不是有效的宝可梦，未加入队伍。请确认英文名。` };
  }
  if (team.some((p) => p.id === snap.id)) {
    return { summary: `${snap.nameZh} 已经在队伍里了，无需重复加入。` };
  }
  team.push(snap);
  ctx.markTeamChanged();
  return {
    summary: `已将 ${snap.nameZh}(${snap.name}) 加入队伍。当前队伍 ${team.length}/${MAX_TEAM} 只：${team.map((p) => p.nameZh).join('、')}。`,
  };
}

async function doRemove(target: string, ctx: ToolContext): Promise<ToolResult> {
  const team = ctx.session.team;
  if (team.length === 0) {
    return { summary: '队伍为空，没有可移除的成员。' };
  }
  const idx = resolveTargetIndex(team, target);
  if (idx < 0) {
    return {
      summary: `队伍里找不到 "${target}"。当前队伍：${team.map((p, i) => `${i + 1}.${p.nameZh}`).join('、')}。`,
    };
  }
  const [removed] = team.splice(idx, 1);
  ctx.markTeamChanged();
  return {
    summary: `已将 ${removed.nameZh} 移出队伍。当前队伍 ${team.length}/${MAX_TEAM} 只：${team.map((p) => p.nameZh).join('、') || '（空）'}。`,
  };
}

async function doReplace(
  target: string,
  pokemonQuery: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const team = ctx.session.team;
  if (team.length === 0) {
    return { summary: '队伍为空，无可替换成员。请先用 add 添加宝可梦。' };
  }
  const idx = resolveTargetIndex(team, target);
  if (idx < 0) {
    return {
      summary: `队伍里找不到要替换的 "${target}"。当前队伍：${team.map((p, i) => `${i + 1}.${p.nameZh}`).join('、')}。`,
    };
  }
  let snap: PokemonSnapshot;
  try {
    const p = await getPokemon(pokemonQuery, ctx.signal);
    snap = toSnapshot(p);
  } catch {
    return { summary: `"${pokemonQuery}" 不是有效的宝可梦，未替换。请确认英文名。` };
  }
  // 重复检查（除被替换的那只本身）
  if (team.some((p, i) => p.id === snap.id && i !== idx)) {
    return { summary: `${snap.nameZh} 已经在队伍里了，不能重复加入。` };
  }
  const old = team[idx];
  team[idx] = snap;
  ctx.markTeamChanged();
  return {
    summary: `已将 ${old.nameZh} 替换为 ${snap.nameZh}(${snap.name})。当前队伍：${team.map((p) => p.nameZh).join('、')}。`,
  };
}

// 导出供测试
export { resolveTargetIndex };
