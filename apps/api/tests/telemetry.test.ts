import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, usageLogs, users } from "../src/db/schema";
import type { AppEnv } from "../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "./helpers/db";

type TelemetryBody = {
  connection: { ok: boolean; latency_ms: number };
  total_tokens: number;
  requests_per_second: number;
  avg_latency_ms: number;
  pools: Array<{ tier: string; recent_requests: number; load_pct: number }>;
  window: Array<{ t: number; tokens: number; requests: number }>;
};

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

const env: AppEnv = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  NODE_ENV: "test",
  COOKIE_SECURE: false,
  CORS_ORIGINS: "http://localhost:5173",
};

const app = createApp({ db, redis, env });

async function seedUserAndKey(): Promise<{ userId: string; apiKeyId: string }> {
  const email = `telemetry-${Math.random().toString(16).slice(2)}@example.com`;
  const [user] = await db
    .insert(users)
    .values({ email })
    .returning({ id: users.id });
  const [key] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      name: "telemetry-key",
      keyPrefix: "sk-ktl-12345678",
      keyHash: `hash-${Math.random().toString(16).slice(2)}`,
    })
    .returning({ id: apiKeys.id });
  return { userId: user.id, apiKeyId: key.id };
}

async function insertUsage(
  ids: { userId: string; apiKeyId: string },
  opts: {
    poolTier: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    ageMs: number;
  },
) {
  await db.insert(usageLogs).values({
    userId: ids.userId,
    apiKeyId: ids.apiKeyId,
    modelId: "deepseek-chat",
    poolTier: opts.poolTier,
    upstreamProvider: "deepseek",
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    costChargedIdr: "0.000000",
    latencyMs: opts.latencyMs,
    httpStatus: 200,
    createdAt: new Date(Date.now() - opts.ageMs),
  });
}

async function getTelemetry(): Promise<{ status: number; body: TelemetryBody }> {
  const res = await app.request("/api/telemetry");
  return { status: res.status, body: (await res.json()) as TelemetryBody };
}

async function clearTelemetryCache() {
  const keys = await redis.keys("telemetry:*");
  if (keys.length > 0) await redis.del(...keys);
}

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await clearTelemetryCache();
  await redis.quit();
  await closeDb(dbClient);
});

beforeEach(async () => {
  await resetDb(db);
  await clearTelemetryCache();
});

describe("GET /api/telemetry", () => {
  test("returns the required shape and aggregates real usage_logs values", async () => {
    const ids = await seedUserAndKey();
    await insertUsage(ids, {
      poolTier: "LORA",
      promptTokens: 10,
      completionTokens: 5,
      latencyMs: 100,
      ageMs: 200,
    });
    await insertUsage(ids, {
      poolTier: "STABLE",
      promptTokens: 20,
      completionTokens: 10,
      latencyMs: 200,
      ageMs: 30_000,
    });
    await insertUsage(ids, {
      poolTier: "FLEX",
      promptTokens: 5,
      completionTokens: 5,
      latencyMs: 300,
      ageMs: 120_000,
    });

    const { status, body } = await getTelemetry();

    expect(status).toBe(200);
    expect(body.connection.ok).toBe(true);
    expect(typeof body.connection.latency_ms).toBe("number");
    expect(body.total_tokens).toBe(55);
    expect(typeof body.requests_per_second).toBe("number");
    expect(body.requests_per_second).toBeGreaterThanOrEqual(0);
    expect(body.avg_latency_ms).toBe(150);
    expect(body.pools).toHaveLength(3);
    expect(body.pools.map((p) => p.tier)).toEqual(["LORA", "STABLE", "FLEX"]);
    expect(body.pools.find((p) => p.tier === "LORA")!.recent_requests).toBe(1);
    expect(body.pools.find((p) => p.tier === "LORA")!.load_pct).toBe(50);
    expect(body.pools.find((p) => p.tier === "STABLE")!.recent_requests).toBe(1);
    expect(body.pools.find((p) => p.tier === "STABLE")!.load_pct).toBe(50);
    expect(body.pools.find((p) => p.tier === "FLEX")!.recent_requests).toBe(0);
    expect(body.pools.find((p) => p.tier === "FLEX")!.load_pct).toBe(0);
    expect(body.window).toHaveLength(60);
    for (const bucket of body.window) {
      expect(typeof bucket.t).toBe("number");
      expect(typeof bucket.tokens).toBe("number");
      expect(typeof bucket.requests).toBe("number");
    }
  });

  test("returns zeroed but fully-shaped telemetry with no data", async () => {
    const { status, body } = await getTelemetry();

    expect(status).toBe(200);
    expect(body.connection.ok).toBe(true);
    expect(body.total_tokens).toBe(0);
    expect(body.requests_per_second).toBe(0);
    expect(body.avg_latency_ms).toBe(0);
    expect(body.pools).toEqual([
      { tier: "LORA", recent_requests: 0, load_pct: 0 },
      { tier: "STABLE", recent_requests: 0, load_pct: 0 },
      { tier: "FLEX", recent_requests: 0, load_pct: 0 },
    ]);
    expect(body.window).toHaveLength(60);
    expect(body.window.every((b) => b.tokens === 0 && b.requests === 0)).toBe(true);
  });

  test("serves a consistent cached response and stores telemetry:latest", async () => {
    const ids = await seedUserAndKey();
    await insertUsage(ids, {
      poolTier: "STABLE",
      promptTokens: 7,
      completionTokens: 3,
      latencyMs: 120,
      ageMs: 50,
    });

    const first = await getTelemetry();
    const second = await getTelemetry();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await redis.get("telemetry:latest")).not.toBeNull();
  });
});