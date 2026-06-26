import type { Tool } from './index.js';
import { getPokemon } from '../services/pokeapi.js';
import { resolvePokemonQuery } from '../lib/aliases.js';

export const searchPokemonTool: Tool = {
  name: 'search_pokemon',
  description:
    '按名字或图鉴编号查询一只宝可梦的基础信息（属性、种族值、官方立绘、特性）。' +
    '参数 query 用英文名或数字 id（如 "pikachu" 或 25）。若用户给中文名，尽量转成英文名。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '宝可梦英文名或图鉴 id，例如 "charizard" 或 "6"',
      },
    },
    required: ['query'],
  },
  label: (args) => `查询 ${args.query ?? ''}`,
  validate: (args) => {
    const q = args.query;
    if (typeof q !== 'string' || !q.trim()) {
      return { ok: false, error: '缺少 query 参数（宝可梦名或 id）' };
    }
    return { ok: true, args: { query: resolvePokemonQuery(q) } };
  },
  execute: async (args, ctx) => {
    const query = String(args.query);
    try {
      const p = await getPokemon(query, ctx.signal);
      const typesZh = p.types.map((t) => t.nameZh).join('/');
      return {
        summary: `${p.nameZh}(${p.name}, id=${p.id})｜属性:${typesZh}｜种族值总和:${p.total}（HP${p.stats.hp}/攻${p.stats.attack}/防${p.stats.defense}/特攻${p.stats.spAtk}/特防${p.stats.spDef}/速${p.stats.speed}）`,
        cards: [{ kind: 'pokemon', data: p }],
      };
    } catch {
      return {
        summary: `没有找到名为 "${query}" 的宝可梦。请确认英文名拼写或换一个名字。`,
      };
    }
  },
};
