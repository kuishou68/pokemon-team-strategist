// ============================================================
// 图片代理 GET /api/sprite/:id
// - SSRF 收口：只代理固定 PokeAPI sprite 域名，:id 严格校验数字
// - 磁盘 + 内存缓存（解决 raw.githubusercontent 中国网络慢；缓存是关键）
// - ?pixel=1 取 pixel sprite（小图标），否则 official-artwork
// ============================================================

import type { Request, Response } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../../.sprite-cache');

// 固定可信前缀（绝不转发任意 URL）
const OFFICIAL_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const PIXEL_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// 内存缓存（限量）+ 并发限制
const memCache = new Map<string, Buffer>();
const MEM_MAX = 300;
let inFlight = 0;
const MAX_INFLIGHT = 12;

async function ensureDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function cacheFile(id: number, pixel: boolean): string {
  return path.join(CACHE_DIR, `${pixel ? 'px-' : ''}${id}.png`);
}

export async function spriteHandler(req: Request, res: Response): Promise<void> {
  const idRaw = String(req.params.id ?? '');
  // 严格校验数字（防 SSRF / 路径穿越）
  if (!/^\d+$/.test(idRaw)) {
    res.status(400).json({ error: 'invalid sprite id' });
    return;
  }
  const id = Number(idRaw);
  if (id <= 0 || id > 100000) {
    res.status(400).json({ error: 'sprite id out of range' });
    return;
  }
  const pixel = req.query.pixel === '1';
  const memKey = `${pixel ? 'px' : 'art'}-${id}`;

  const serve = (buf: Buffer) => {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7d
    res.end(buf);
  };

  // 1. 内存缓存
  const mem = memCache.get(memKey);
  if (mem) {
    serve(mem);
    return;
  }

  // 2. 磁盘缓存
  const file = cacheFile(id, pixel);
  try {
    const buf = await fs.readFile(file);
    putMem(memKey, buf);
    serve(buf);
    return;
  } catch {
    /* miss → fetch upstream */
  }

  // 3. 上游拉取（固定域名拼接，绝不接受任意 URL）
  if (inFlight >= MAX_INFLIGHT) {
    res.status(503).json({ error: 'sprite proxy busy, retry' });
    return;
  }
  inFlight += 1;
  const url = `${pixel ? PIXEL_BASE : OFFICIAL_BASE}/${id}.png`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const upstream = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!upstream.ok) {
      res.status(404).json({ error: 'sprite not found' });
      return;
    }
    const arrBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    putMem(memKey, buf);
    await ensureDir();
    fs.writeFile(file, buf).catch((e) => logger.warn('sprite disk cache write failed', { err: String(e) }));
    serve(buf);
  } catch (e) {
    logger.warn('sprite proxy fetch failed', { id, err: String(e) });
    res.status(502).json({ error: 'sprite fetch failed' });
  } finally {
    inFlight -= 1;
  }
}

function putMem(key: string, buf: Buffer) {
  if (memCache.size >= MEM_MAX) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, buf);
}
