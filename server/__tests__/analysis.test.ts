import { describe, it, expect } from 'vitest';
import { analyzeTeam, recommendSwitch, SWITCH_WEIGHTS } from '../src/lib/analysis.js';
import {
  PIKACHU, CHARIZARD, BLASTOISE, VENUSAUR, GOLEM, GENGAR, mkPokemon,
} from './fixtures.js';

describe('analyzeTeam', () => {
  it('空队伍返回 0 短板', () => {
    const a = analyzeTeam([]);
    expect(a.teamSize).toBe(0);
    expect(a.weaknesses.length).toBe(0);
  });

  it('防御视角统计被克/抵抗/免疫只数', () => {
    const a = analyzeTeam([PIKACHU, GOLEM]); // 电 + 岩/地
    const ground = a.defensive.find((d) => d.type === 'ground')!;
    // 地面打皮卡丘(电)=2× 克，打隆隆岩(岩/地)=2× 克 → weak 2
    expect(ground.weakCount).toBe(2);
    const electric = a.defensive.find((d) => d.type === 'electric')!;
    // 电打皮卡丘=0.5 抵抗，打隆隆岩(含地面)=0 免疫
    expect(electric.immuneCount).toBe(1);
    expect(electric.resistCount).toBe(1);
  });

  it('进攻视角统计能 2× 覆盖的只数', () => {
    const a = analyzeTeam([CHARIZARD, BLASTOISE]); // 火/飞 + 水
    const grass = a.offensive.find((o) => o.type === 'grass')!;
    // 火克草(2×)，水打草0.5 → coveredBy 1
    expect(grass.coveredBy).toBe(1);
  });

  it('识别短板属性', () => {
    // 全是火系队伍 → 怕水/地/岩，且对火/草/冰等覆盖，水系应为短板
    const team = [
      mkPokemon(4, 'charmander', '小火龙', ['fire']),
      mkPokemon(37, 'vulpix', '六尾', ['fire']),
    ];
    const a = analyzeTeam(team);
    const types = a.weaknesses.map((w) => w.type);
    expect(types).toContain('water');
  });
});

describe('recommendSwitch', () => {
  it('权重之和为 1', () => {
    expect(SWITCH_WEIGHTS.matchup + SWITCH_WEIGHTS.speed + SWITCH_WEIGHTS.bulk).toBeCloseTo(1);
  });

  it('空队伍给出友好提示（ranked 为空）', () => {
    const rec = recommendSwitch([], CHARIZARD);
    expect(rec.ranked.length).toBe(0);
  });

  it('对手喷火龙(火/飞) → 水箭龟(水)应排在皮卡丘前面（水克火且抗火）', () => {
    const rec = recommendSwitch([PIKACHU, BLASTOISE, VENUSAUR], CHARIZARD);
    const names = rec.ranked.map((r) => r.pokemon.name);
    expect(names.indexOf('blastoise')).toBeLessThan(names.indexOf('venusaur'));
    // 水箭龟能 2× 打火/飞，且抗火
    const blastoise = rec.ranked.find((r) => r.pokemon.name === 'blastoise')!;
    expect(blastoise.outgoingMultiplier).toBeGreaterThanOrEqual(2);
  });

  it('速度劣势扣分：慢的同等条件得分更低', () => {
    const fast = mkPokemon(101, 'fastmon', '快兽', ['water'], { speed: 200 });
    const slow = mkPokemon(102, 'slowmon', '慢兽', ['water'], { speed: 10 });
    const rec = recommendSwitch([fast, slow], CHARIZARD);
    const fastScore = rec.ranked.find((r) => r.pokemon.name === 'fastmon')!;
    const slowScore = rec.ranked.find((r) => r.pokemon.name === 'slowmon')!;
    expect(fastScore.speedScore).toBeGreaterThan(slowScore.speedScore);
    expect(fastScore.score).toBeGreaterThan(slowScore.score);
  });

  it('免疫场景：地面系对手 vs 飞行系队员 incoming=0', () => {
    const opponent = mkPokemon(50, 'diglett', '地鼠', ['ground'], { speed: 95 });
    const flyer = mkPokemon(16, 'pidgey', '波波', ['normal', 'flying']);
    const rec = recommendSwitch([flyer, PIKACHU], opponent);
    const pidgey = rec.ranked.find((r) => r.pokemon.name === 'pidgey')!;
    expect(pidgey.incomingMultiplier).toBe(0);
    // 免疫地面 → 防御满分 → 排在被地面克的皮卡丘前
    const names = rec.ranked.map((r) => r.pokemon.name);
    expect(names.indexOf('pidgey')).toBeLessThan(names.indexOf('pikachu'));
  });

  it('note 包含诚实标注', () => {
    const rec = recommendSwitch([PIKACHU], CHARIZARD);
    expect(rec.note).toContain('快速参考');
  });
});
