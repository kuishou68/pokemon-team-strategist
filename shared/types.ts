// ============================================================
// 共享契约层（前后端共用）：SSE 事件 union + 领域类型
// ============================================================

/** 18 种属性的英文标识（与 PokeAPI /type 对齐） */
export type TypeName =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export const ALL_TYPES: TypeName[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

/** 种族值六维 */
export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

/** 一只属性（含官方中文） */
export interface TypeInfo {
  name: TypeName;       // 英文 id
  nameZh: string;       // 官方中文（缺失 fallback 英文）
}

/** 宝可梦完整规范化结构 */
export interface Pokemon {
  id: number;
  name: string;         // 英文名
  nameZh: string;       // 官方中文名（fallback 英文）
  types: TypeInfo[];    // 1~2 个属性
  stats: Stats;
  total: number;        // 种族值总和
  spriteUrl: string;    // 走后端代理：/api/sprite/:id
  pixelSpriteUrl: string; // 小图标（pixel sprite，也走代理）
  flavorTextZh?: string;  // 图鉴描述（官方中文，fallback 英文）
  height?: number;        // 分米
  weight?: number;        // 百克
  abilities?: { name: string; nameZh: string; isHidden: boolean }[];
}

/** 队伍中的精简快照（注入块 / team 事件 / GET /api/team 都从 session.team 派生） */
export interface PokemonSnapshot {
  id: number;
  name: string;
  nameZh: string;
  types: TypeInfo[];
  stats: Stats;
  total: number;
  spriteUrl: string;
  pixelSpriteUrl: string;
}

/** 招式详情 */
export interface MoveDetail {
  id: number;
  name: string;
  nameZh: string;
  type: TypeInfo;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  damageClass: 'physical' | 'special' | 'status'; // 物理/特殊/变化
  damageClassZh: string;
  descriptionZh?: string;
}

/** 进化链节点（树结构，支持分支） */
export interface EvolutionNode {
  id: number;
  name: string;
  nameZh: string;
  spriteUrl: string;
  condition?: string;   // 进化条件中文描述（如 "等级 16"、"使用 火之石"）
  evolvesTo: EvolutionNode[];
}

export interface EvolutionChain {
  rootId: number;
  root: EvolutionNode;
  isBranching: boolean; // 是否含分支（任一节点 evolvesTo.length > 1）
}

/** 单只对某属性的克制倍率分析 */
export interface TypeMatchup {
  attackingType: TypeName;
  attackingTypeZh: string;
  multiplier: number;   // 0 / 0.25 / 0.5 / 1 / 2 / 4
}

/** 队伍克制覆盖分析结果 */
export interface TeamAnalysis {
  teamSize: number;
  /** 防御视角：每个攻击属性打这支队伍时，被克得最惨/抵抗情况 */
  defensive: {
    type: TypeName;
    typeZh: string;
    weakCount: number;      // 队伍里被这个属性克（>1×）的只数
    resistCount: number;    // 抵抗（<1×）的只数
    immuneCount: number;    // 免疫（0×）的只数
  }[];
  /** 进攻视角：队伍能否打出克制（>=2×）某属性 */
  offensive: {
    type: TypeName;
    typeZh: string;
    coveredBy: number;      // 队伍里有几只能 2× 打这个属性
  }[];
  /** 短板：队伍既无人抵抗、又无人能克制的属性 */
  weaknesses: { type: TypeName; typeZh: string; reason: string }[];
}

/** recommend_switch 单只评分 */
export interface SwitchScore {
  pokemon: PokemonSnapshot;
  score: number;          // 综合加权分
  defenseScore: number;   // 防御（对手打我的倍率，越低越好 → 分越高）
  offenseScore: number;   // 进攻（我打对手倍率）
  speedScore: number;     // 速度（是否先手）
  incomingMultiplier: number; // 对手属性打这只的倍率
  outgoingMultiplier: number; // 这只主属性打对手的倍率
  fasterThanOpponent: boolean;
  reason: string;         // 中文理由
}

export interface SwitchRecommendation {
  opponent: PokemonSnapshot;
  ranked: SwitchScore[];
  note: string;           // 诚实标注："基于属性和种族值的快速参考"
}

// ============================================================
// SSE 事件协议（决策非流式 / 终答流式）
// ============================================================

/** 工具调用链可视化用的人话标签 */
export interface ToolStepInfo {
  id: string;
  parentId?: string;
  tool: string;
  label: string;          // 人话标签（如 "查询 皮卡丘"）
  status: 'running' | 'done' | 'error';
}

export type SSEEvent =
  | { type: 'thinking'; text: string }
  | { type: 'step_start'; step: ToolStepInfo }
  | { type: 'tool_input'; id: string; tool: string; args: unknown }
  | { type: 'tool_output'; id: string; tool: string; summary: string; status: 'done' | 'error' }
  | { type: 'cards'; cards: Card[] }
  | { type: 'token'; text: string }
  | { type: 'team'; pokemon: PokemonSnapshot[] }
  | { type: 'notice'; level: 'info' | 'warn' | 'error'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** 卡片 union：前端结构化渲染（杜绝裸 JSON） */
export type Card =
  | { kind: 'pokemon'; data: Pokemon }
  | { kind: 'move'; data: MoveDetail }
  | { kind: 'matchups'; data: { type: TypeInfo; strongAgainst: TypeMatchup[]; weakAgainst: TypeMatchup[]; immuneTo: TypeMatchup[]; resists: TypeMatchup[]; weakTo: TypeMatchup[] } }
  | { kind: 'evolution'; data: EvolutionChain }
  | { kind: 'analysis'; data: TeamAnalysis }
  | { kind: 'switch'; data: SwitchRecommendation };

/** 前端聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cards?: Card[];
  steps?: ToolStepInfo[];
  id: string;
}
