// ============================================================
// Express 入口 + 直连数据端点
// ============================================================

import 'dotenv/config';
import express from 'express';
import { parse, serialize } from 'cookie';
import { logger } from './logger.js';
import { chatHandler } from './routes/chat.js';
import { spriteHandler } from './routes/sprite.js';
import { getPokemon, getEvolutionChain, toSnapshot } from './services/pokeapi.js';
import { getSession, getOrCreateSession } from './session.js';

// 启动即校验 key（缺失 llm.ts import 时即抛错）
if (!process.env.OPENROUTER_API_KEY) {
  logger.error('缺少 OPENROUTER_API_KEY。请复制 .env.example 为 .env 并填入。后端拒绝启动。');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '64kb' }));

const PORT = Number(process.env.PORT ?? 8788);
const COOKIE_NAME = 'pts_sid';

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini' });
});

// 聊天 SSE
app.post('/api/chat', chatHandler);

// 图片代理（SSRF 收口 + 缓存）
app.get('/api/sprite/:id', spriteHandler);

// 直连：宝可梦详情
app.get('/api/pokemon/:idOrName', async (req, res) => {
  const idOrName = String(req.params.idOrName).toLowerCase();
  // 简单校验：只允许字母数字和连字符
  if (!/^[a-z0-9-]+$/.test(idOrName)) {
    res.status(400).json({ error: 'invalid pokemon id/name' });
    return;
  }
  try {
    const p = await getPokemon(idOrName);
    res.json(p);
  } catch {
    res.status(404).json({ error: 'pokemon not found' });
  }
});

// 直连：进化链（支持分支）
app.get('/api/evolution/:pokemon', async (req, res) => {
  const pokemon = String(req.params.pokemon).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(pokemon)) {
    res.status(400).json({ error: 'invalid pokemon' });
    return;
  }
  try {
    const chain = await getEvolutionChain(pokemon);
    res.json(chain);
  } catch {
    res.status(404).json({ error: 'evolution chain not found' });
  }
});

// 直连：当前队伍（刷新恢复）
app.get('/api/team', (req, res) => {
  const sid = req.headers.cookie ? parse(req.headers.cookie)[COOKIE_NAME] : undefined;
  const session = getSession(sid);
  res.json({ pokemon: session?.team ?? [] });
});

// 队伍回灌：前端 localStorage 持有队伍，服务端内存被清（重启/tsx watch）后用它重建。
// 仅当服务端当前队伍为空时回灌，绝不覆盖活动队伍。按 id 权威重取，保证 snapshot 完整。
app.post('/api/team/restore', async (req, res) => {
  const sid = req.headers.cookie ? parse(req.headers.cookie)[COOKIE_NAME] : undefined;
  const session = getOrCreateSession(sid);
  const ids = Array.isArray(req.body?.pokemon) ? req.body.pokemon.slice(0, 6) : [];
  if (session.team.length === 0 && ids.length) {
    const snaps = [];
    for (const idOrName of ids) {
      try {
        snaps.push(toSnapshot(await getPokemon(String(idOrName))));
      } catch {
        /* 跳过失效项 */
      }
    }
    session.team = snaps;
    logger.info('team restored from client', { count: snaps.length });
  }
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, session.id, { httpOnly: true, sameSite: 'lax', path: '/' }),
  );
  res.json({ pokemon: session.team });
});

app.listen(PORT, () => {
  logger.info(`Pokemon Team Strategist 后端已启动`, { port: PORT, model: process.env.OPENROUTER_MODEL });
});
