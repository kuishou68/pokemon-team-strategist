// ============================================================
// 全局 LRU + TTL 缓存（非 per-session）：宝可梦/属性/招式数据不变，跨会话复用。
// PokeAPI 要求本地缓存、勿高频轰炸（N+1 防护）。
// ============================================================

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<V> {
  private map = new Map<string, Entry<V>>();
  constructor(
    private readonly maxSize = 1000,
    private readonly ttlMs = 1000 * 60 * 60 * 24, // 24h（宝可梦数据基本不变）
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // LRU：命中后移到末尾
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  /** 命中但已过期时仍可读到旧值（降级用：上游挂了返回 stale） */
  getStale(key: string): V | undefined {
    return this.map.get(key)?.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** 上游 JSON 缓存（共享实例） */
export const upstreamCache = new LruCache<unknown>(2000);
