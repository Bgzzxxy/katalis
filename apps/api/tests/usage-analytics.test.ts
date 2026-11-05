import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, usageLogs, users } from "../src/db/schema";
import type { AppEnv } from "../src/env";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import { cookieHeader } from "./helpers/http";
import { createFakeQrisProvider } from "./helpers/qris";

type HistoryItem = {
  id: number;
  created_at: string;
  model_id: string;
  pool_tier: string;
  upstream_provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_idr: number;
  latency_ms: number;
  http_status: number;
  api_key_id: string;
  api_key_name: string;
};

type HistoryView = {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

type SummaryView = {
  range_days: number;
  total_tokens: number;
  total_cost_idr: number;
  total_requests: number;
  daily: Array<{ date: string; tokens: number; cost_idr: number; requests: number }>;
  by_model: Array<{
    model_id: string;
    requests: number;
    tokens: number;
    cost_idr: number;
  }>;
};

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
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

const app = createApp({ db, redis, env, qris: createFakeQrisProvider() });

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** WIB calendar date of the given instant, e.g. "2026-11-06". */
function wibDate(instant: Date): string {
  return new Date(instant.getTime() + JAKARTA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function wibDatesBack(days: number): string[] {
  const shifted = new Date(Date.now() + JAKARTA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m, d - i)).toISOString().slice(0, 10));
  }
  return out;
}

/** 23:30 WIB today — still "today", though it is already 16:30 UTC. */
function lateTodayWib(): Date {
  const shifted = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      23,
      30,
    ) - JAKARTA_OFFSET_MS,
  );
}

/** 00:15 WIB today — the first minutes of today's WIB day. */
function earlyTodayWib(): Date {
  const shifted = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      0,
      15,
    ) - JAKARTA_OFFSET_MS,
  );
}

async function register(email: string) {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
}

async function login(email: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  expect(res.status).toBe(200);
  return cookieHeader(res.headers, "katalis_session") ?? "";
}

async function userId(email: string): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return row?.id ?? "";
}

async function createKey(ownerId: string, name: string): Promise<string> {
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: ownerId,
      name,
      keyPrefix: "sk-ktl-test0",
      keyHash: `${name}-${crypto.randomUUID()}`.slice(0, 64),
    })
    .returning({ id: apiKeys.id });
  return row.id;
}

type SeedRow = {
  userId: string;
  apiKeyId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  /** IDR as a fixed 6-decimal string, matching `numeric(12,6)`. */
  costIdr: string;
  createdAt: Date;
  httpStatus?: number;
};

let seedCounter = 0;

async function seedUsage(rows: SeedRow[]): Promise<void> {
  if (rows.length === 0) return;
  seedCounter += 1;
  await db.insert(usageLogs).values(
    rows.map((row) => ({
      userId: row.userId,
      apiKeyId: row.apiKeyId,
      modelId: row.modelId,
      poolTier: "STABLE",
      upstreamProvider: "siliconflow",
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      costChargedIdr: row.costIdr,
      latencyMs: 120 + seedCounter,
      httpStatus: row.httpStatus ?? 200,
      createdAt: row.createdAt,
    })),
  );
}

async function getJson<T>(path: string, cookie?: string): Promise<{ status: number; body: T }> {
  const res = await app.request(
    path,
    cookie ? { headers: { cookie } } : undefined,
  );
  return { status: res.status, body: (await res.json()) as T };
}

beforeAll(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE usage_logs, payment_invoices, api_keys, users RESTART IDENTITY CASCADE`,
  );
  await clearApiKeyCache(redis);
});

afterAll(async () => {
  await clearApiKeyCache(redis);
  await redis.quit();
  await closeDb(dbClient);
});

describe("GET /api/billing/usage/history", () => {
  test("rejects an unauthenticated caller with 401", async () => {
    const { status, body } = await getJson<OpenAiError>(
      "/api/billing/usage/history",
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("rejects an unauthenticated summary caller with 401", async () => {
    const { status, body } = await getJson<OpenAiError>(
      "/api/billing/usage/summary?days=7",
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("returns an empty page for a member with no usage", async () => {
    await register("hist-empty@example.com");
    const cookie = await login("hist-empty@example.com");

    const { status, body } = await getJson<HistoryView>(
      "/api/billing/usage/history",
      cookie,
    );
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  test("returns newest first with the joined API key name and exact values", async () => {
    const email = "hist-list@example.com";
    await register(email);
    const cookie = await login(email);
    const uid = await userId(email);
    const chatKey = await createKey(uid, "produksi");
    const toolKey = await createKey(uid, "cli-lokal");

    const base = Date.now() - 30 * 60 * 1000;
    await seedUsage([
      {
        userId: uid,
        apiKeyId: chatKey,
        modelId: "deepseek-v3",
        promptTokens: 100,
        completionTokens: 50,
        costIdr: "1.250000",
        createdAt: new Date(base),
      },
      {
        userId: uid,
        apiKeyId: toolKey,
        modelId: "qwen-72b",
        promptTokens: 20,
        completionTokens: 5,
        costIdr: "0.500000",
        createdAt: new Date(base + 60_000),
      },
    ]);

    const { status, body } = await getJson<HistoryView>(
      "/api/billing/usage/history",
      cookie,
    );
    expect(status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((i) => i.model_id)).toEqual(["qwen-72b", "deepseek-v3"]);

    const newest = body.items[0];
    expect(newest.api_key_name).toBe("cli-lokal");
    expect(newest.api_key_id).toBe(toolKey);
    expect(newest.prompt_tokens).toBe(20);
    expect(newest.completion_tokens).toBe(5);
    expect(newest.cost_idr).toBeCloseTo(0.5, 6);
    expect(newest.pool_tier).toBe("STABLE");
    expect(newest.upstream_provider).toBe("siliconflow");
    expect(newest.http_status).toBe(200);
    expect(typeof newest.latency_ms).toBe("number");

    const oldest = body.items[1];
    expect(oldest.api_key_name).toBe("produksi");
    expect(oldest.cost_idr).toBeCloseTo(1.25, 6);
    expect(oldest.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("never returns another member's rows", async () => {
    await register("hist-mine@example.com");
    await register("hist-foreign@example.com");
    const myCookie = await login("hist-mine@example.com");
    const mine = await userId("hist-mine@example.com");
    const foreign = await userId("hist-foreign@example.com");
    const myKey = await createKey(mine, "punyaku");
    const foreignKey = await createKey(foreign, "punyanya");

    const at = new Date(Date.now() - 5 * 60 * 1000);
    await seedUsage([
      {
        userId: mine,
        apiKeyId: myKey,
        modelId: "deepseek-v3",
        promptTokens: 7,
        completionTokens: 3,
        costIdr: "0.100000",
        createdAt: at,
      },
      {
        userId: foreign,
        apiKeyId: foreignKey,
        modelId: "qwen-72b",
        promptTokens: 900,
        completionTokens: 900,
        costIdr: "9.000000",
        createdAt: at,
      },
    ]);

    const { body } = await getJson<HistoryView>("/api/billing/usage/history", myCookie);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].model_id).toBe("deepseek-v3");
    expect(body.items[0].api_key_name).toBe("punyaku");
  });

  test("caps limit at 100 and rejects invalid paging input with 400", async () => {
    await register("hist-cap@example.com");
    const cookie = await login("hist-cap@example.com");

    const capped = await getJson<HistoryView>(
      "/api/billing/usage/history?limit=500",
      cookie,
    );
    expect(capped.status).toBe(200);
    expect(capped.body.limit).toBe(100);

    for (const query of [
      "limit=0",
      "limit=-3",
      "limit=abc",
      "offset=-1",
      "offset=xyz",
      "key_id=not-a-uuid",
    ]) {
      const res = await getJson<OpenAiError>(
        `/api/billing/usage/history?${query}`,
        cookie,
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("offset paging returns the complementary page without overlap", async () => {
    const email = "hist-page@example.com";
    await register(email);
    const cookie = await login(email);
    const uid = await userId(email);
    const key = await createKey(uid, "paging");

    const start = Date.now() - 3 * 60 * 60 * 1000;
    await seedUsage(
      Array.from({ length: 5 }).map((_, i) => ({
        userId: uid,
        apiKeyId: key,
        modelId: `model-${i}`,
        promptTokens: 10,
        completionTokens: 1,
        costIdr: "0.010000",
        createdAt: new Date(start + i * 60_000),
      })),
    );

    const first = await getJson<HistoryView>(
      "/api/billing/usage/history?limit=3&offset=0",
      cookie,
    );
    const second = await getJson<HistoryView>(
      "/api/billing/usage/history?limit=3&offset=3",
      cookie,
    );

    expect(first.body.total).toBe(5);
    expect(second.body.total).toBe(5);
    expect(first.body.items).toHaveLength(3);
    expect(second.body.items).toHaveLength(2);

    const firstIds = first.body.items.map((i) => i.id);
    const secondIds = second.body.items.map((i) => i.id);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(5);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);

    const allIds = [...firstIds, ...secondIds];
    expect([...allIds].sort((a, b) => b - a)).toEqual(allIds);
  });
});

describe("GET /api/billing/usage/summary", () => {
  test("returns dense zero days for a member with no usage", async () => {
    await register("sum-zero@example.com");
    const cookie = await login("sum-zero@example.com");

    const { status, body } = await getJson<SummaryView>(
      "/api/billing/usage/summary?days=7",
      cookie,
    );
    expect(status).toBe(200);
    expect(body.range_days).toBe(7);
    expect(body.total_tokens).toBe(0);
    expect(body.total_cost_idr).toBe(0);
    expect(body.total_requests).toBe(0);
    expect(body.by_model).toEqual([]);
    expect(body.daily).toHaveLength(7);
    expect(body.daily.map((d) => d.date)).toEqual(wibDatesBack(7));
    for (const day of body.daily) {
      expect(day.tokens).toBe(0);
      expect(day.cost_idr).toBe(0);
      expect(day.requests).toBe(0);
    }
  });

  test("sums seeded usage exactly, buckets by WIB day and orders models by cost", async () => {
    const email = "sum-seeded@example.com";
    await register(email);
    const cookie = await login(email);
    const uid = await userId(email);
    const key = await createKey(uid, "analitik");

    const today = wibDate(new Date());
    const yesterday = wibDatesBack(2)[0];

    await seedUsage([
      {
        userId: uid,
        apiKeyId: key,
        modelId: "deepseek-v3",
        promptTokens: 1_000,
        completionTokens: 500,
        costIdr: "10.500000",
        createdAt: lateTodayWib(),
      },
      {
        userId: uid,
        apiKeyId: key,
        modelId: "deepseek-v3",
        promptTokens: 200,
        completionTokens: 100,
        costIdr: "2.250000",
        createdAt: earlyTodayWib(),
      },
      {
        userId: uid,
        apiKeyId: key,
        modelId: "qwen-72b",
        promptTokens: 300,
        completionTokens: 150,
        costIdr: "4.000000",
        createdAt: new Date(earlyTodayWib().getTime() - 24 * 60 * 60 * 1000),
      },
    ]);

    const { status, body } = await getJson<SummaryView>(
      "/api/billing/usage/summary?days=7",
      cookie,
    );
    expect(status).toBe(200);
    expect(body.range_days).toBe(7);
    expect(body.total_requests).toBe(3);
    expect(body.total_tokens).toBe(1_500 + 300 + 450);
    expect(body.total_cost_idr).toBeCloseTo(16.75, 6);

    const dates = body.daily.map((d) => d.date);
    expect(dates).toEqual(wibDatesBack(7));

    const todayRow = body.daily.find((d) => d.date === today);
    const yesterdayRow = body.daily.find((d) => d.date === yesterday);
    const quietRow = body.daily.find((d) => d.date === wibDatesBack(7)[0]);

    // Both a 23:30-WIB row and a 00:15-WIB row land on today's WIB day.
    expect(todayRow).toEqual({
      date: today,
      tokens: 1_800,
      cost_idr: 12.75,
      requests: 2,
    });
    expect(yesterdayRow).toEqual({
      date: yesterday,
      tokens: 450,
      cost_idr: 4,
      requests: 1,
    });
    expect(quietRow).toEqual({ date: wibDatesBack(7)[0], tokens: 0, cost_idr: 0, requests: 0 });

    expect(body.by_model).toEqual([
      { model_id: "deepseek-v3", requests: 2, tokens: 1_800, cost_idr: 12.75 },
      { model_id: "qwen-72b", requests: 1, tokens: 450, cost_idr: 4 },
    ]);
  });

  test("excludes traffic older than the requested window", async () => {
    const email = "sum-window@example.com";
    await register(email);
    const cookie = await login(email);
    const uid = await userId(email);
    const key = await createKey(uid, "window");

    const ancient = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await seedUsage([
      {
        userId: uid,
        apiKeyId: key,
        modelId: "deepseek-v3",
        promptTokens: 999,
        completionTokens: 999,
        costIdr: "99.000000",
        createdAt: ancient,
      },
    ]);

    const { body } = await getJson<SummaryView>(
      "/api/billing/usage/summary?days=7",
      cookie,
    );
    expect(body.total_requests).toBe(0);
    expect(body.total_tokens).toBe(0);
    expect(body.total_cost_idr).toBe(0);
    expect(body.by_model).toEqual([]);
    expect(body.daily.every((d) => d.requests === 0)).toBe(true);
  });

  test("supports days=30 and rejects unsupported ranges with 400", async () => {
    await register("sum-range@example.com");
    const cookie = await login("sum-range@example.com");

    const thirty = await getJson<SummaryView>(
      "/api/billing/usage/summary?days=30",
      cookie,
    );
    expect(thirty.status).toBe(200);
    expect(thirty.body.range_days).toBe(30);
    expect(thirty.body.daily).toHaveLength(30);

    const defaults = await getJson<SummaryView>(
      "/api/billing/usage/summary",
      cookie,
    );
    expect(defaults.status).toBe(200);
    expect(defaults.body.range_days).toBe(7);

    for (const query of ["days=14", "days=0", "days=abc"]) {
      const res = await getJson<OpenAiError>(
        `/api/billing/usage/summary?${query}`,
        cookie,
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("summary totals only the calling member's rows", async () => {
    await register("sum-mine@example.com");
    await register("sum-foreign@example.com");
    const cookie = await login("sum-mine@example.com");
    const mine = await userId("sum-mine@example.com");
    const foreign = await userId("sum-foreign@example.com");
    const myKey = await createKey(mine, "mine");
    const foreignKey = await createKey(foreign, "foreign");

    await seedUsage([
      {
        userId: mine,
        apiKeyId: myKey,
        modelId: "deepseek-v3",
        promptTokens: 10,
        completionTokens: 10,
        costIdr: "0.200000",
        createdAt: new Date(Date.now() - 60_000),
      },
      {
        userId: foreign,
        apiKeyId: foreignKey,
        modelId: "glm-4",
        promptTokens: 500,
        completionTokens: 500,
        costIdr: "50.000000",
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);

    const { body } = await getJson<SummaryView>(
      "/api/billing/usage/summary?days=7",
      cookie,
    );
    expect(body.total_requests).toBe(1);
    expect(body.total_tokens).toBe(20);
    expect(body.total_cost_idr).toBeCloseTo(0.2, 6);
    expect(body.by_model.map((m) => m.model_id)).toEqual(["deepseek-v3"]);
  });
});
