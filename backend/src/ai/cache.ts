// ─── Redis Caching Micro-Layer ────────────────────────────────────────────────
// Provides TTL-based caching with hit/miss tracking and graceful degradation.

import { redisClient } from '../db/client';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
}

const stats: CacheStats = { hits: 0, misses: 0, sets: 0, errors: 0 };
const localCache = new Map<string, { value: any; expires: number }>();

// ─── Get ──────────────────────────────────────────────────────────────────────
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  // L1: In-process cache (hot path)
  const local = localCache.get(key);
  if (local && local.expires > Date.now()) {
    stats.hits++;
    return local.value as T;
  }

  // L2: Redis
  try {
    const raw = await redisClient.get(`flowzint:${key}`);
    if (raw) {
      stats.hits++;
      const parsed = JSON.parse(raw);
      // Warm L1 cache
      localCache.set(key, { value: parsed, expires: Date.now() + 30_000 });
      return parsed as T;
    }
  } catch {
    stats.errors++;
  }

  stats.misses++;
  return null;
}

// ─── Set ──────────────────────────────────────────────────────────────────────
export async function cacheSet(key: string, value: any, ttlSeconds = 300): Promise<void> {
  // L1: Write-through
  localCache.set(key, { value, expires: Date.now() + Math.min(ttlSeconds * 1000, 30_000) });

  // L2: Redis
  try {
    await redisClient.setEx(`flowzint:${key}`, ttlSeconds, JSON.stringify(value));
    stats.sets++;
  } catch {
    stats.errors++;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function cacheDel(key: string): Promise<void> {
  localCache.delete(key);
  try {
    await redisClient.del(`flowzint:${key}`);
  } catch {}
}

// ─── Pattern Delete ───────────────────────────────────────────────────────────
export async function cacheDelPattern(pattern: string): Promise<void> {
  // Clear matching L1 entries
  for (const k of localCache.keys()) {
    if (k.includes(pattern)) localCache.delete(k);
  }
  // Clear Redis
  try {
    const keys = await redisClient.keys(`flowzint:${pattern}*`);
    if (keys.length > 0) await redisClient.del(keys);
  } catch {}
}

// ─── Get or Compute ───────────────────────────────────────────────────────────
export async function cacheGetOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function getCacheStats(): CacheStats & { hitRate: string } {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? `${((stats.hits / total) * 100).toFixed(1)}%` : 'N/A';
  return { ...stats, hitRate };
}

// ─── Cleanup L1 ───────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of localCache.entries()) {
    if (v.expires <= now) localCache.delete(k);
  }
}, 60_000); // Clean expired entries every minute
