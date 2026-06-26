import type { Tool } from './index.js';
import { getEvolutionChain } from '../services/pokeapi.js';
import { resolvePokemonQuery } from '../lib/aliases.js';
import type { EvolutionNode } from '../../../shared/types.js';

function flatten(node: EvolutionNode, prefix = ''): string {
  const self = `${node.nameZh}`;
  if (node.evolvesTo.length === 0) return prefix + self;
  const branches = node.evolvesTo
    .map((c) => `${c.nameZh}${c.condition ? `(${c.condition})` : ''}`)
    .join(' / ');
  const head = `${prefix}${self} → ${branches}`;
  const deeper = node.evolvesTo
    .filter((c) => c.evolvesTo.length > 0)
    .map((c) => flatten(c, ''))
    .join('；');
  return deeper ? `${head}；${deeper}` : head;
}

export const getEvolutionChainTool: Tool = {
  name: 'get_evolution_chain',
  description:
    '查询一只宝可梦的进化链（支持分支进化，如伊布）。参数 pokemon 用英文名或 id。返回进化路线与进化条件。',
  parameters: {
    type: 'object',
    properties: {
      pokemon: {
        type: 'string',
        description: '宝可梦英文名或 id，例如 "eevee"',
      },
    },
    required: ['pokemon'],
  },
  label: (args) => `查进化链 ${args.pokemon ?? ''}`,
  validate: (args) => {
    const p = args.pokemon;
    if (typeof p !== 'string' || !p.trim()) {
      return { ok: false, error: '缺少 pokemon 参数（宝可梦英文名或 id）' };
    }
    return { ok: true, args: { pokemon: resolvePokemonQuery(p) } };
  },
  execute: async (args, ctx) => {
    const pokemon = String(args.pokemon);
    try {
      const chain = await getEvolutionChain(pokemon, ctx.signal);
      return {
        summary: `进化链${chain.isBranching ? '(含分支)' : ''}：${flatten(chain.root)}`,
        cards: [{ kind: 'evolution', data: chain }],
      };
    } catch {
      return { summary: `无法获取 "${pokemon}" 的进化链。请确认英文名。` };
    }
  },
};
