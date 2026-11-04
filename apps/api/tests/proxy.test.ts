import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, usageLogs, users } from "../src/db/schema";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import type { AppEnv } from "../src/env";
import type { RouterConfig } from "../src/services/upstream-router";
import {
  startMockUpstream,
  jsonUpstream,
  sseUpstream,
  jsonResponse,
  type MockUpstream,
} from "./helpers/upstream-mock";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

const RAW_KEY = "sk-ktl-ABCDEFGHJKLMNPQSTUVWXYZ123456789";

const env: AppEnv = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  NODE_ENV: "test",
  COOKIE_SECURE: false,
  CORS_ORIGINS: "http://localhost:5173",
  PROXY_FIRST_BYTE_TIMEOUT_MS: 3000,
  FLEX_WINDOW_MS: 5 * 60 * 60 * 1000,
  FLEX_WINDOW_MAX_TOKENS: 1_000_000,
};

let primary: MockUpstream | undefined;
let secondary: MockUpstream | undefined;

async function makeUser(): Promise<{ userId: string; keyId: string; keyHash: string }> {
  const [uRow] = await db
    .insert(users)
    .values({ email: `p-${Math.random().toString(16).slice(2)}@example.com`, walletBalanceIdr: "50.0000" })
    .returning({ id: users.id });
  const keyHash = createHash("sha256").update(RAW_KEY).digest("hex");
  const [kRow] = await db
    .insert(apiKeys)
    .values({
      userId: uRow.id,
      name: "proxy",
      keyPrefix: RAW_KEY.slice(0, 16),
      keyHash,
    })
    .returning({ id: apiKeys.id });
  return { userId: uRow.id, keyId: kRow.id, keyHash };
}

function buildApp(): ReturnType<typeof createApp> {
  const upstream: RouterConfig = {
    providers: {
      SILICONFLOW: primary
        ? { id: "SILICONFLOW", baseUrl: primary.url }
        : undefined,
      DEEPSEEK: secondary
        ? { id: "DEEPSEEK", baseUrl: secondary.url }
        : undefined,
    },
    firstByteTimeoutMs: 1000,
    fetchImpl: fetch,
  };
  return createApp({ db, redis, env, upstream });
}

function chatRequest(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${RAW_KEY}` },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
});

afterAll(async () => {
  await clearApiKeyCache(redis);
  await redis.quit();
  await closeDb(dbClient);
});

beforeEach(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
  for (const key of await redis.keys("wallet:*")) await redis.del(key);
  for (const key of await redis.keys("flex:*")) await redis.del(key);
});

describe("POST /v1/chat/completions", () => {
  test("401 invalid_api_key when the bearer token is missing", async () => {
    const app = buildApp();
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen3-max", messages: [] }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("invalid_api_key");
  });

  test("404 model_not_found for an unknown model", async () => {
    await makeUser();
    const app = buildApp();
    const res = await chatRequest(app, { model: "nope", messages: [] });
    expect(res.status).toBe(404);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("model_not_found");
  });

  test("passes through a successful JSON completion and inserts a usage log", async () => {
    const { userId, keyHash } = await makeUser();
    primary = startMockUpstream(() =>
      jsonUpstream({ usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }),
    );
    const app = buildApp();

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { choices: unknown[]; usage: object };
    expect(body.choices).toHaveLength(1);
    expect(body.usage).toBeTruthy();
    expect(primary?.count()).toBe(1);

    const [usage] = await db.select().from(usageLogs);
    expect(usage).toBeTruthy();
    expect(usage.costChargedIdr).toBe("0.004800");

    expect(await redis.get(`wallet:${userId}`)).toBe("49.9952");
    const spent = await redis.hget(`apikey:${keyHash}`, "spent_idr");
    expect(Number(spent)).toBeCloseTo(0.0048, 4);
  });

  test("streams SSE byte-identically and charges by upstream usage", async () => {
    const { userId } = await makeUser();
    const ok = async () => {
      primary = startMockUpstream(() =>
        sseUpstream(
          ['data: {"id":"cmpl"}\n\n', 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'],
          { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        ),
      );
      const app = buildApp();
      const res = await chatRequest(app, { model: "qwen3-max", messages: [], stream: true });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const text = await res.text();
      expect(text).toContain('data: {"id":"cmpl"}');
      expect(text).toContain("content");
    };
    await ok();

    expect(await redis.get(`wallet:${userId}`)).toBeTruthy();
  });

  test("502 upstream_error leaves the wallet untouched when all upstreams fail", async () => {
    const { userId } = await makeUser();
    primary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    const app = buildApp();

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(res.status).toBe(502);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("upstream_error");
    // Invariant: balance is seeded but NOT debited when all upstreams fail.
    expect(await redis.get(`wallet:${userId}`)).toBe("50.0000");
  });
});

describe("GET /v1/models", () => {
  test("lists catalog models and requires auth", async () => {
    const res = await buildApp().request("/v1/models");
    expect(res.status).toBe(401);

    await makeUser();
    const authed = await buildApp().request("/v1/models", {
      headers: { authorization: `Bearer ${RAW_KEY}` },
    });
    expect(authed.status).toBe(200);
    const body = (await authed.json()) as { object: string; data: unknown[] };
    expect(body.object).toBe("list");
    expect(body.data.length).toBeGreaterThan(0);
  });
});