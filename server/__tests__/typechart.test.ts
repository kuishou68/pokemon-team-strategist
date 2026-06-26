import { describe, it, expect } from 'vitest';
import {
  EFFECT,
  singleEffectiveness,
  effectiveness,
  outgoingMatchups,
  incomingMatchups,
} from '../src/lib/typechart.js';
import { ALL_TYPES, type TypeName } from '../../shared/types.js';

describe('typechart 维度与完整性', () => {
  it('覆盖 18 种属性', () => {
    expect(ALL_TYPES.length).toBe(18);
    for (const t of ALL_TYPES) {
      expect(EFFECT[t]).toBeDefined();
    }
  });

  it('outgoingMatchups 返回 18 项', () => {
    for (const t of ALL_TYPES) {
      expect(outgoingMatchups(t).length).toBe(18);
    }
  });

  it('每个倍率合法（0/0.5/1/2）', () => {
    for (const atk of ALL_TYPES) {
      for (const def of ALL_TYPES) {
        const m = singleEffectiveness(atk, def);
        expect([0, 0.5, 1, 2]).toContain(m);
      }
    }
  });
});

describe('标志性 matchup（核对正确性）', () => {
  const cases: [TypeName, TypeName, number][] = [
    ['fire', 'grass', 2],
    ['water', 'fire', 2],
    ['grass', 'water', 2],
    ['electric', 'water', 2],
    ['fire', 'water', 0.5],
    ['water', 'grass', 0.5],
    ['fighting', 'normal', 2],
    ['psychic', 'fighting', 2],
    ['fairy', 'dragon', 2],
    ['dragon', 'fairy', 0], // 龙打妖精 0× 免疫
    ['steel', 'fairy', 2],
  ];
  for (const [atk, def, exp] of cases) {
    it(`${atk} → ${def} = ${exp}×`, () => {
      expect(singleEffectiveness(atk, def)).toBe(exp);
    });
  }
});

describe('0× 免疫边界', () => {
  it('普通 → 幽灵 = 0', () => {
    expect(singleEffectiveness('normal', 'ghost')).toBe(0);
  });
  it('幽灵 → 普通 = 0', () => {
    expect(singleEffectiveness('ghost', 'normal')).toBe(0);
  });
  it('地面 → 飞行 = 0', () => {
    expect(singleEffectiveness('ground', 'flying')).toBe(0);
  });
  it('电 → 地面 = 0', () => {
    expect(singleEffectiveness('electric', 'ground')).toBe(0);
  });
  it('格斗 → 幽灵 = 0', () => {
    expect(singleEffectiveness('fighting', 'ghost')).toBe(0);
  });
  it('毒 → 钢 = 0', () => {
    expect(singleEffectiveness('poison', 'steel')).toBe(0);
  });
  it('超能力 → 恶 = 0', () => {
    expect(singleEffectiveness('psychic', 'dark')).toBe(0);
  });
});

describe('双属性叠加（相乘 + 0× 归零）', () => {
  it('火 → 草/虫 = 2 × 2 = 4（双重克制）', () => {
    expect(effectiveness('fire', ['grass', 'bug'])).toBe(4);
  });

  it('火 → 水/岩 = 0.5 × 0.5 = 0.25（双重抵抗）', () => {
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25);
  });

  it('岩石 → 火/飞 = 2 × 2 = 4（双重克制）', () => {
    expect(effectiveness('rock', ['fire', 'flying'])).toBe(4);
  });

  it('地面 → 电/飞（如 雷鸟无此组合，用 地面打 飞行/任意）整体 0×', () => {
    // 地面 vs 飞行 = 0 → 即便另一属性 2× 也归零
    expect(effectiveness('ground', ['flying', 'steel'])).toBe(0);
  });

  it('电 → 水/地 = 2 × 0 = 0（地面属性使其免疫电）', () => {
    expect(effectiveness('electric', ['water', 'ground'])).toBe(0);
  });

  it('草 → 水/地 = 2 × 2 = 4', () => {
    expect(effectiveness('grass', ['water', 'ground'])).toBe(4);
  });
});

describe('incomingMatchups', () => {
  it('返回 18 项，含正确免疫', () => {
    const m = incomingMatchups(['ghost']);
    expect(m.length).toBe(18);
    const normalVsGhost = m.find((x) => x.type === 'normal');
    expect(normalVsGhost?.multiplier).toBe(0);
  });
});
