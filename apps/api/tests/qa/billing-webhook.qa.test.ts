/**
 * QA (independent, adversarial) — Batch 4 QRIS billing + webhook.
 *
 * Ownership: QA only. Does not import developer test files; re-implements its
 * own fixtures. Focus: financial truth (no leaked/duplicated credit), webhook
 * idempotency under REAL concurrency (developer tests run pool max:1, which
 * serialises transactions and can hide a missing SELECT ... FOR UPDATE),
 * signature edge cases, payload tampering, and the error contract.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { paymentInvoices, users } from "../../src/db/schema";
import { toIdr } from "../../src/db/money";
import { initWallet, getWalletMicro } from "../../src/services/token-meter";
import type { AppEnv } from "../../src/env";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "../helpers/db";
import { clearApiKeyCache } from "../helpers/redis";
import { cookieHeader } from "../helpers/http";
import { createFakeQrisProvider, QRIS_TEST_SECRET, signQrisBody } from "../helpers/qris";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

// max:1 mirrors the developer suite; max:6 is what actually exercises row
// contention (<-- this is the point of a QA suite).
const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const { client: concClient, db: concDb } = createDb(TEST_DB_URL, { max: 6 });
const redis = createRedis(TEST_REDIS_URL);

const env: AppEnv = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  NODE_ENV: "test",
  COOKIE_SECURE: false,
  CORS_ORIGINS: "http://localhost:5173",
  QRIS_PROVIDER: "TRIPAY",
  QRIS_WEBHOOK_SECRET: QRIS_TEST_SECRET,
};

const app = createApp({ db, redis, env, qris: createFakeQrisProvider() });
const concApp = createApp({ db: concDb, redis, env, qris: createFakeQrisProvider() });

async function register(email: string, password = "password123") {
  const res = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(201);
}

async function login(email: string, password = "password123"): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  return cookieHeader(res.headers, "katalis_session") ?? "";
}

async function authed(
  target: ReturnType<typeof createApp>,
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
) {
  return target.request(path, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function makeUser(balance = "0.0000"): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      email: `qa-${Math.random().toString(16).slice(2)}@example.com`,
      walletBalanceIdr: balance,
    })
    .returning({ id: users.id });
  return row.id;
}

async function insertInvoice(vals: {
  id?: string;
  userId: string;
  planType?: string;
  baseAmountIdr?: number;
  bonusAmountIdr?: number;
  totalPayIdr?: number;
  providerRef?: string;
  status?: string;
}) {
  const [row] = await db
    .insert(paymentInvoices)
    .values({
      id: vals.id ?? `INV-${Math.random().toString(16).slice(2)}`,
      userId: vals.userId,
      planType: vals.planType ?? "PREPAID",
      baseAmountIdr: vals.baseAmountIdr ?? 50000,
      bonusAmountIdr: vals.bonusAmountIdr ?? 0,
      totalPayIdr: vals.totalPayIdr ?? 50000,
      qrisString: "qr://fake",
      providerRef: vals.providerRef ?? `REF-${Math.random().toString(16).slice(2)}`,
      status: vals.status ?? "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    })
    .returning({ id: paymentInvoices.id, providerRef: paymentInvoices.providerRef });
  return row;
}

async function getUserBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId));
  return toIdr(row?.walletBalanceIdr ?? "0");
}

async function getInvoiceByRef(providerRef: string) {
  const [row] = await db
    .select()
    .from(paymentInvoices)
    .where(eq(paymentInvoices.providerRef, providerRef));
  return row;
}

async function getUserUnlimited(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ unlimitedExpiresAt: users.unlimitedExpiresAt })
    .from(users)
    .where(eq(users.id, userId));
  return row?.unlimitedExpiresAt ?? null;
}

async function getUserTrial(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ hasClaimedTrial: users.hasClaimedTrial })
    .from(users)
    .where(eq(users.id, userId));
  return row?.hasClaimedTrial ?? false;
}

type WebhookOpts = { sig?: string | null; contentType?: string };

async function webhook(
  target: ReturnType<typeof createApp>,
  body: string | Record<string, unknown>,
  opts: WebhookOpts = {},
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": opts.contentType ?? "application/json",
  };
  const sig = opts.sig === undefined ? signQrisBody(raw) : opts.sig;
  if (sig !== null) headers["x-tripay-signature"] = sig;
  return target.request("/api/webhooks/qris", { method: "POST", headers, body: raw });
}

function paidBody(providerRef: string, extra: Record<string, unknown> = {}) {
  return { provider_ref: providerRef, status: "PAID", ...extra };
}

beforeAll(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
});

afterAll(async () => {
  await clearApiKeyCache(redis);
  await redis.quit();
  await closeDb(dbClient);
  await closeDb(concClient);
});

beforeEach(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
  for (const key of await redis.keys("wallet:*")) await redis.del(key);
});

// ---------------------------------------------------------------------------
// 1. Webhook idempotency (financial truth)
// ---------------------------------------------------------------------------
describe("QA webhook idempotency", () => {
  test("sequential duplicate PAID credits exactly once and keeps invoice PAID", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 40000,
      bonusAmountIdr: 10000,
      totalPayIdr: 40000,
    });

    const first = await webhook(app, paidBody(providerRef));
    const second = await webhook(app, paidBody(providerRef));
    const third = await webhook(app, paidBody(providerRef));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(await third.json()).toEqual({ ok: true, duplicate: true });

    expect(await getUserBalance(userId)).toBe(50000); // exactly base+bonus once
    expect((await getInvoiceByRef(providerRef)).status).toBe("PAID");
  });

  test("REAL concurrency (pool max:6): 6 parallel PAID credit exactly once", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
    });

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => webhook(concApp, paidBody(providerRef))),
    );
    const bodies = (await Promise.all(responses.map((r) => r.json()))) as Array<{
      ok: boolean;
      duplicate?: boolean;
    }>;
    for (const r of responses) expect(r.status).toBe(200);

    const credited = bodies.filter((b) => b.ok === true && !("duplicate" in b));
    expect(credited).toHaveLength(1); // exactly one winner, five duplicates
    expect(await getUserBalance(userId)).toBe(50000); // no double credit
    expect((await getInvoiceByRef(providerRef)).status).toBe("PAID");
  });

  test("redirect/no session: webhook needs no auth but a valid signature only", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    const res = await webhook(app, paidBody(providerRef));
    expect(res.status).toBe(200);
    expect(await getUserBalance(userId)).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// 2. HMAC signature edge cases
// ---------------------------------------------------------------------------
describe("QA webhook signature", () => {
  test("wrong-but-32-byte signature -> 403, no credit, invoice stays PENDING", async () => {
    const userId = await makeUser("1000.0000");
    const { providerRef } = await insertInvoice({ userId, totalPayIdr: 50000 });
    const res = await webhook(app, paidBody(providerRef), { sig: "00".repeat(32) });
    expect(res.status).toBe(403);
    expect(((await res.json()) as OpenAiError).error).toMatchObject({
      message: expect.any(String),
      type: "authentication_error",
      code: "INVALID_SIGNATURE",
    });
    expect(await getUserBalance(userId)).toBe(1000);
    expect((await getInvoiceByRef(providerRef)).status).toBe("PENDING");
  });

  test("short / odd-length / non-hex signature -> 403 without throwing (400/500 check)", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    for (const sig of ["abcd", "abc", "zzzz", "", "0f".repeat(31)]) {
      const res = await webhook(app, paidBody(providerRef), { sig });
      expect(res.status).toBe(403);
      expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_SIGNATURE");
    }
    expect(await getUserBalance(userId)).toBe(0);
    expect((await getInvoiceByRef(providerRef)).status).toBe("PENDING");
  });

  test("missing signature header -> 403", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    const res = await webhook(app, paidBody(providerRef), { sig: null });
    expect(res.status).toBe(403);
    expect(await getUserBalance(userId)).toBe(0);
  });

  test("tampered body (signature valid for the ORIGINAL body) -> 403", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    const original = JSON.stringify({ provider_ref: providerRef, status: "PAID" });
    const sigOfOriginal = signQrisBody(original);
    const tampered = JSON.stringify({ provider_ref: providerRef, status: "PAID", x: 1 });
    const res = await webhook(app, tampered, { sig: sigOfOriginal });
    expect(res.status).toBe(403);
    expect(await getUserBalance(userId)).toBe(0);
  });

  test("signature case-insensitive hex is accepted (uppercase digest)", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    const raw = JSON.stringify(paidBody(providerRef));
    const res = await webhook(app, raw, { sig: signQrisBody(raw).toUpperCase() });
    expect(res.status).toBe(200);
    expect(await getUserBalance(userId)).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// 3. Payload nominal is NOT trusted
// ---------------------------------------------------------------------------
describe("QA payload tampering", () => {
  test("webhook nominal fields in payload are ignored; credit follows the DB row", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
    });
    const res = await webhook(
      app,
      paidBody(providerRef, {
        amount_idr: 1_000_000_000,
        total_pay_idr: 1,
        base_amount_idr: 999999,
        bonus_amount_idr: 999999,
        wallet_balance_idr: 999999,
      }),
    );
    expect(res.status).toBe(200);
    expect(await getUserBalance(userId)).toBe(50000); // row, not payload
  });

  test("provider_ref with illegal chars -> 400 INVALID_PAYLOAD, no credit", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId });
    const res = await webhook(app, paidBody("../../etc/passwd"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PAYLOAD");
    expect(await getUserBalance(userId)).toBe(0);
    expect((await getInvoiceByRef(providerRef)).status).toBe("PENDING");
  });

  test("unknown provider_ref -> 404 INVOICE_NOT_FOUND", async () => {
    const res = await webhook(app, paidBody("NOPE-REF-123"));
    expect(res.status).toBe(404);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVOICE_NOT_FOUND");
  });

  test("valid signature but non-JSON body -> 400 INVALID_PAYLOAD", async () => {
    const res = await webhook(app, "not-json", { sig: signQrisBody("not-json") });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PAYLOAD");
  });

  test("valid signature, JSON missing status -> 400 INVALID_PAYLOAD", async () => {
    const res = await webhook(app, { provider_ref: "X" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PAYLOAD");
  });

  test("valid signature, array body -> 400 INVALID_PAYLOAD", async () => {
    const res = await webhook(app, "[]");
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PAYLOAD");
  });
});

// ---------------------------------------------------------------------------
// 4. Per-plan credit semantics
// ---------------------------------------------------------------------------
describe("QA per-plan credit", () => {
  test("PREPAID credits base+bonus into wallet and invalidates the Redis cache", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 30000,
      bonusAmountIdr: 5000,
      totalPayIdr: 30000,
    });
    await redis.set(`wallet:${userId}`, "0.0000");

    await webhook(app, paidBody(providerRef));

    expect(await getUserBalance(userId)).toBe(35000);
    expect(await redis.exists(`wallet:${userId}`)).toBe(0);
  });

  test("UNLIMITED_10D does NOT change wallet, GREATER-extends an existing future expiry", async () => {
    const userId = await makeUser("12345.0000");
    const future = new Date(Date.now() + 5 * 86_400_000);
    await db.update(users).set({ unlimitedExpiresAt: future }).where(eq(users.id, userId));
    const { providerRef } = await insertInvoice({
      userId,
      planType: "UNLIMITED_10D",
      baseAmountIdr: 20000,
      totalPayIdr: 20000,
    });

    await webhook(app, paidBody(providerRef));

    const expiry = await getUserUnlimited(userId);
    expect(await getUserBalance(userId)).toBe(12345); // untouched
    const days = (expiry!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(14.9); // now+5d THEN +10d = now+15d
    expect(days).toBeLessThanOrEqual(15.01);
  });

  test("TRIAL_1D (paid via webhook) extends unlimited by ~1 day, wallet untouched", async () => {
    const userId = await makeUser("777.0000");
    const { providerRef } = await insertInvoice({
      userId,
      planType: "TRIAL_1D",
      baseAmountIdr: 100,
      totalPayIdr: 100,
    });
    await webhook(app, paidBody(providerRef));
    const expiry = await getUserUnlimited(userId);
    const days = (expiry!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(0.9);
    expect(days).toBeLessThanOrEqual(1.01);
    expect(await getUserBalance(userId)).toBe(777);
  });

  test("non-PAID event (EXPIRED/FAILED) never credits and records the terminal status", async () => {
    for (const status of ["EXPIRED", "FAILED"]) {
      const userId = await makeUser("500.0000");
      const { providerRef } = await insertInvoice({ userId, totalPayIdr: 50000 });
      const res = await webhook(app, { provider_ref: providerRef, status });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(await getUserBalance(userId)).toBe(500);
      const inv = await getInvoiceByRef(providerRef);
      expect(inv.status).toBe(status);
      expect(inv.paidAt).toBeNull();
    }
  });

  test("late PAID after EXPIRED settles once (documents current semantics)", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({ userId, totalPayIdr: 50000 });
    await webhook(app, { provider_ref: providerRef, status: "EXPIRED" });
    expect(await getUserBalance(userId)).toBe(0);

    const late = await webhook(app, paidBody(providerRef));
    expect(late.status).toBe(200);
    expect(await getUserBalance(userId)).toBe(50000);
    const again = await webhook(app, paidBody(providerRef));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(await getUserBalance(userId)).toBe(50000); // still once
  });

  test("unknown plan_type on the DB row: PAID marks it PAID but credits nothing (audit edge)", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      planType: "GOLD_999",
      totalPayIdr: 50000,
    });
    const res = await webhook(app, paidBody(providerRef));
    expect(res.status).toBe(200);
    expect(await getUserBalance(userId)).toBe(0);
    expect((await getInvoiceByRef(providerRef)).status).toBe("PAID");
  });
});

// ---------------------------------------------------------------------------
// 5. Redis wallet consistency with Batch 3 (re-seed from PG after DEL)
// ---------------------------------------------------------------------------
describe("QA redis wallet invalidation", () => {
  test("after credit the next proxy seed reproduces the PG balance, not a stale cache", async () => {
    const userId = await makeUser();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
    });
    await redis.set(`wallet:${userId}`, "0.0000"); // stale pre-credit cache

    await webhook(app, paidBody(providerRef));
    expect(await redis.exists(`wallet:${userId}`)).toBe(0);

    // mimic v1-proxy: read PG then lazy NX-seed
    const [row] = await db
      .select({ walletBalanceIdr: users.walletBalanceIdr })
      .from(users)
      .where(eq(users.id, userId));
    await initWallet(redis, userId, row.walletBalanceIdr);
    expect(await getWalletMicro(redis, userId)).toBe(50_000_000_000); // 50000 IDR
    expect(await redis.get(`wallet:${userId}`)).toBe("50000.0000");
  });
});

// ---------------------------------------------------------------------------
// 6. Billing create route (auth, validation, trial, gateway failure)
// ---------------------------------------------------------------------------
describe("QA POST /api/billing/invoices", () => {
  test("requires a session (401 without cookie, no invoice created)", async () => {
    const res = await app.request("/api/billing/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan_type: "PREPAID", custom_amount_idr: 50000 }),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as OpenAiError).error.code).toBe("UNAUTHENTICATED");
  });

  test("PREPAID boundary values 5000 and 1000000 are accepted; 4999/1000001 rejected", async () => {
    await register("qa-range@example.com");
    const cookie = await login("qa-range@example.com");
    for (const amount of [5000, 1_000_000]) {
      const res = await authed(app, cookie, "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: amount,
      });
      expect(res.status).toBe(201);
      expect(((await res.json()) as { total_pay_idr: number }).total_pay_idr).toBe(amount);
    }
    for (const amount of [0, 4999, 1_000_001, -1, 5000.5]) {
      const res = await authed(app, cookie, "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: amount,
      });
      expect(res.status).toBe(400);
    }
  });

  test("PREPAID without custom_amount_idr -> 400 VALIDATION_ERROR (0 is out of range)", async () => {
    await register("qa-nomissing@example.com");
    const cookie = await login("qa-nomissing@example.com");
    const res = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.type).toBe("validation_error");
  });

  test("UNLIMITED_10D is a fixed 20000 and works without a custom amount", async () => {
    await register("qa-unl@example.com");
    const cookie = await login("qa-unl@example.com");
    const res = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "UNLIMITED_10D",
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { total_pay_idr: number }).total_pay_idr).toBe(20000);
  });

  test("trial: first claim 201, second 400 TRIAL_ALREADY_CLAIMED", async () => {
    await register("qa-trial@example.com");
    const cookie = await login("qa-trial@example.com");
    const first = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(first.status).toBe(201);
    const second = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(second.status).toBe(400);
    expect(((await second.json()) as OpenAiError).error.code).toBe("TRIAL_ALREADY_CLAIMED");
  });

  test("trial concurrency (pool max:6): parallel claims yield exactly one 201", async () => {
    await register("qa-trialrace@example.com");
    const cookie = await login("qa-trialrace@example.com");
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        authed(app, cookie, "POST", "/api/billing/invoices", { plan_type: "TRIAL_1D" }),
      ),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(4);
  });

  test("gateway failure on trial -> 502 PAYMENT_GATEWAY_ERROR, claim reverted, retry works", async () => {
    await register("qa-revert@example.com");
    const cookie = await login("qa-revert@example.com");
    const failing = createApp({
      db,
      redis,
      env,
      qris: createFakeQrisProvider({ failCreate: true }),
    });
    const res = await authed(failing, cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as OpenAiError).error.code).toBe("PAYMENT_GATEWAY_ERROR");

    const [u] = await db.select().from(users).where(eq(users.email, "qa-revert@example.com"));
    expect(u.hasClaimedTrial).toBe(false);

    const retry = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(retry.status).toBe(201);
  });

  test("gateway unconfigured (provider null) -> 502 PAYMENT_GATEWAY_ERROR", async () => {
    await register("qa-noprov@example.com");
    const cookie = await login("qa-noprov@example.com");
    const noProvider = createApp({ db, redis, env, qris: null });
    const res = await authed(noProvider, cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 50000,
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as OpenAiError).error.code).toBe("PAYMENT_GATEWAY_ERROR");
  });

  test("invalid body shapes -> 400 VALIDATION_ERROR (non-JSON/null/array/missing plan)", async () => {
    await register("qa-body@example.com");
    const cookie = await login("qa-body@example.com");
    const cases: Array<string | Record<string, unknown>> = [
      "not-json",
      "null",
      "[]",
      "{}",
      { plan_type: 123 },
      { plan_type: "" },
      { custom_amount_idr: 50000 },
    ];
    for (const body of cases) {
      const raw = typeof body === "string" ? body : JSON.stringify(body);
      const res = await app.request("/api/billing/invoices", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: raw,
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("unknown coupon -> 400; empty coupon is tolerated", async () => {
    await register("qa-coupon@example.com");
    const cookie = await login("qa-coupon@example.com");
    const bad = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 50000,
      coupon_code: "FREEBIE",
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");

    const emptyOk = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 50000,
      coupon_code: "",
    });
    expect(emptyOk.status).toBe(201);
  });

  test("invoice id format is INV-KTL-<yyyymmdd>-<5 base58>", async () => {
    await register("qa-id@example.com");
    const cookie = await login("qa-id@example.com");
    const res = await authed(app, cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 50000,
    });
    const body = (await res.json()) as { id: string };
    expect(/^INV-KTL-\d{8}-[1-9A-HJ-NP-Za-km-z]{5}$/.test(body.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Billing status route (ownership + error contract)
// ---------------------------------------------------------------------------
describe("QA GET /api/billing/invoices/:id/status", () => {
  test("owner sees their own invoice", async () => {
    await register("qa-own@example.com");
    const cookie = await login("qa-own@example.com");
    const created = (await (
      await authed(app, cookie, "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: 50000,
      })
    ).json()) as { id: string };
    const res = await authed(app, cookie, "GET", `/api/billing/invoices/${created.id}/status`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(created.id);
  });

  test("non-owner gets a uniform 404 (not 403/200)", async () => {
    await register("qa-a@example.com");
    await register("qa-b@example.com");
    const cookieA = await login("qa-a@example.com");
    const cookieB = await login("qa-b@example.com");
    const created = (await (
      await authed(app, cookieA, "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: 50000,
      })
    ).json()) as { id: string };
    const res = await authed(app, cookieB, "GET", `/api/billing/invoices/${created.id}/status`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVOICE_NOT_FOUND");
  });

  test("unknown / malformed id -> 404 INVOICE_NOT_FOUND (not 500)", async () => {
    await register("qa-404@example.com");
    const cookie = await login("qa-404@example.com");
    for (const id of ["INV-KTL-19700101-AAAAA", "not-a-uuid", "%20%20", "x".repeat(80)]) {
      const res = await authed(app, cookie, "GET", `/api/billing/invoices/${id}/status`);
      expect(res.status).toBe(404);
      expect(((await res.json()) as OpenAiError).error.code).toBe("INVOICE_NOT_FOUND");
    }
  });

  test("status requires a session (401 without cookie)", async () => {
    const res = await app.request("/api/billing/invoices/INV-KTL-19700101-AAAAA/status");
    expect(res.status).toBe(401);
    expect(((await res.json()) as OpenAiError).error.code).toBe("UNAUTHENTICATED");
  });
});
