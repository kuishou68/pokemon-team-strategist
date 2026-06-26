import type { PokemonSnapshot, TypeName, Stats } from '../../shared/types.js';

const TYPE_ZH: Record<string, string> = {
  fire: '火', water: '水', electric: '电', grass: '草', flying: '飞行',
  ground: '地面', rock: '岩石', normal: '一般', ghost: '幽灵', dragon: '龙',
  ice: '冰', steel: '钢', fairy: '妖精', psychic: '超能力', fighting: '格斗',
  poison: '毒', bug: '虫', dark: '恶',
};

export function mkPokemon(
  id: number,
  name: string,
  nameZh: string,
  types: TypeName[],
  stats: Partial<Stats> = {},
): PokemonSnapshot {
  const s: Stats = {
    hp: 80, attack: 80, defense: 80, spAtk: 80, spDef: 80, speed: 80,
    ...stats,
  };
  const total = s.hp + s.attack + s.defense + s.spAtk + s.spDef + s.speed;
  return {
    id,
    name,
    nameZh,
    types: types.map((t) => ({ name: t, nameZh: TYPE_ZH[t] ?? t })),
    stats: s,
    total,
    spriteUrl: `/api/sprite/${id}`,
    pixelSpriteUrl: `/api/sprite/${id}?pixel=1`,
  };
}

export const PIKACHU = mkPokemon(25, 'pikachu', '皮卡丘', ['electric'], { speed: 90 });
export const CHARIZARD = mkPokemon(6, 'charizard', '喷火龙', ['fire', 'flying'], { speed: 100, spAtk: 109 });
export const BLASTOISE = mkPokemon(9, 'blastoise', '水箭龟', ['water'], { speed: 78, defense: 100 });
export const VENUSAUR = mkPokemon(3, 'venusaur', '妙蛙花', ['grass', 'poison'], { speed: 80 });
export const GOLEM = mkPokemon(76, 'golem', '隆隆岩', ['rock', 'ground'], { speed: 45, defense: 130 });
export const GENGAR = mkPokemon(94, 'gengar', '耿鬼', ['ghost', 'poison'], { speed: 110, spAtk: 130 });
