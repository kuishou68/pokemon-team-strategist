import { describe, it, expect } from 'vitest';
import {
  pickZhName,
  pickFlavorZh,
  extractStats,
  statsTotal,
  extractTypeNames,
  buildTypeInfos,
} from '../src/lib/normalize.js';

describe('pickZhName 官方中文提取', () => {
  it('提取 zh-hans', () => {
    const names = [
      { name: 'Pikachu', language: { name: 'en' } },
      { name: '皮卡丘', language: { name: 'zh-hans' } },
      { name: 'ピカチュウ', language: { name: 'ja' } },
    ];
    expect(pickZhName(names, 'fallback')).toBe('皮卡丘');
  });

  it('缺 zh-hans 时 fallback 英文', () => {
    const names = [{ name: 'Missingno', language: { name: 'en' } }];
    expect(pickZhName(names, 'x')).toBe('Missingno');
  });

  it('全缺时用 fallback', () => {
    expect(pickZhName([], 'fallback')).toBe('fallback');
    expect(pickZhName(undefined, 'fallback')).toBe('fallback');
  });
});

describe('pickFlavorZh 图鉴描述', () => {
  it('取最后一条 zh-hans 并清理空白', () => {
    const entries = [
      { flavor_text: '旧\n描述', language: { name: 'zh-hans' } },
      { flavor_text: '新\f描述  文本', language: { name: 'zh-hans' } },
      { flavor_text: 'english', language: { name: 'en' } },
    ];
    expect(pickFlavorZh(entries)).toBe('新 描述 文本');
  });
  it('缺 zh-hans fallback 英文', () => {
    const entries = [{ flavor_text: 'an  english\ntext', language: { name: 'en' } }];
    expect(pickFlavorZh(entries)).toBe('an english text');
  });
});

describe('extractStats 种族值', () => {
  it('映射六维', () => {
    const raw = [
      { base_stat: 35, stat: { name: 'hp' } },
      { base_stat: 55, stat: { name: 'attack' } },
      { base_stat: 40, stat: { name: 'defense' } },
      { base_stat: 50, stat: { name: 'special-attack' } },
      { base_stat: 50, stat: { name: 'special-defense' } },
      { base_stat: 90, stat: { name: 'speed' } },
    ];
    const s = extractStats(raw);
    expect(s).toEqual({ hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90 });
    expect(statsTotal(s)).toBe(320);
  });
});

describe('双属性提取', () => {
  it('按 slot 排序并过滤非法', () => {
    const raw = [
      { slot: 2, type: { name: 'flying' } },
      { slot: 1, type: { name: 'fire' } },
      { slot: 3, type: { name: 'bogus' } },
    ];
    expect(extractTypeNames(raw)).toEqual(['fire', 'flying']);
  });

  it('buildTypeInfos 注入中文', () => {
    const infos = buildTypeInfos(['fire', 'flying'], { fire: '火', flying: '飞行' });
    expect(infos).toEqual([
      { name: 'fire', nameZh: '火' },
      { name: 'flying', nameZh: '飞行' },
    ]);
  });
});
