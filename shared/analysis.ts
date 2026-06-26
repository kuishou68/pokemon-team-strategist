// ============================================================
// 队伍克制覆盖分析 + recommend_switch 评分（纯函数，全代码计算，防模型幻觉）
// ============================================================

import {
  ALL_TYPES,
  type TypeName,
  type PokemonSnapshot,
  type TeamAnalysis,
  type SwitchScore,
  type SwitchRecommendation,
} from './types.js';
import { effectiveness, singleEffectiveness } from './typechart.js';

/** 属性中文（分析结果文案用，避免再打 API） */
export const TYPE_ZH: Record<TypeName, string> = {
  normal: '一般', fire: '火', water: '水', electric: '电', grass: '草',
  ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
  psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙',
  dark: '恶', steel: '钢', fairy: '妖精',
};

function teamTypes(p: PokemonSnapshot): TypeName[] {
  return p.types.map((t) => t.name);
}

/**
 * 队伍克制覆盖分析：
 * - 防御视角：每个攻击属性打队伍，统计被克 / 抵抗 / 免疫 只数
 * - 进攻视角：队伍能否 2× 打出某属性（取每只主属性 STAB 视角）
 * - 短板：无人抵抗(全部 >=1×) 且 无人能克制(无人 2×) 的属性
 */
export function analyzeTeam(team: PokemonSnapshot[]): TeamAnalysis {
  const defensive = ALL_TYPES.map((atkType) => {
    let weakCount = 0;
    let resistCount = 0;
    let immuneCount = 0;
    for (const member of team) {
      const mult = effectiveness(atkType, teamTypes(member));
      if (mult === 0) immuneCount += 1;
      else if (mult > 1) weakCount += 1;
      else if (mult < 1) resistCount += 1;
    }
    return {
      type: atkType,
      typeZh: TYPE_ZH[atkType],
      weakCount,
      resistCount,
      immuneCount,
    };
  });

  // 进攻：队伍每只用它各属性去打目标属性，取最大倍率，>=2× 算覆盖
  const offensive = ALL_TYPES.map((targetType) => {
    let coveredBy = 0;
    for (const member of team) {
      const best = Math.max(
        ...teamTypes(member).map((atk) => singleEffectiveness(atk, targetType)),
        0,
      );
      if (best >= 2) coveredBy += 1;
    }
    return { type: targetType, typeZh: TYPE_ZH[targetType], coveredBy };
  });

  // 短板：进攻无人能 2× 打它，且防御无人抵抗/免疫（全员吃满或被克）
  const weaknesses: TeamAnalysis['weaknesses'] = [];
  for (const t of ALL_TYPES) {
    const off = offensive.find((o) => o.type === t)!;
    const def = defensive.find((d) => d.type === t)!;
    const noResist = def.resistCount === 0 && def.immuneCount === 0;
    const noCover = off.coveredBy === 0;
    if (team.length > 0 && noResist && noCover) {
      weaknesses.push({
        type: t,
        typeZh: TYPE_ZH[t],
        reason: `队伍无人抵抗${TYPE_ZH[t]}系攻击，且无人能克制${TYPE_ZH[t]}系`,
      });
    } else if (team.length > 0 && def.weakCount >= Math.ceil(team.length / 2) && noResist) {
      weaknesses.push({
        type: t,
        typeZh: TYPE_ZH[t],
        reason: `队伍中 ${def.weakCount} 只被${TYPE_ZH[t]}系克制且无人抵抗`,
      });
    }
  }

  return {
    teamSize: team.length,
    defensive,
    offensive,
    weaknesses,
  };
}

// ---------- recommend_switch 评分 ----------

/** 评分权重（代码常量，集中便于调优）：属性 60% / 速度 20% / 种族值 20% */
export const SWITCH_WEIGHTS = {
  matchup: 0.6, // 属性克制（防御 + 进攻 综合）
  speed: 0.2,
  bulk: 0.2, // 种族值（耐久 + 输出）
} as const;

function maxOutgoing(attackerTypes: TypeName[], defenderTypes: TypeName[]): number {
  return Math.max(
    ...attackerTypes.map((atk) => effectiveness(atk, defenderTypes)),
    0,
  );
}

/**
 * 对队伍每只算 防御/进攻/速度 三项 → 加权综合 → 排序。
 * 诚实标注：仅属性 + 种族值 + 速度，无 EV/IV/性格/道具/特性。
 */
export function recommendSwitch(
  team: PokemonSnapshot[],
  opponent: PokemonSnapshot,
): SwitchRecommendation {
  const oppTypes = teamTypes(opponent);

  const ranked: SwitchScore[] = team.map((member) => {
    const myTypes = teamTypes(member);

    // 防御：对手主属性打我的倍率（取对手各属性打我的最大威胁），越低越好
    const incoming = maxOutgoing(oppTypes, myTypes);
    // 进攻：我打对手的最大倍率
    const outgoing = maxOutgoing(myTypes, oppTypes);

    // 防御分：倍率 0→1, 0.25→0.9, 0.5→0.75, 1→0.5, 2→0.2, 4→0
    const defenseScore = mapDefense(incoming);
    // 进攻分：0→0, 0.25→0.1, 0.5→0.25, 1→0.5, 2→0.85, 4→1
    const offenseScore = mapOffense(outgoing);
    // 速度分：先手 1，否则按速度比例
    const faster = member.stats.speed > opponent.stats.speed;
    const speedScore = faster
      ? 1
      : opponent.stats.speed > 0
        ? Math.min(member.stats.speed / opponent.stats.speed, 0.99) * 0.5
        : 0.5;
    // 种族值分：归一到 600 上限
    const bulkScore = Math.min(member.total / 600, 1);

    const matchupScore = defenseScore * 0.55 + offenseScore * 0.45;

    const score =
      matchupScore * SWITCH_WEIGHTS.matchup +
      speedScore * SWITCH_WEIGHTS.speed +
      bulkScore * SWITCH_WEIGHTS.bulk;

    return {
      pokemon: member,
      score: Math.round(score * 1000) / 1000,
      defenseScore: Math.round(defenseScore * 1000) / 1000,
      offenseScore: Math.round(offenseScore * 1000) / 1000,
      speedScore: Math.round(speedScore * 1000) / 1000,
      incomingMultiplier: incoming,
      outgoingMultiplier: outgoing,
      fasterThanOpponent: faster,
      reason: buildReason(opponent, incoming, outgoing, faster),
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  return {
    opponent,
    ranked,
    note: '基于属性和种族值的快速参考（不含 EV/IV/性格/道具/特性，非精确对战模拟）',
  };
}

function mapDefense(mult: number): number {
  if (mult === 0) return 1;
  if (mult <= 0.25) return 0.9;
  if (mult <= 0.5) return 0.75;
  if (mult <= 1) return 0.5;
  if (mult <= 2) return 0.2;
  return 0; // 4×
}
function mapOffense(mult: number): number {
  if (mult === 0) return 0;
  if (mult <= 0.25) return 0.1;
  if (mult <= 0.5) return 0.25;
  if (mult <= 1) return 0.5;
  if (mult <= 2) return 0.85;
  return 1; // 4×
}

function buildReason(
  opponent: PokemonSnapshot,
  incoming: number,
  outgoing: number,
  faster: boolean,
): string {
  const parts: string[] = [];
  if (incoming === 0) parts.push(`免疫${opponent.nameZh}的主要攻击`);
  else if (incoming <= 0.5) parts.push(`能抵抗${opponent.nameZh}的攻击(${incoming}×)`);
  else if (incoming >= 2) parts.push(`会被${opponent.nameZh}克制(${incoming}×)，谨慎`);

  if (outgoing >= 2) parts.push(`可以克制对手(${outgoing}×)`);
  else if (outgoing === 0) parts.push('打不动对手(0×)');
  else if (outgoing < 1) parts.push(`攻击效果不佳(${outgoing}×)`);

  parts.push(faster ? '速度占先手' : '速度落后');
  return parts.join('，') + '。';
}
