import { sql } from "drizzle-orm";
import type Redis from "ioredis";
import type { Db } from "../db";
import { pingDb } from "../db";
import { pingRedis } from "../db/redis";

export type PoolTier = "LORA" | "STABLE" | "FLEX";

export type Telemetry = {
  connection: { ok: boolean; latency_ms: number };
  total_tokens: number;
  requests_per_second: number;
  avg_latency_ms: number;
  pools: Array<{ tier: PoolTier; recent_requests: number; load_pct: number }>;
  window: Array<{ t: number; tokens: number; requests: number }>;
};

const CACHE_KEY = "telemetry:latest";
const CACHE_TTL_SECONDS = 2;
const WINDOW_SECONDS = 60;
const POOL_TIERS: PoolTier[] = ["LORA", "STABLE", "FLEX"];
// The shared ioredis client retries for ~20 attempts, so an unreachable server
// would stall a command far longer than this cache's 2s TTL (see pingRedis).
const REDIS_TIMEOUT_MS = 200;

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Bound a Redis op so a down Redis cannot hang the request. */
function within<T>(op: Promise<T>, timeoutMs = REDIS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    op,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("redis op timeout")), timeoutMs),
    ),
  ]);
}

/** Pure aggregation over the real `usage_logs` table (no fabricated values). */
export async function computeTelemetry(db: Db): Promise<Omit<Telemetry, "connection">> {
  // Align the 60 one-second buckets to a whole second so cached and fresh
  // responses are stable within the same second.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - WINDOW_SECONDS;
  const windowEnd = nowSeconds;
  const recentCutoff = nowSeconds - WINDOW_SECONDS;

  const totalsRows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(prompt_tokens + completion_tokens), 0)::bigint AS total_tokens,
      COALESCE(AVG(latency_ms) FILTER (WHERE created_at >= to_timestamp(${recentCutoff})), 0)::float8 AS avg_latency_ms
    FROM usage_logs
  `)) as Array<{ total_tokens: string | number; avg_latency_ms: number }>;

  const poolRows = (await db.execute(sql`
    SELECT pool_tier AS tier, COUNT(*)::int AS recent_requests
    FROM usage_logs
    WHERE created_at >= to_timestamp(${recentCutoff})
    GROUP BY pool_tier
  `)) as Array<{ tier: string; recent_requests: number | string }>;

  // shortcut: three full scans of usage_logs per refresh; add an index on
  // created_at when the table grows past a few hundred thousand rows.
  const windowRows = (await db.execute(sql`
    SELECT
      FLOOR(EXTRACT(EPOCH FROM created_at))::bigint AS sec,
      SUM(prompt_tokens + completion_tokens)::bigint AS tokens,
      COUNT(*)::int AS requests
    FROM usage_logs
    WHERE created_at >= to_timestamp(${windowStart}) AND created_at < to_timestamp(${windowEnd})
    GROUP BY sec
  `)) as Array<{ sec: string | number; tokens: string | number; requests: number | string }>;

  const bySecond = new Map<number, { tokens: number; requests: number }>();
  for (const row of windowRows) {
    bySecond.set(toNumber(row.sec), {
      tokens: toNumber(row.tokens),
      requests: toNumber(row.requests),
    });
  }

  const window: Telemetry["window"] = [];
  for (let sec = windowStart; sec < windowEnd; sec += 1) {
    const bucket = bySecond.get(sec);
    window.push({
      t: sec * 1000,
      tokens: bucket?.tokens ?? 0,
      requests: bucket?.requests ?? 0,
    });
  }

  const recentByTier = new Map<string, number>();
  for (const row of poolRows) {
    recentByTier.set(row.tier, toNumber(row.recent_requests));
  }

  // Relative share of all recent requests (0-100); no traffic -> 0.
  const totalRecent = POOL_TIERS.reduce(
    (sum, tier) => sum + (recentByTier.get(tier) ?? 0),
    0,
  );

  const pools: Telemetry["pools"] = POOL_TIERS.map((tier) => {
    const recent = recentByTier.get(tier) ?? 0;
    return {
      tier,
      recent_requests: recent,
      load_pct: totalRecent === 0 ? 0 : Math.round((recent / totalRecent) * 100),
    };
  });

  const totals = totalsRows[0] ?? { total_tokens: 0, avg_latency_ms: 0 };
  const latest = window[window.length - 1];

  return {
    total_tokens: Math.round(toNumber(totals.total_tokens)),
    requests_per_second: latest?.requests ?? 0,
    avg_latency_ms: Math.round(toNumber(totals.avg_latency_ms)),
    pools,
    window,
  };
}

export async function getTelemetry(db: Db, redis: Redis): Promise<Telemetry> {
  try {
    const cached = await within(redis.get(CACHE_KEY));
    if (cached) return JSON.parse(cached) as Telemetry;
  } catch {
    // Best-effort cache; a down Redis must not fail telemetry.
  }

  const payload = await computeTelemetry(db);
  const startedAt = Date.now();
  const ok = (await pingDb(db)) && (await pingRedis(redis, REDIS_TIMEOUT_MS));

  const telemetry: Telemetry = {
    ...payload,
    connection: { ok, latency_ms: Date.now() - startedAt },
  };

  try {
    await within(redis.set(CACHE_KEY, JSON.stringify(telemetry), "EX", CACHE_TTL_SECONDS));
  } catch {
    // Best-effort cache only.
  }

  return telemetry;
}