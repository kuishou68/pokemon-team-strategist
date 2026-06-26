// ============================================================
// 纯规范化函数（无网络，可单测）：官方 zh-hans 提取 / 种族值 / 双属性
// ============================================================

import type { Stats, TypeName, TypeInfo } from '../../../shared/types.js';
import { ALL_TYPES } from '../../../shared/types.js';

const TYPE_SET = new Set<string>(ALL_TYPES);

export interface RawNameEntry {
  name: string;
  language: { name: string };
}

/** 取 zh-hans，缺失 fallback 英文/默认 */
export function pickZhName(names: RawNameEntry[] | undefined, fallback: string): string {
  if (!names) return fallback;
  const zh = names.find((n) => n.language?.name === 'zh-hans');
  if (zh?.name) return zh.name;
  const en = names.find((n) => n.language?.name === 'en');
  return en?.name ?? fallback;
}

export interface RawFlavorEntry {
  flavor_text: string;
  language: { name: string };
}

/** 取最后一条 zh-hans 图鉴描述（较新版本），fallback 英文 */
export function pickFlavorZh(entries: RawFlavorEntry[] | undefined): string | undefined {
  if (!entries) return undefined;
  const zh = entries.filter((e) => e.language.name === 'zh-hans');
  if (zh.length) return zh[zh.length - 1].flavor_text.replace(/\s+/g, ' ').trim();
  const en = entries.filter((e) => e.language.name === 'en');
  if (en.length) return en[en.length - 1].flavor_text.replace(/\s+/g, ' ').trim();
  return undefined;
}

export interface RawStat {
  base_stat: number;
  stat: { name: string };
}

/** 从 stats[] 提取六维 */
export function extractStats(stats: RawStat[]): Stats {
  const get = (key: string) => stats.find((s) => s.stat.name === key)?.base_stat ?? 0;
  return {
    hp: get('hp'),
    attack: get('attack'),
    defense: get('defense'),
    spAtk: get('special-attack'),
    spDef: get('special-defense'),
    speed: get('speed'),
  };
}

export function statsTotal(s: Stats): number {
  return s.hp + s.attack + s.defense + s.spAtk + s.spDef + s.speed;
}

export interface RawTypeSlot {
  slot: number;
  type: { name: string };
}

/**
 * 排序双属性（按 slot），过滤非法属性，返回英文 name 列表（中文名由 typeZhMap 注入）。
 */
export function extractTypeNames(types: RawTypeSlot[]): TypeName[] {
  return [...types]
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)
    .filter((n): n is TypeName => TYPE_SET.has(n));
}

export function buildTypeInfos(
  typeNames: TypeName[],
  zhMap: Record<string, string>,
): TypeInfo[] {
  return typeNames.map((name) => ({ name, nameZh: zhMap[name] ?? name }));
}
