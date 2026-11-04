import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, paymentInvoices, users } from "../src/db/schema";
import { toIdr } from "../src/db/money";
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
import {
  createFakeQrisProvider,
  QRIS_TEST_SECRET,
  signQrisBody,
  signedJson,
} from "./helpers/qris";

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
  QRIS_PROVIDER: "TRIPAY",
  QRIS_WEBHOOK_SECRET: QRIS_TEST_SECRET,
};

function buildApp() {
  return createApp({ db, redis, env, qris: createFakeQrisProvider() });
}

const app = buildApp();

async function makeUser(balance = "0.0000"): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ email: `q-${Math.random().toString(16).slice(2)}@example.com`, walletBalanceIdr: balance })
    .returning({ id: users.id });
  return row.id;
}

async function makeUserWithKey(balance = "0.0000"): Promise<string> {
  const userId = await makeUser(balance);
  const [key] = await db
    .insert(apiKeys)
    .values({ userId, name: "key", keyPrefix: "sk-ktl-12345678", keyHash: "deadbeef" })
    .returning({ keyHash: apiKeys.keyHash });
  await invalidateApiKeyCache(redis, key.keyHash);
  return userId;
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
  qrisString?: string;
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
      qrisString: vals.qrisString ?? "qr://fake",
      providerRef: vals.providerRef ?? `REF-${Math.random().toString(16).slice(2)}`,
      status: vals.status ?? "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    })
    .returning({ providerRef: paymentInvoices.providerRef, id: paymentInvoices.id });
  return row;
}

async function getInvoiceByProviderRef(providerRef: string) {
  const [row] = await db
    .select()
    .from(paymentInvoices)
    .where(eq(paymentInvoices.providerRef, providerRef));
  return row;
}

async function getUserBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId));
  return toIdr(row?.walletBalanceIdr ?? "0");
}

async function getUserTrial(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ hasClaimedTrial: users.hasClaimedTrial })
    .from(users)
    .where(eq(users.id, userId));
  return row?.hasClaimedTrial ?? false;
}

async function sendWebhook(providerRef: string, status = "PAID") {
  const signed = signedJson({ provider_ref: providerRef, status });
  return app.request("/api/webhooks/qris", {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
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
});

describe("POST /api/webhooks/qris", () => {
  test("valid PAID webhook settles a PENDING invoice and credits PREPAID wallet", async () => {
    const userId = await makeUserWithKey();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 10000,
      totalPayIdr: 50000,
    });

    await redis.set(`wallet:${userId}`, "0.0000");

    const res = await sendWebhook(providerRef, "PAID");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const invoice = await getInvoiceByProviderRef(providerRef);
    expect(invoice.status).toBe("PAID");
    expect(invoice.paidAt).toBeInstanceOf(Date);
    expect(await getUserBalance(userId)).toBe(60000);

    // PG credit must be reflected by clearing the stale Redis wallet cache.
    expect(await redis.exists(`wallet:${userId}`)).toBe(0);
  });

  test("duplicate PAID webhook is idempotent and credits only once", async () => {
    const userId = await makeUserWithKey();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
    });

    const [a, b] = await Promise.all([
      sendWebhook(providerRef, "PAID"),
      sendWebhook(providerRef, "PAID"),
    ]);

    expect([a.status, b.status]).toContain(200);
    const bodies = [await a.json(), await b.json()];
    const ok = bodies.find((x) => (x as { ok: true }).ok === true);
    const dup = bodies.find((x) => (x as { duplicate: true }).duplicate === true);
    expect(ok).toBeTruthy();
    expect(dup).toBeTruthy();

    const invoice = await getInvoiceByProviderRef(providerRef);
    expect(invoice.status).toBe("PAID");
    expect(await getUserBalance(userId)).toBe(50000);
  });

  test("rejects an invalid signature with 403 and never credits", async () => {
    const userId = await makeUserWithKey("50000.0000");
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
    });

    const res = await app.request("/api/webhooks/qris", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tripay-signature": "00".repeat(32) },
      body: JSON.stringify({ provider_ref: providerRef, status: "PAID" }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_SIGNATURE");
    expect(await getUserBalance(userId)).toBe(50000);

    const invoice = await getInvoiceByProviderRef(providerRef);
    expect(invoice.status).toBe("PENDING");
  });

  test("returns 404 for an unknown provider reference", async () => {
    const res = await sendWebhook("UNKNOWN-REF", "PAID");
    expect(res.status).toBe(404);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVOICE_NOT_FOUND");
  });

  test("returns 400 for an unparsable webhook payload", async () => {
    const res = await app.request("/api/webhooks/qris", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tripay-signature": signQrisBody("not-json"),
      },
      body: "not-json",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PAYLOAD");
  });

  test("credits UNLIMITED_10D by extending unlimited_expires_at", async () => {
    const userId = await makeUserWithKey();
    const { providerRef } = await insertInvoice({
      userId,
      planType: "UNLIMITED_10D",
      baseAmountIdr: 20000,
      totalPayIdr: 20000,
    });

    const res = await sendWebhook(providerRef, "PAID");
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ unlimitedExpiresAt: users.unlimitedExpiresAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(row.unlimitedExpiresAt).toBeInstanceOf(Date);
    const days = (row.unlimitedExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(9);
    expect(days).toBeLessThanOrEqual(10);
  });

  test("credits TRIAL_1D by extending unlimited_expires_at", async () => {
    const userId = await makeUserWithKey();
    const { providerRef } = await insertInvoice({
      userId,
      planType: "TRIAL_1D",
      baseAmountIdr: 100,
      totalPayIdr: 100,
    });

    const res = await sendWebhook(providerRef, "PAID");
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ unlimitedExpiresAt: users.unlimitedExpiresAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(row.unlimitedExpiresAt).toBeInstanceOf(Date);
    const days = (row.unlimitedExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(1.5);
  });

  test("does not credit a non-PAID event status", async () => {
    const userId = await makeUserWithKey();
    const { providerRef } = await insertInvoice({
      userId,
      baseAmountIdr: 50000,
      totalPayIdr: 50000,
    });

    const res = await sendWebhook(providerRef, "EXPIRED");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await getUserBalance(userId)).toBe(0);

    const invoice = await getInvoiceByProviderRef(providerRef);
    expect(invoice.status).toBe("EXPIRED");
  });
});