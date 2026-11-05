// Production-gate automation (Implementation Plan.md §4).
//
// Each describe block automates one offline-checkable gate item:
//   1. OpenAI SDK wire compatibility (Python + Node SDK byte shape / error shape).
//   2. Upstream failover with zero charge on total upstream failure.
//   3. QRIS webhook HMAC signature rejection (no forged credit).
//   4. Catalog contract drift guard (/v1/models vs /api/models vs MODEL_CATALOG).
//
// The gates that need a real network/SDK/device live in scripts/prod-gate/README.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Hono } from "hono";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, paymentInvoices, usageLogs, users } from "../src/db/schema";
import { toIdr } from "../src/db/money";
import { MODEL_CATALOG } from "../src/services/model-catalog";
import { createQrisProvider } from "../src/services/qris-provider";
import { invalidateApiKeyCache } from "../src/services/key.service";
import type { AppEnv } from "../src/env";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import { QRIS_TEST_SECRET, signQrisBody } from "./helpers/qris";
import {
  startMockUpstream,
  jsonUpstream,
  jsonResponse,
  type MockUpstream,
} from "./helpers/upstream-mock";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

// sk-ktl- + exactly 32 base58 chars (parseApiKey rejects any other length).
const RAW_KEY = "sk-ktl-3nQ8xV7pL2wR5tY9hK4mB6cD1fG8jZ3s";

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
  QRIS_PROVIDER: "TRIPAY",
  QRIS_WEBHOOK_SECRET: QRIS_TEST_SECRET,
};

let primary: MockUpstream | undefined;
let secondary: MockUpstream | undefined;

function buildApp(): Hono {
  return createApp({
    db,
    redis,
    env,
    qris: createQrisProvider(env),
    upstream: {
      providers: {
        SILICONFLOW: primary ? { id: "SILICONFLOW", baseUrl: primary.url } : undefined,
        VOLCENGINE: secondary ? { id: "VOLCENGINE", baseUrl: secondary.url } : undefined,
        DEEPSEEK: primary ? { id: "DEEPSEEK", baseUrl: primary.url } : undefined,
      },
      firstByteTimeoutMs: 3000,
      fetchImpl: fetch,
    },
  });
}

async function makeUserWithKey(balanceIdr = "50.0000"): Promise<{
  userId: string;
  keyId: string;
  keyHash: string;
}> {
  const [uRow] = await db
    .insert(users)
    .values({
      email: `gate-${Math.random().toString(16).slice(2)}@example.com`,
      walletBalanceIdr: balanceIdr,
    })
    .returning({ id: users.id });
  const keyHash = createHash("sha256").update(RAW_KEY).digest("hex");
  const [kRow] = await db
    .insert(apiKeys)
    .values({
      userId: uRow.id,
      name: "gate",
      keyPrefix: RAW_KEY.slice(0, 16),
      keyHash,
    })
    .returning({ id: apiKeys.id });
  await invalidateApiKeyCache(redis, keyHash);
  return { userId: uRow.id, keyId: kRow.id, keyHash };
}

async function pgBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId));
  return toIdr(row?.walletBalanceIdr ?? "0");
}

async function chatRequest(
  app: Hono,
  body: unknown,
  key: string = RAW_KEY,
): Promise<Response> {
  return await app.request("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
});

afterAll(async () => {
  primary?.stop();
  secondary?.stop();
  await clearApiKeyCache(redis);
  await redis.quit();
  await closeDb(dbClient);
});

beforeEach(async () => {
  primary?.stop();
  secondary?.stop();
  primary = undefined;
  secondary = undefined;
  await resetDb(db);
  await clearApiKeyCache(redis);
  for (const key of await redis.keys("wallet:*")) await redis.del(key);
  for (const key of await redis.keys("flex:*")) await redis.del(key);
});

// ---------------------------------------------------------------------------
// Gate 1 — OpenAI SDK compatibility
// ---------------------------------------------------------------------------
describe("Gate 1: OpenAI SDK wire compatibility", () => {
  // The exact bytes `openai` (Node) / `openai` (Python) put on the wire for
  // client.chat.completions.create({ model, messages, temperature, max_tokens }):
  // POST {base}/chat/completions, JSON, Authorization: Bearer, and NO extra
  // fields the gateway could choke on.
  const sdkBody = {
    model: "qwen3-max",
    messages: [{ role: "user", content: "Halo, siapa kamu?" }],
    temperature: 0.7,
    max_tokens: 256,
  };

  test("accepts the SDK request shape and answers a chat.completion", async () => {
    await makeUserWithKey();
    primary = startMockUpstream(() =>
      jsonUpstream({
        chunks: ["Halo! Saya asisten Katalis."],
        usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
      }),
    );
    const app = buildApp();

    const res = await chatRequest(app, sdkBody);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      object?: unknown;
      choices?: Array<{
        index?: number;
        message?: { role?: unknown; content?: unknown };
        finish_reason?: unknown;
      }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };

    // OpenAI `ChatCompletion` pydantic model / zod schema requires exactly this.
    expect(body.object).toBe("chat.completion");
    expect(Array.isArray(body.choices)).toBe(true);
    expect(body.choices).toHaveLength(1);
    expect(body.choices?.[0]?.message?.role).toBe("assistant");
    expect(body.choices?.[0]?.message?.content).toBe("Halo! Saya asisten Katalis.");
    expect(typeof body.usage?.prompt_tokens).toBe("number");
    expect(typeof body.usage?.completion_tokens).toBe("number");
  });

  test("401 carries the exact error envelope both SDKs parse into AuthenticationError", async () => {
    const app = buildApp();
    const res = await chatRequest(app, sdkBody, "sk-ktl-totally-invalid-key-0000000000");
    expect(res.status).toBe(401);

    const body = (await res.json()) as OpenAiError;
    // Node SDK: `body.type === 'authentication_error'` -> AuthenticationError.
    // Python SDK: same discriminator, `err.code === 'invalid_api_key'`.
    expect(body.error.type).toBe("authentication_error");
    expect(body.error.code).toBe("invalid_api_key");
    expect(typeof body.error.message).toBe("string");
    expect("param" in body.error).toBe(true);
    // No sibling keys: the SDKs reject shapes where `error` is not the only root key.
    expect(Object.keys(body)).toEqual(["error"]);
  });

  test("GET /v1/models returns the OpenAI ModelList shape", async () => {
    await makeUserWithKey();
    const app = buildApp();
    const res = await app.request("/v1/models", {
      headers: { authorization: `Bearer ${RAW_KEY}` },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      object?: unknown;
      data?: Array<{
        id?: unknown;
        object?: unknown;
        created?: unknown;
        owned_by?: unknown;
      }>;
    };
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data ?? []).length).toBeGreaterThan(0);
    for (const model of body.data ?? []) {
      expect(typeof model.id).toBe("string");
      expect(model.object).toBe("model");
      expect(typeof model.created).toBe("number");
      expect(typeof model.owned_by).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 2 — upstream failover + zero charge
// ---------------------------------------------------------------------------
describe("Gate 2: upstream failover charges only the successful call", () => {
  test("primary 503 -> secondary 200: succeeds, bills the SECONDARY provider", async () => {
    const { userId, keyHash } = await makeUserWithKey("50.0000");
    // qwen3-max route order: SILICONFLOW primary, VOLCENGINE secondary.
    primary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    secondary = startMockUpstream(() =>
      jsonUpstream({ usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }),
    );
    const app = buildApp();

    const res = await chatRequest(app, {
      model: "qwen3-max",
      messages: [{ role: "user", content: "ping" }],
    });
    expect(res.status).toBe(200);
    // Both routes were attempted: the failing primary, then the failover.
    expect(primary?.count()).toBe(1);
    expect(secondary?.count()).toBe(1);

    // Exactly one usage row, attributed to the provider that actually answered.
    const rows = await db.select().from(usageLogs);
    expect(rows).toHaveLength(1);
    expect(rows[0].upstreamProvider).toBe("VOLCENGINE");

    // qwen3-max: in 16, out 64 IDR / 1M tokens.
    // cost = round((100*16_000_000 + 50*64_000_000) / 1_000_000) micro = 4800 micro.
    expect(rows[0].costChargedIdr).toBe("0.004800");
    expect(rows[0].promptTokens).toBe(100);
    expect(rows[0].completionTokens).toBe(50);

    // Exactly one debit: 50.0000 - 0.0048 = 49.9952 IDR.
    expect(Number(await redis.get(`wallet:${userId}`))).toBeCloseTo(49.9952, 4);
    expect(Number(await redis.hget(`apikey:${keyHash}`, "spent_idr"))).toBeCloseTo(0.0048, 4);
  });

  test("both upstreams 503 -> 502 OpenAI envelope, Rp 0 charged, no usage row", async () => {
    const { userId, keyHash } = await makeUserWithKey("50.0000");
    primary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    secondary = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    const app = buildApp();

    await redis.set(`wallet:${userId}`, "50.0000");

    const res = await chatRequest(app, {
      model: "qwen3-max",
      messages: [{ role: "user", content: "ping" }],
    });
    expect(res.status).toBe(502);

    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("upstream_error");
    expect(body.error.type).toBe("api_error");
    expect(Object.keys(body)).toEqual(["error"]);

    // Both routes were actually attempted (failover, not a short circuit).
    expect(primary?.count()).toBe(1);
    expect(secondary?.count()).toBe(1);

    // Zero charge: no usage_logs row; wallet + spend counter untouched in Redis AND PG.
    expect(await db.select().from(usageLogs)).toHaveLength(0);
    expect(await redis.get(`wallet:${userId}`)).toBe("50.0000");
    expect(await pgBalance(userId)).toBe(50);
    // The key cache row may exist (auth populates it) but its spend counter is 0.
    const cachedSpend = await redis.hget(`apikey:${keyHash}`, "spent_idr");
    expect(cachedSpend === null || Number(cachedSpend) === 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gate 3 — QRIS webhook signature rejection
// ---------------------------------------------------------------------------
describe("Gate 3: /api/webhooks/qris rejects requests without a valid HMAC", () => {
  async function seedPendingInvoice(): Promise<{ userId: string; providerRef: string }> {
    const { userId } = await makeUserWithKey("0.0000");
    await redis.set(`wallet:${userId}`, "0.0000");
    const providerRef = `GATE-${Math.random().toString(16).slice(2)}`;
    await db.insert(paymentInvoices).values({
      id: `INV-${Math.random().toString(16).slice(2)}`,
      userId,
      planType: "PREPAID",
      baseAmountIdr: 50_000,
      bonusAmountIdr: 0,
      totalPayIdr: 50_000,
      qrisString: "qr://tripay/gate",
      providerRef,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return { userId, providerRef };
  }

  async function invoiceStatus(providerRef: string): Promise<string | undefined> {
    const [row] = await db
      .select({ status: paymentInvoices.status })
      .from(paymentInvoices)
      .where(eq(paymentInvoices.providerRef, providerRef));
    return row?.status;
  }

  test("missing X-Tripay-Signature header -> 403, invoice PENDING, no credit", async () => {
    const app = buildApp();
    const { userId, providerRef } = await seedPendingInvoice();
    const raw = JSON.stringify({ provider_ref: providerRef, status: "PAID" });

    const res = await app.request("/api/webhooks/qris", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("INVALID_SIGNATURE");
    expect(body.error.type).toBe("authentication_error");

    expect(await invoiceStatus(providerRef)).toBe("PENDING");
    expect(await pgBalance(userId)).toBe(0);
    expect(await redis.get(`wallet:${userId}`)).toBe("0.0000");
  });

  test("wrong X-Tripay-Signature value -> 403, invoice PENDING, no credit", async () => {
    const app = buildApp();
    const { userId, providerRef } = await seedPendingInvoice();
    const raw = JSON.stringify({ provider_ref: providerRef, status: "PAID" });

    // Correctly-shaped (64 hex) but computed with a DIFFERENT secret.
    const forged = createHash("sha256").update("forged-secret").digest("hex");
    const res = await app.request("/api/webhooks/qris", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tripay-signature": forged },
      body: raw,
    });

    expect(res.status).toBe(403);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_SIGNATURE");
    expect(await invoiceStatus(providerRef)).toBe("PENDING");
    expect(await pgBalance(userId)).toBe(0);
  });

  test("control: the correctly signed body settles and credits (proves the 403s are signature-driven)", async () => {
    const app = buildApp();
    const { userId, providerRef } = await seedPendingInvoice();
    const raw = JSON.stringify({ provider_ref: providerRef, status: "PAID" });

    const res = await app.request("/api/webhooks/qris", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tripay-signature": signQrisBody(raw),
      },
      body: raw,
    });

    expect(res.status).toBe(200);
    expect(await invoiceStatus(providerRef)).toBe("PAID");
    expect(await pgBalance(userId)).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// Gate 4 — catalog contract drift guard
// ---------------------------------------------------------------------------
describe("Gate 4: catalog contract has no drift between endpoints and the source", () => {
  type V1Model = { id: string; object: string; created: number; owned_by: string };
  type ApiModel = {
    id: string;
    name: string;
    provider: string;
    pool: string;
    owned_by: string;
    price_in_idr_per_1m: number;
    price_out_idr_per_1m: number;
    capabilities: string[];
  };

  async function fetchCatalogs(): Promise<{ v1: V1Model[]; ui: ApiModel[] }> {
    const app = buildApp();
    await makeUserWithKey();
    const v1Res = await app.request("/v1/models", {
      headers: { authorization: `Bearer ${RAW_KEY}` },
    });
    expect(v1Res.status).toBe(200);
    const uiRes = await app.request("/api/models");
    expect(uiRes.status).toBe(200);
    const v1 = ((await v1Res.json()) as { data: V1Model[] }).data;
    const ui = ((await uiRes.json()) as { data: ApiModel[] }).data;
    return { v1, ui };
  }

  test("every served id exists in MODEL_CATALOG and both endpoints expose the same id set", async () => {
    const { v1, ui } = await fetchCatalogs();
    const catalogIds = new Set(MODEL_CATALOG.map((model) => model.id));

    expect(v1.length).toBe(MODEL_CATALOG.length);
    for (const model of v1) expect(catalogIds.has(model.id)).toBe(true);
    for (const model of ui) expect(catalogIds.has(model.id)).toBe(true);

    // Same set, same order: the UI table and SDK model list cannot diverge.
    expect(v1.map((m) => m.id)).toEqual(MODEL_CATALOG.map((m) => m.id));
    expect(ui.map((m) => m.id)).toEqual(v1.map((m) => m.id));
    expect(new Set(v1.map((m) => m.id))).toEqual(new Set(ui.map((m) => m.id)));
  });

  test("prices agree between /api/models and MODEL_CATALOG (IDR per 1M tokens)", async () => {
    const { ui } = await fetchCatalogs();
    const byId = new Map(ui.map((m) => [m.id, m]));

    for (const spec of MODEL_CATALOG) {
      const row = byId.get(spec.id);
      expect(row, `missing UI row for ${spec.id}`).toBeTruthy();
      expect(row?.price_in_idr_per_1m).toBe(spec.priceInMicroPer1M / 1_000_000);
      expect(row?.price_out_idr_per_1m).toBe(spec.priceOutMicroPer1M / 1_000_000);
      expect(row?.pool).toBe(spec.defaultPool);
      expect(row?.owned_by).toBe(spec.ownedBy);
      expect(row?.name).toBe(spec.name);
      expect(row?.provider).toBe(spec.provider);
    }
  });
});
