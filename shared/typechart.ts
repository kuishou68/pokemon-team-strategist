// ============================================================
// 静态属性克制表（第 6 世代后现代克制表：含妖精系、钢/恶/幽灵调整）
// 正确性基石：18×18 矩阵全代码计算，零 API 调用、零失败、天然降级。
// 必须处理 0× 免疫；双属性叠加相乘（0× 整体归零）。
// 数据来源：Bulbapedia 现代克制表，经核对。README 标注世代。
// ============================================================

import { ALL_TYPES, type TypeName } from './types.js';

/**
 * EFFECT[attacking][defending] = 倍率
 * 只列出非 1× 的项（2× 超效 / 0.5× 抵抗 / 0× 免疫）；未列出默认 1×。
 */
type Eff = Record<TypeName, Partial<Record<TypeName, number>>>;

const EFFECT: Eff = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5,
    dragon: 0.5, steel: 2,
  },
  water: {
    fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5,
  },
  electric: {
    water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5,
  },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5,
    bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5,
  },
  ice: {
    fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2,
    dragon: 2, steel: 0.5,
  },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5,
    rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5,
  },
  poison: {
    grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5,
    rock: 2, steel: 2,
  },
  flying: {
    electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5,
  },
  psychic: {
    fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5,
  },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: {
    fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5,
  },
  ghost: {
    normal: 0, psychic: 2, ghost: 2, dark: 0.5,
  },
  dragon: {
    dragon: 2, steel: 0.5, fairy: 0,
  },
  dark: {
    fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5,
  },
  steel: {
    fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2,
  },
  fairy: {
    fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5,
  },
};

/**
 * 单属性攻击 vs 单属性防御的倍率（默认 1×）。
 */
export function singleEffectiveness(attacking: TypeName, defending: TypeName): number {
  const row = EFFECT[attacking];
  if (!row) return 1;
  const v = row[defending];
  return v === undefined ? 1 : v;
}

/**
 * 攻击属性打防御方（防御方可能双属性）的总倍率。
 * 双属性叠加相乘；0× 免疫会让整体归零（关键边界）。
 */
export function effectiveness(attacking: TypeName, defenderTypes: TypeName[]): number {
  if (defenderTypes.length === 0) return 1;
  return defenderTypes.reduce(
    (acc, t) => acc * singleEffectiveness(attacking, t),
    1,
  );
}

/**
 * 返回所有攻击属性打目标（单/双属性）的倍率列表。
 */
export function incomingMatchups(
  defenderTypes: TypeName[],
): { type: TypeName; multiplier: number }[] {
  return ALL_TYPES.map((t) => ({
    type: t,
    multiplier: effectiveness(t, defenderTypes),
  }));
}

/**
 * 给定攻击属性，返回它打 18 种单属性的倍率（用于 get_type_matchups 卡片）。
 */
export function outgoingMatchups(
  attacking: TypeName,
): { type: TypeName; multiplier: number }[] {
  return ALL_TYPES.map((t) => ({
    type: t,
    multiplier: singleEffectiveness(attacking, t),
  }));
}

/** 导出原始矩阵供测试断言维度/对称抽查 */
export { EFFECT };
