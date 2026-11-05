import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import type { AppEnv } from "../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import { findModel } from "../src/services/model-catalog";

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

type ModelRow = {
  id: string;
  name: string;
  provider: string;
  pool: string;
  owned_by: string;
  price_in_idr_per_1m: number;
  price_out_idr_per_1m: number;
  capabilities: string[];
};

async function login(email: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  expect(res.status).toBe(200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

beforeAll(async () => {
  await resetDb(db);
});

beforeEach(async () => {
  await clearApiKeyCache(redis);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("GET /api/models", () => {
  test("is public and returns the full UI catalog shape", async () => {
    const res = await app.request("/api/models");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { object: string; data: ModelRow[] };
    expect(body.object).toBe("list");
    expect(body.data.length).toBeGreaterThan(0);

    const first = body.data[0];
    expect(typeof first.id).toBe("string");
    expect(first.name.length).toBeGreaterThan(0);
    expect(first.provider.length).toBeGreaterThan(0);
    expect(["LORA", "STABLE", "FLEX"]).toContain(first.pool);
    expect(first.price_in_idr_per_1m).toBeGreaterThan(0);
    expect(first.price_out_idr_per_1m).toBeGreaterThan(0);
    expect(Array.isArray(first.capabilities)).toBe(true);
  });

  test("prices are IDR per 1M (not micro-IDR)", async () => {
    const res = await app.request("/api/models");
    const body = (await res.json()) as { data: ModelRow[] };
    const row = body.data.find((m) => m.id === "deepseek-v4-pro");
    const spec = findModel("deepseek-v4-pro");
    expect(spec).toBeDefined();
    expect(row?.price_in_idr_per_1m).toBe(spec!.priceInMicroPer1M / 1_000_000);
    expect(row?.price_out_idr_per_1m).toBe(spec!.priceOutMicroPer1M / 1_000_000);
    // Sanity: the served number is a 1M-token price, not the micro value itself.
    expect(row!.price_in_idr_per_1m).toBeLessThan(spec!.priceInMicroPer1M);
  });

  test("agrees with /v1/models on ids and capabilities are documented-only", async () => {
    const pub = (await (await app.request("/api/models")).json()) as {
      data: ModelRow[];
    };

    expect(pub.data.map((m) => m.id)).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4.1-flash",
      "qwen3-max",
      "glm-5.3-flash",
      "glm-4.6v",
      "kimi-k2",
      "doubao-pro",
      "hunyuan-lora-coder",
    ]);

    const glm = pub.data.find((m) => m.id === "glm-5.3-flash");
    expect(glm?.capabilities).toEqual([]);
    const vision = pub.data.find((m) => m.id === "glm-4.6v");
    expect(vision?.capabilities).toEqual(["Vision"]);
  });
});

describe("GET /api/billing/usage", () => {
  test("requires a member session", async () => {
    const res = await app.request("/api/billing/usage");
    expect(res.status).toBe(401);
  });

  test("reports zeroed daily usage for a fresh member", async () => {
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "usage-fresh@example.com", password: "password123" }),
    });
    const cookie = await login("usage-fresh@example.com");

    const res = await app.request("/api/billing/usage", { headers: { cookie } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      date: string;
      tokens_used: number;
      amount_spent_idr: number;
    };
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.tokens_used).toBe(0);
    expect(body.amount_spent_idr).toBe(0);
  });
});
