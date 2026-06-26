// ============================================================
// 统一 Tool 接口 + 注册表
// ============================================================

import type { Card } from '../../../shared/types.js';
import type { Session } from '../session.js';

/** 工具执行上下文：server team state（单一数据源）、session、abort */
export interface ToolContext {
  session: Session;
  signal?: AbortSignal;
  /** 标记本轮是否发生队伍变更（用于决定是否 emit team 事件） */
  markTeamChanged: () => void;
}

/** 校验结果：ok 则 args 已归一；否则 error 回喂模型补参 */
export type ValidateResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string };

/** 工具执行结果 */
export interface ToolResult {
  /** 回喂模型的紧凑摘要（含 id，便于多轮引用） */
  summary: string;
  /** 前端结构化卡片（可选） */
  cards?: Card[];
}

export interface Tool {
  name: string;
  description: string;
  /** OpenAI function-calling JSON schema 的 parameters 部分 */
  parameters: Record<string, unknown>;
  /** 人话标签（工具调用链可视化），可读 args 生成 */
  label: (args: Record<string, unknown>) => string;
  /** 参数校验 + 归一 */
  validate: (args: Record<string, unknown>) => ValidateResult;
  /** 执行（可读写 server state） */
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

import { searchPokemonTool } from './searchPokemon.js';
import { getTypeMatchupsTool } from './getTypeMatchups.js';
import { getMoveDetailTool } from './getMoveDetail.js';
import { getEvolutionChainTool } from './getEvolutionChain.js';
import { analyzeTeamTool } from './analyzeTeam.js';
import { recommendSwitchTool } from './recommendSwitch.js';
import { updateTeamTool } from './updateTeam.js';

export const TOOLS: Tool[] = [
  searchPokemonTool,
  getTypeMatchupsTool,
  getMoveDetailTool,
  getEvolutionChainTool,
  analyzeTeamTool,
  recommendSwitchTool,
  updateTeamTool,
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);

/** 转为 OpenAI tools 数组 */
export function toOpenAITools() {
  return TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
