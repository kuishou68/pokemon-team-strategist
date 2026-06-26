// ============================================================
// OpenRouter 客户端（openai SDK）+ assistant 消息归一（小模型兼容）
// ============================================================

import OpenAI from 'openai';
import { logger } from './logger.js';

const apiKey = process.env.OPENROUTER_API_KEY;
const baseURL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
export const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

if (!apiKey) {
  // 启动即清晰报错
  logger.error('缺少 OPENROUTER_API_KEY 环境变量。请复制 .env.example 为 .env 并填入 key。');
  throw new Error('OPENROUTER_API_KEY is required. See .env.example.');
}

export const openai = new OpenAI({
  apiKey,
  baseURL,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost',
    'X-Title': 'Pokemon Team Strategist',
  },
});

/**
 * 归一 assistant 的 tool_calls：小模型可能把 arguments 写成已解析对象或非法 JSON。
 * 返回 { id, name, args } 数组。
 */
export function normalizeToolCalls(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined,
): { id: string; name: string; args: Record<string, unknown> }[] {
  if (!toolCalls) return [];
  return toolCalls.map((tc) => {
    let args: Record<string, unknown> = {};
    const raw = tc.function.arguments;
    if (raw && typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
      } catch {
        logger.warn('failed to parse tool args', { tool: tc.function.name, raw });
      }
    } else if (raw && typeof raw === 'object') {
      args = raw as Record<string, unknown>;
    }
    return { id: tc.id, name: tc.function.name, args };
  });
}

export type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;
