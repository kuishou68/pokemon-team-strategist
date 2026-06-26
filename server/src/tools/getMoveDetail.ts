import type { Tool } from './index.js';
import { getMove } from '../services/pokeapi.js';

export const getMoveDetailTool: Tool = {
  name: 'get_move_detail',
  description:
    '查询一个招式的详情（威力、命中、PP、属性、物理/特殊/变化）。参数 move 用英文招式名或 id（如 "thunderbolt"）。',
  parameters: {
    type: 'object',
    properties: {
      move: {
        type: 'string',
        description: '英文招式名或 id，例如 "thunderbolt" 或 "85"',
      },
    },
    required: ['move'],
  },
  label: (args) => `查招式 ${args.move ?? ''}`,
  validate: (args) => {
    const m = args.move;
    if (typeof m !== 'string' || !m.trim()) {
      return { ok: false, error: '缺少 move 参数（英文招式名或 id）' };
    }
    return { ok: true, args: { move: m.trim().toLowerCase().replace(/\s+/g, '-') } };
  },
  execute: async (args, ctx) => {
    const move = String(args.move);
    try {
      const m = await getMove(move, ctx.signal);
      return {
        summary: `${m.nameZh}(${m.name})｜属性:${m.type.nameZh}｜威力:${m.power ?? '—'}｜命中:${m.accuracy ?? '—'}｜PP:${m.pp ?? '—'}｜${m.damageClassZh}`,
        cards: [{ kind: 'move', data: m }],
      };
    } catch {
      return { summary: `没有找到名为 "${move}" 的招式。请确认英文招式名拼写。` };
    }
  },
};
