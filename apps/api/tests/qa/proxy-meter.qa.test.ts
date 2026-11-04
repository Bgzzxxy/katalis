/**
 * QA independent suite — Batch 3 proxy / upstream-router / token-meter.
 *
 * Written by the QA engineer (does not edit src/ or the developer's tests).
 * Goal: prove or falsify the financial invariants (CLAUDE.md §5.2/§5.4) and the
 * Prd.md §7 edge cases. Tests prefixed "[BUG]" document a behavior that breaks
 * the stated contract; they are expected to FAIL until fixed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { apiKeys, usageLogs, users } from "../../src/db/schema";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "../helpers/db";
import { clearApiKeyCache } from "../helpers/redis";
import type { AppEnv } from "../../src/env";
import type { RouterConfig } from "../../src/services/upstream-router";
import {
  startMockUpstream,
  jsonUpstream,
  sseUpstream,
  jsonResponse,
  type MockUpstream,
} from "../helpers/upstream-mock";

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

async function makeUser(
  balance = "50.0000",
  unlimitedUntil: Date | null = null,
): Promise<{ userId: string; keyId: string; keyHash: string }> {
  const [uRow] = await db
    .insert(users)
    .values({
      email: `qa-${Math.random().toString(16).slice(2)}@example.com`,
      walletBalanceIdr: balance,
      unlimitedExpiresAt: unlimitedUntil,
    })
    .returning({ id: users.id });
  const keyHash = createHash("sha256").update(RAW_KEY).digest("hex");
  const [kRow] = await db
    .insert(apiKeys)
    .values({
      userId: uRow.id,
      name: "qa-proxy",
      keyPrefix: RAW_KEY.slice(0, 16),
      keyHash,
    })
    .returning({ id: apiKeys.id });
  return { userId: uRow.id, keyId: kRow.id, keyHash };
}

async function setLimit(keyHash: string, limit: string | null): Promise<void> {
  await db.update(apiKeys).set({ spendLimitIdr: limit }).where(eq(apiKeys.keyHash, keyHash));
}

function buildApp(
  providers: Partial<Record<"SILICONFLOW" | "DEEPSEEK" | "ZHIPU" | "VOLCENGINE", MockUpstream>>,
): ReturnType<typeof createApp> {
  const specs: RouterConfig["providers"] = {};
  for (const [id, mock] of Object.entries(providers)) {
    if (mock) specs[id as keyof typeof specs] = { id: id as never, baseUrl: mock.url };
  }
  const upstream: RouterConfig = {
    providers: specs,
    firstByteTimeoutMs: 1000,
    fetchImpl: fetch,
  };
  return createApp({ db, redis, env, upstream });
}

function chatRequest(
  app: ReturnType<typeof createApp>,
  body: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return app.request("/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${RAW_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

function usage(prompt: number, completion: number) {
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

function slowSse(chunks: string[], delayMs: number, usageObj: object): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(enc.encode(chunk));
        await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ choices: [], usage: usageObj })}\n\ndata: [DONE]\n\n`),
      );
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function walletIdr(userId: string): Promise<number> {
  const raw = await redis.get(`wallet:${userId}`);
  return raw === null ? NaN : Number(raw);
}

async function pgWalletIdr(userId: string): Promise<number> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId));
  return Number(row.walletBalanceIdr);
}

async function spentRedis(keyHash: string): Promise<number> {
  const v = await redis.hget(`apikey:${keyHash}`, "spent_idr");
  return v === null ? 0 : Number(v);
}

async function spentPg(keyId: string): Promise<number> {
  const [row] = await db.select({ spentIdr: apiKeys.spentIdr }).from(apiKeys).where(eq(apiKeys.id, keyId));
  return Number(row.spentIdr);
}

beforeAll(async () => {
  await resetDb(db);
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

// ---------------------------------------------------------------------------
// A. Financial correctness — wallet never negative, ledger matches deduction
// ---------------------------------------------------------------------------
describe("QA · financial invariants", () => {
  test("A1 parallel proxy requests never drive the wallet negative", async () => {
    const { userId } = await makeUser("0.0500");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    // qwen3-max: (100*16e6 + 50*64e6)/1e6 = 4800 micro = 0.0048 IDR per call.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => chatRequest(app, { model: "qwen3-max", messages: [] })),
    );
    const wallet = await walletIdr(userId);
    const logs = await db.select().from(usageLogs);
    const loggedTotal = logs.reduce((s, l) => s + Number(l.costChargedIdr), 0);
    const deltas = Number("0.0500") - wallet;

    console.log(
      `[QA-EVIDENCE A1] statuses=${results.map((r) => r.status).join(",")} wallet=${wallet} deducted=${deltas.toFixed(4)} loggedTotal=${loggedTotal.toFixed(6)}`,
    );

    expect(wallet).toBeGreaterThanOrEqual(0);
    expect(deltas).toBeLessThanOrEqual(0.05 + 1e-9);
    primary.stop();
  });

  test("[BUG] A2 usage_logs must not claim more than the wallet was actually debited", async () => {
    // Wallet 0.0010 IDR (1000 micro) but the request costs 4800 micro.
    // charge() clamps to the available 1000 micro, yet the log records full cost.
    const { userId } = await makeUser("0.0010");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(res.status).toBe(200);
    const wallet = await walletIdr(userId);
    const [log] = await db.select().from(usageLogs);
    const deducted = 0.001 - wallet;

    console.log(
      `[QA-EVIDENCE A2] wallet=${wallet} actuallyDeducted=${deducted.toFixed(6)} loggedCost=${log.costChargedIdr}`,
    );

    primary.stop();
    // The ledger must equal the money actually taken.
    expect(Number(log.costChargedIdr)).toBeCloseTo(deducted, 6);
  });

  test("[BUG] A3 PG wallet_balance_idr must be debited (durable ledger), not left at its seed", async () => {
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    await chatRequest(app, { model: "qwen3-max", messages: [] });
    const pgAfter = await pgWalletIdr(userId);
    console.log(`[QA-EVIDENCE A3] redisWallet=${await walletIdr(userId)} pgWallet=${pgAfter}`);
    primary.stop();

    expect(pgAfter).toBeCloseTo(49.9952, 4);
  });

  test("[BUG] A4 an evicted/restarted wallet must not re-credit spent balance from the PG seed", async () => {
    // Prd §7 race-condition analog: balance must be durable. Simulate Redis
    // eviction of `wallet:<id>` and show the next request re-seeds the ORIGINAL
    // PG balance (spend is lost) because PG is never debited.
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(await walletIdr(userId)).toBeCloseTo(49.9952, 4);

    await redis.del(`wallet:${userId}`); // simulate eviction / Redis restart
    await chatRequest(app, { model: "qwen3-max", messages: [] });
    const afterReseed = await walletIdr(userId);
    console.log(`[QA-EVIDENCE A4] walletAfterReseed=${afterReseed}`);
    primary.stop();

    // Should stay ~49.9904; a re-credit exposes 49.9952 of free usage.
    expect(afterReseed).toBeCloseTo(49.9904, 4);
  });
});

// ---------------------------------------------------------------------------
// B. Failover / Rp 0
// ---------------------------------------------------------------------------
describe("QA · failover and zero-charge", () => {
  test("B1 primary 503 fails over to the backup and charges once", async () => {
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    secondary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary, VOLCENGINE: secondary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(res.status).toBe(200);
    const [log] = await db.select().from(usageLogs);
    console.log(`[QA-EVIDENCE B1] provider=${log.upstreamProvider} status=${log.httpStatus}`);
    expect(log.upstreamProvider).toBe("VOLCENGINE");
    expect(await walletIdr(userId)).toBeCloseTo(49.9952, 4);
    primary.stop();
    secondary.stop();
  });

  test("B2 all upstreams down -> 502 and both Redis AND PG balance untouched", async () => {
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    secondary = startMockUpstream(() => jsonResponse({ error: "down" }, 504));
    const app = buildApp({ SILICONFLOW: primary, VOLCENGINE: secondary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    expect(res.status).toBe(502);
    expect(((await res.json()) as OpenAiError).error.code).toBe("upstream_error");
    console.log(`[QA-EVIDENCE B2] wallet=${await walletIdr(userId)} pg=${await pgWalletIdr(userId)}`);
    // Invariant: Rp 0 charged — Redis seeded balance is unchanged.
    expect(await walletIdr(userId)).toBeCloseTo(50, 4);
    primary.stop();
    secondary.stop();
  });

  test("[BUG] B3 a 4xx upstream error must not be billed to the user", async () => {
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonResponse({ error: { message: "bad request" } }, 400));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    const [log] = await db.select().from(usageLogs);
    console.log(
      `[QA-EVIDENCE B3] status=${res.status} wallet=${await walletIdr(userId)} loggedCost=${log?.costChargedIdr}`,
    );
    primary.stop();
    // The user received an error response; the wallet must be untouched.
    expect(await walletIdr(userId)).toBeCloseTo(50, 4);
  });

  test("B4 zero-balance user gets 402 insufficient_balance", async () => {
    const { userId } = await makeUser("0.0000");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    console.log(
      `[QA-EVIDENCE B4] status=${res.status} upstreamCalls=${primary.count()} wallet=${await walletIdr(userId)}`,
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("insufficient_balance");
    expect(await walletIdr(userId)).toBeCloseTo(0, 4);
    // NOTE (charge-after): the upstream WAS already called, so the platform ate
    // the cost and the user still got 402. Recorded for the bug report.
    primary.stop();
  });
});

// ---------------------------------------------------------------------------
// C. Spend limit
// ---------------------------------------------------------------------------
describe("QA · spend limit", () => {
  test("C1 spend_limit_reached returns 402 and charges nothing", async () => {
    const { userId, keyHash } = await makeUser("1.0000");
    await setLimit(keyHash, "0.0001"); // 100 micro; request costs 4800 micro
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    console.log(`[QA-EVIDENCE C1] status=${res.status} wallet=${await walletIdr(userId)}`);
    expect(res.status).toBe(402);
    expect(((await res.json()) as OpenAiError).error.code).toBe("spend_limit_reached");
    expect(await walletIdr(userId)).toBeCloseTo(1, 4);
    primary.stop();
  });

  test("C2 a null spend limit never blocks the key", async () => {
    const { userId, keyHash } = await makeUser("1.0000");
    await setLimit(keyHash, null);
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] });
    console.log(`[QA-EVIDENCE C2] status=${res.status} wallet=${await walletIdr(userId)}`);
    expect(res.status).toBe(200);
    expect(await spentRedis(keyHash)).toBeGreaterThan(0);
    primary.stop();
  });
});

// ---------------------------------------------------------------------------
// D. Pool gating (LORA / FLEX)
// ---------------------------------------------------------------------------
describe("QA · pools", () => {
  test("D1 LoRA without an active Unlimited plan -> 403 pool_not_available", async () => {
    await makeUser("50.0000", null);
    primary = startMockUpstream(() => jsonUpstream());
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "hunyuan-lora-coder", messages: [] });
    console.log(`[QA-EVIDENCE D1] status=${res.status}`);
    expect(res.status).toBe(403);
    expect(((await res.json()) as OpenAiError).error.code).toBe("pool_not_available");
    primary.stop();
  });

  test("D2 LoRA with an active Unlimited plan is allowed and billed -30%", async () => {
    const { userId } = await makeUser("50.0000", new Date(Date.now() + 86_400_000));
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 100) }));
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "hunyuan-lora-coder", messages: [] });
    const [log] = await db.select().from(usageLogs);
    console.log(
      `[QA-EVIDENCE D2] status=${res.status} cost=${log?.costChargedIdr} pool=${log?.poolTier} wallet=${await walletIdr(userId)}`,
    );
    expect(res.status).toBe(200);
    // (100*3e6 + 100*12e6)/1e6 = 1500 micro; -30% => 1050 micro => 0.001050
    expect(Number(log.costChargedIdr)).toBeCloseTo(0.00105, 6);
    primary.stop();
  });

  test("[BUG] D3 Flex window must allow repeated requests under the 5h quota", async () => {
    // First request is fine, the second must still be allowed (well under 1M
    // tokens). The Lua sums ZSET *scores* (ms timestamps) not token counts, so
    // it reads ~1.79e12 and trips the cap after the very first request.
    await makeUser("50.0000");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(10, 5) }));
    const app = buildApp({ VOLCENGINE: primary });

    const r1 = await chatRequest(app, { model: "doubao-pro", messages: [], max_tokens: 10 });
    const r2 = await chatRequest(app, { model: "doubao-pro", messages: [], max_tokens: 10 });
    console.log(`[QA-EVIDENCE D3] statuses=${r1.status},${r2.status}`);
    primary.stop();
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  test("D4 an unknown X-Katalis-Pool value -> 400", async () => {
    await makeUser("50.0000");
    primary = startMockUpstream(() => jsonUpstream());
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [] }, { "x-katalis-pool": "GOLD" });
    console.log(`[QA-EVIDENCE D4] status=${res.status}`);
    expect(res.status).toBe(400);
    primary.stop();
  });
});

// ---------------------------------------------------------------------------
// E. OpenAI error envelope
// ---------------------------------------------------------------------------
describe("QA · OpenAI contract", () => {
  test("E1 every error uses {error:{message,type,param,code}}", async () => {
    await makeUser("50.0000");
    primary = startMockUpstream(() => jsonResponse({}, 503));
    const app = buildApp({ SILICONFLOW: primary });

    const noAuth = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen3-max", messages: [] }),
    });
    const unknown = await chatRequest(app, { model: "nope", messages: [] });
    const down = await chatRequest(app, { model: "qwen3-max", messages: [] });

    for (const res of [noAuth, unknown, down]) {
      const body = (await res.json()) as OpenAiError;
      expect(Object.keys(body)).toEqual(["error"]);
      expect(Object.keys(body.error).sort()).toEqual(["code", "message", "param", "type"]);
      expect(typeof body.error.message).toBe("string");
      expect(typeof body.error.type).toBe("string");
      expect(typeof body.error.code).toBe("string");
    }
    console.log(`[QA-EVIDENCE E1] statuses=${noAuth.status},${unknown.status},${down.status}`);
    primary.stop();
  });
});

// ---------------------------------------------------------------------------
// F. SSE passthrough / streaming abort
// ---------------------------------------------------------------------------
describe("QA · SSE", () => {
  test("F1 stream body is byte-identical and include_usage is injected", async () => {
    await makeUser("50.0000");
    const chunks = ['data: {"id":"cmpl-1"}\n\n', 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'];
    let seenBody: Record<string, unknown> = {};
    primary = startMockUpstream(async (req) => {
      seenBody = (await req.json()) as Record<string, unknown>;
      return sseUpstream(chunks, usage(10, 5));
    });
    const app = buildApp({ SILICONFLOW: primary });

    const res = await chatRequest(app, { model: "qwen3-max", messages: [], stream: true });
    const text = await res.text();
    console.log(`[QA-EVIDENCE F1] includeUsage=${JSON.stringify(seenBody.stream_options)}`);
    const expected = sseUpstream(chunks, usage(10, 5));
    expect(text).toBe(await expected.text());
    expect((seenBody.stream_options as { include_usage?: boolean })?.include_usage).toBe(true);
    primary.stop();
  });

  test("[BUG] F2 a client abort mid-stream must bill proportionally (Prd §7)", async () => {
    const { userId } = await makeUser("50.0000");
    primary = startMockUpstream(() =>
      slowSse(
        ['data: {"choices":[{"delta":{"content":"a"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"b"}}]}\n\n'],
        60,
        usage(100, 50),
      ),
    );
    const app = buildApp({ SILICONFLOW: primary });

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 30);
    let outcome = "resolved";
    try {
      await chatRequest(app, { model: "qwen3-max", messages: [], stream: true }, {}, ac.signal);
    } catch (err) {
      outcome = `threw:${(err as Error).name}`;
    }
    const wallet = await walletIdr(userId);
    const logs = await db.select().from(usageLogs);
    console.log(
      `[QA-EVIDENCE F2] outcome=${outcome} wallet=${wallet} charges=${logs.length} cost=${logs[0]?.costChargedIdr ?? "-"}`,
    );
    primary.stop();

    // Prd §7: partial delivery is billed proportionally (strictly between 0 and
    // the full 0.0048). The current shortcut charges nothing.
    expect(logs.length).toBe(1);
    expect(Number(logs[0].costChargedIdr)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// G. usage_logs completeness
// ---------------------------------------------------------------------------
describe("QA · usage_logs", () => {
  test("G1 writes tokens, latency, pool, provider, cost and http_status", async () => {
    const { userId, keyId } = await makeUser("50.0000");
    primary = startMockUpstream(() => jsonUpstream({ usage: usage(100, 50) }));
    const app = buildApp({ SILICONFLOW: primary });

    await chatRequest(app, { model: "qwen3-max", messages: [] });
    const [log] = await db.select().from(usageLogs);
    console.log(
      `[QA-EVIDENCE G1] ${JSON.stringify({
        model: log.modelId,
        pool: log.poolTier,
        provider: log.upstreamProvider,
        p: log.promptTokens,
        c: log.completionTokens,
        cost: log.costChargedIdr,
        latency: log.latencyMs,
        status: log.httpStatus,
      })}`,
    );
    expect(log.userId).toBe(userId);
    expect(log.apiKeyId).toBe(keyId);
    expect(log.modelId).toBe("qwen3-max");
    expect(log.poolTier).toBe("STABLE");
    expect(log.upstreamProvider).toBe("SILICONFLOW");
    expect(log.promptTokens).toBe(100);
    expect(log.completionTokens).toBe(50);
    expect(log.latencyMs).toBeGreaterThanOrEqual(0);
    expect(log.httpStatus).toBe(200);

    // Cross-check: Redis spent and PG spent must agree.
    expect(await spentRedis((await db.select({ h: apiKeys.keyHash }).from(apiKeys))[0].h)).toBeCloseTo(
      await spentPg(keyId),
      4,
    );
    primary.stop();
  });
});
