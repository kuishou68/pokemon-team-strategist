import type { Tool } from './index.js';
import { outgoingMatchups, incomingMatchups } from '../lib/typechart.js';
import { TYPE_ZH } from '../lib/analysis.js';
import { resolveTypeQuery } from '../lib/aliases.js';
import { ALL_TYPES, type TypeName, type TypeMatchup } from '../../../shared/types.js';

const TYPE_SET = new Set<string>(ALL_TYPES);

export const getTypeMatchupsTool: Tool = {
  name: 'get_type_matchups',
  description:
    '查询某个属性（或双属性组合）的克制关系。传入 1~2 个英文属性名（如 ["fire"] 或 ["water","ground"]）。' +
    '返回：该属性进攻时克制谁/被谁抵抗，以及作为防御方时怕谁/抵抗谁/免疫谁。全部由静态克制表计算，零延迟。',
  parameters: {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string' },
        description: '1~2 个英文属性名，例如 ["fire"] 或 ["fire","flying"]',
      },
    },
    required: ['types'],
  },
  label: (args) => {
    const t = Array.isArray(args.types) ? (args.types as string[]).join('/') : '';
    return `查属性克制 ${t}`;
  },
  validate: (args) => {
    let types = args.types;
    if (typeof types === 'string') types = [types];
    if (!Array.isArray(types) || types.length === 0) {
      return { ok: false, error: '缺少 types 参数（1~2 个英文属性名的数组）' };
    }
    const normalized = (types as unknown[])
      .map((t) => resolveTypeQuery(String(t)))
      .filter((t) => TYPE_SET.has(t));
    if (normalized.length === 0) {
      return {
        ok: false,
        error: `属性名无效。合法属性：${ALL_TYPES.join(', ')}`,
      };
    }
    return { ok: true, args: { types: normalized.slice(0, 2) } };
  },
  execute: async (args) => {
    const types = (args.types as string[]) as TypeName[];
    const primary = types[0];

    // 进攻视角：primary 打 18 属性
    const out = outgoingMatchups(primary);
    const strongAgainst = out.filter((m) => m.multiplier > 1);
    const weakAgainst = out.filter((m) => m.multiplier < 1 && m.multiplier > 0);
    const noEffect = out.filter((m) => m.multiplier === 0);

    // 防御视角：18 属性打 (primary[,secondary])
    const inc = incomingMatchups(types);
    const weakTo = inc.filter((m) => m.multiplier > 1);
    const resists = inc.filter((m) => m.multiplier < 1 && m.multiplier > 0);
    const immuneTo = inc.filter((m) => m.multiplier === 0);

    const toMatchup = (
      m: { type: TypeName; multiplier: number },
    ): TypeMatchup => ({
      attackingType: m.type,
      attackingTypeZh: TYPE_ZH[m.type],
      multiplier: m.multiplier,
    });

    const typesZh = types.map((t) => TYPE_ZH[t]).join('/');
    const summary =
      `${typesZh}系：进攻克制[${strongAgainst.map((m) => TYPE_ZH[m.type] + ' ' + m.multiplier + '×').join('、') || '无'}]` +
      (noEffect.length ? `；进攻无效[${noEffect.map((m) => TYPE_ZH[m.type]).join('、')}]` : '') +
      `。防御怕[${weakTo.map((m) => TYPE_ZH[m.type] + ' ' + m.multiplier + '×').join('、') || '无'}]` +
      (immuneTo.length ? `；免疫[${immuneTo.map((m) => TYPE_ZH[m.type]).join('、')}]` : '');

    return {
      summary,
      cards: [
        {
          kind: 'matchups',
          data: {
            type: { name: primary, nameZh: TYPE_ZH[primary] },
            strongAgainst: strongAgainst.map(toMatchup),
            weakAgainst: weakAgainst.map(toMatchup),
            immuneTo: immuneTo.map(toMatchup),
            resists: resists.map(toMatchup),
            weakTo: weakTo.map(toMatchup),
          },
        },
      ],
    };
  },
};
