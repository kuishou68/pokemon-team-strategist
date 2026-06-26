import type { Tool } from './index.js';
import { getPokemon, toSnapshot } from '../services/pokeapi.js';
import { recommendSwitch } from '../lib/analysis.js';
import { resolvePokemonQuery } from '../lib/aliases.js';

export const recommendSwitchTool: Tool = {
  name: 'recommend_switch',
  description:
    '对战换人建议：给定对手宝可梦，对当前队伍每只算防御/进攻/速度评分并排序推荐。' +
    '只需传 opponent（对手英文名或 id）——你的队伍直接从服务器当前状态读取，不要传队伍。' +
    '评分全由代码计算（基于属性和种族值的快速参考）。',
  parameters: {
    type: 'object',
    properties: {
      opponent: {
        type: 'string',
        description: '对手宝可梦英文名或 id，例如 "charizard"',
      },
    },
    required: ['opponent'],
  },
  label: (args) => `对战建议 vs ${args.opponent ?? ''}`,
  validate: (args) => {
    const o = args.opponent;
    if (typeof o !== 'string' || !o.trim()) {
      return { ok: false, error: '缺少 opponent 参数（对手宝可梦英文名或 id）' };
    }
    return { ok: true, args: { opponent: resolvePokemonQuery(o) } };
  },
  execute: async (args, ctx) => {
    const team = ctx.session.team;
    if (team.length === 0) {
      return {
        summary: '当前队伍为空，无法给出换人建议。请先组建队伍。',
      };
    }
    const opponentQuery = String(args.opponent);
    let opponentSnap;
    try {
      const opp = await getPokemon(opponentQuery, ctx.signal);
      opponentSnap = toSnapshot(opp);
    } catch {
      return { summary: `找不到对手 "${opponentQuery}"。请确认英文名。` };
    }
    const rec = recommendSwitch(team, opponentSnap);
    const top = rec.ranked[0];
    return {
      summary: `对手是 ${opponentSnap.nameZh}。推荐换上：${top.pokemon.nameZh}（综合分 ${top.score}，${top.reason}）。${rec.note}`,
      cards: [{ kind: 'switch', data: rec }],
    };
  },
};
