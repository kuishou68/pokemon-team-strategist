// ============================================================
// PokeAPI 封装 + 规范化（官方 zh-hans 提取）+ 缓存 + 降级
// ============================================================

import { upstreamCache } from '../lib/cache.js';
import { logger } from '../logger.js';
import {
  pickZhName,
  pickFlavorZh as pickFlavorZhPure,
  extractStats as extractStatsPure,
  statsTotal,
} from '../lib/normalize.js';
import {
  type Pokemon,
  type PokemonSnapshot,
  type TypeInfo,
  type TypeName,
  type MoveDetail,
  type EvolutionChain,
  type EvolutionNode,
  ALL_TYPES,
} from '../../../shared/types.js';

const BASE = 'https://pokeapi.co/api/v2';
const TIMEOUT_MS = 8000;

const TYPE_SET = new Set<string>(ALL_TYPES);

/** 取 zh-hans 字段，缺失 fallback 英文/给定默认（委托纯函数） */
function pickZh(
  names: { name: string; language: { name: string } }[] | undefined,
  fallback: string,
): string {
  return pickZhName(names, fallback);
}

/** 带超时 + 1 次重试的上游 GET（JSON），命中全局缓存；上游挂时降级返回 stale */
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const cached = upstreamCache.get(url);
  if (cached !== undefined) return cached as T;

  const attempt = async (): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const err = new Error(`upstream ${res.status} for ${url}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  try {
    const data = await attempt();
    upstreamCache.set(url, data);
    return data;
  } catch (e1) {
    // 用户主动取消，直接抛
    if (signal?.aborted) throw e1;
    logger.warn('upstream retry', { url, err: String(e1) });
    try {
      const data = await attempt();
      upstreamCache.set(url, data);
      return data;
    } catch (e2) {
      // 降级：返回 stale（即便过期）
      const stale = upstreamCache.getStale(url);
      if (stale !== undefined) {
        logger.warn('upstream failed, serving stale', { url });
        return stale as T;
      }
      throw e2;
    }
  }
}

// ---------- 类型：PokeAPI 原始结构（仅取用字段） ----------
interface RawNamed { name: string; url: string }
interface RawNames { name: string; language: { name: string } }
interface RawPokemon {
  id: number;
  name: string;
  types: { slot: number; type: RawNamed }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: {
    front_default: string | null;
    other: { 'official-artwork': { front_default: string | null } };
  };
  height: number;
  weight: number;
  abilities: { ability: RawNamed; is_hidden: boolean }[];
  species: RawNamed;
}
interface RawSpecies {
  id: number;
  names: RawNames[];
  flavor_text_entries: { flavor_text: string; language: { name: string } }[];
  evolution_chain: { url: string };
}
interface RawType { id: number; name: string; names: RawNames[] }
interface RawAbility { names: RawNames[] }
interface RawMove {
  id: number;
  name: string;
  names: RawNames[];
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  type: RawNamed;
  damage_class: { name: string };
  flavor_text_entries: { flavor_text: string; language: { name: string } }[];
}
interface RawChainNode {
  species: RawNamed;
  evolves_to: RawChainNode[];
  evolution_details: RawEvoDetail[];
}
interface RawEvoDetail {
  trigger: { name: string };
  min_level: number | null;
  item: RawNamed | null;
  held_item: RawNamed | null;
  time_of_day: string;
  min_happiness: number | null;
  known_move: RawNamed | null;
  location: RawNamed | null;
  gender: number | null;
}

// ---------- 缓存的属性中文（避免每次规范化都打 /type） ----------
const typeZhCache = new Map<TypeName, string>();
async function getTypeZh(name: TypeName, signal?: AbortSignal): Promise<string> {
  if (typeZhCache.has(name)) return typeZhCache.get(name)!;
  try {
    const raw = await fetchJson<RawType>(`${BASE}/type/${name}`, signal);
    const zh = pickZh(raw.names, name);
    typeZhCache.set(name, zh);
    return zh;
  } catch {
    return name;
  }
}

async function toTypeInfos(
  types: { slot: number; type: RawNamed }[],
  signal?: AbortSignal,
): Promise<TypeInfo[]> {
  const sorted = [...types].sort((a, b) => a.slot - b.slot);
  return Promise.all(
    sorted
      .filter((t) => TYPE_SET.has(t.type.name))
      .map(async (t) => {
        const name = t.type.name as TypeName;
        return { name, nameZh: await getTypeZh(name, signal) };
      }),
  );
}

function spriteProxy(id: number): string {
  return `/api/sprite/${id}`;
}
function pixelSpriteProxy(id: number): string {
  return `/api/sprite/${id}?pixel=1`;
}

/**
 * 规范化一只宝可梦：/pokemon + /pokemon-species 并发取（species 取官方中文名/图鉴）。
 */
export async function getPokemon(
  idOrName: string | number,
  signal?: AbortSignal,
): Promise<Pokemon> {
  const key = String(idOrName).toLowerCase();
  const pokemon = await fetchJson<RawPokemon>(`${BASE}/pokemon/${key}`, signal);

  // species + types 并发
  const [species, types] = await Promise.all([
    fetchJson<RawSpecies>(pokemon.species.url, signal).catch(() => null),
    toTypeInfos(pokemon.types, signal),
  ]);

  const nameZh = species ? pickZh(species.names, pokemon.name) : pokemon.name;
  const flavorTextZh = species
    ? pickFlavorZh(species.flavor_text_entries)
    : undefined;

  // 特性中文（并发）
  const abilities = await Promise.all(
    pokemon.abilities.map(async (a) => {
      let nameZhA = a.ability.name;
      try {
        const raw = await fetchJson<RawAbility>(a.ability.url, signal);
        nameZhA = pickZh(raw.names, a.ability.name);
      } catch {
        /* fallback 英文 */
      }
      return { name: a.ability.name, nameZh: nameZhA, isHidden: a.is_hidden };
    }),
  );

  const stats = extractStatsPure(pokemon.stats);
  const total = statsTotal(stats);

  return {
    id: pokemon.id,
    name: pokemon.name,
    nameZh,
    types,
    stats,
    total,
    spriteUrl: spriteProxy(pokemon.id),
    pixelSpriteUrl: pixelSpriteProxy(pokemon.id),
    flavorTextZh,
    height: pokemon.height,
    weight: pokemon.weight,
    abilities,
  };
}

function pickFlavorZh(
  entries: { flavor_text: string; language: { name: string } }[],
): string | undefined {
  return pickFlavorZhPure(entries);
}

/** 派生队伍快照（精简，注入块/team 事件用） */
export function toSnapshot(p: Pokemon): PokemonSnapshot {
  return {
    id: p.id,
    name: p.name,
    nameZh: p.nameZh,
    types: p.types,
    stats: p.stats,
    total: p.total,
    spriteUrl: p.spriteUrl,
    pixelSpriteUrl: p.pixelSpriteUrl,
  };
}

/** 招式详情规范化 */
export async function getMove(
  idOrName: string | number,
  signal?: AbortSignal,
): Promise<MoveDetail> {
  const key = String(idOrName).toLowerCase().replace(/\s+/g, '-');
  const raw = await fetchJson<RawMove>(`${BASE}/move/${key}`, signal);
  const typeName = raw.type.name as TypeName;
  const typeZh = await getTypeZh(typeName, signal);
  const dc = raw.damage_class.name as MoveDetail['damageClass'];
  const dcZh =
    dc === 'physical' ? '物理' : dc === 'special' ? '特殊' : '变化';
  const descZh = pickFlavorZh(raw.flavor_text_entries);
  return {
    id: raw.id,
    name: raw.name,
    nameZh: pickZh(raw.names, raw.name),
    type: { name: typeName, nameZh: typeZh },
    power: raw.power,
    accuracy: raw.accuracy,
    pp: raw.pp,
    damageClass: dc,
    damageClassZh: dcZh,
    descriptionZh: descZh,
  };
}

// ---------- 进化链（树结构 + 分支） ----------

const EVO_ITEM_ZH: Record<string, string> = {
  'water-stone': '水之石', 'fire-stone': '火之石', 'thunder-stone': '雷之石',
  'leaf-stone': '叶之石', 'moon-stone': '月之石', 'sun-stone': '日之石',
  'shiny-stone': '光之石', 'dusk-stone': '暗之石', 'dawn-stone': '觉醒之石',
  'ice-stone': '冰之石', 'kings-rock': '王者之证', 'metal-coat': '金属膜',
  'dragon-scale': '龙之鳞片', 'up-grade': '升级数据', 'oval-stone': '浑圆之石',
};

function describeEvolution(detail?: RawEvoDetail): string | undefined {
  if (!detail) return undefined;
  const parts: string[] = [];
  const trigger = detail.trigger?.name;
  if (detail.min_level) parts.push(`等级 ${detail.min_level}`);
  if (detail.item) parts.push(`使用 ${EVO_ITEM_ZH[detail.item.name] ?? detail.item.name}`);
  if (detail.held_item) parts.push(`携带 ${EVO_ITEM_ZH[detail.held_item.name] ?? detail.held_item.name}`);
  if (detail.min_happiness) parts.push(`亲密度 ${detail.min_happiness}`);
  if (detail.time_of_day) parts.push(detail.time_of_day === 'day' ? '白天' : detail.time_of_day === 'night' ? '夜晚' : detail.time_of_day);
  if (detail.known_move) parts.push(`学会 ${detail.known_move.name}`);
  if (detail.location) parts.push(`地点 ${detail.location.name}`);
  if (detail.gender === 1) parts.push('雌性');
  if (detail.gender === 2) parts.push('雄性');
  if (parts.length === 0) {
    if (trigger === 'trade') return '通信交换';
    if (trigger === 'level-up') return '升级';
    return trigger ?? undefined;
  }
  if (trigger === 'trade') parts.unshift('通信交换');
  return parts.join(' · ');
}

function speciesIdFromUrl(url: string): number {
  const m = url.match(/\/pokemon-species\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}

async function buildEvoNode(
  raw: RawChainNode,
  detail: RawEvoDetail | undefined,
  signal?: AbortSignal,
): Promise<EvolutionNode> {
  const id = speciesIdFromUrl(raw.species.url);
  // 取中文名（species 名单）
  let nameZh = raw.species.name;
  try {
    const sp = await fetchJson<RawSpecies>(raw.species.url, signal);
    nameZh = pickZh(sp.names, raw.species.name);
  } catch {
    /* fallback */
  }
  const children = await Promise.all(
    raw.evolves_to.map((child) =>
      buildEvoNode(child, child.evolution_details[0], signal),
    ),
  );
  return {
    id,
    name: raw.species.name,
    nameZh,
    spriteUrl: spriteProxy(id),
    condition: describeEvolution(detail),
    evolvesTo: children,
  };
}

function hasBranch(node: EvolutionNode): boolean {
  if (node.evolvesTo.length > 1) return true;
  return node.evolvesTo.some(hasBranch);
}

export async function getEvolutionChain(
  pokemonQuery: string,
  signal?: AbortSignal,
): Promise<EvolutionChain> {
  const key = pokemonQuery.toLowerCase().replace(/\s+/g, '-');
  // species 可能直接是该名，也可能是某形态 → 先取 pokemon 拿 species url
  let speciesUrl: string;
  try {
    const sp = await fetchJson<RawSpecies>(`${BASE}/pokemon-species/${key}`, signal);
    speciesUrl = sp.evolution_chain.url;
  } catch {
    const pk = await fetchJson<RawPokemon>(`${BASE}/pokemon/${key}`, signal);
    const sp = await fetchJson<RawSpecies>(pk.species.url, signal);
    speciesUrl = sp.evolution_chain.url;
  }
  const chain = await fetchJson<{ id: number; chain: RawChainNode }>(speciesUrl, signal);
  const root = await buildEvoNode(chain.chain, undefined, signal);
  return {
    rootId: root.id,
    root,
    isBranching: hasBranch(root),
  };
}

/** 给定属性名（英文或已归一）取中文（直连端点/工具用） */
export async function getTypeNameZh(name: TypeName, signal?: AbortSignal): Promise<string> {
  return getTypeZh(name, signal);
}

export { spriteProxy, pixelSpriteProxy };
