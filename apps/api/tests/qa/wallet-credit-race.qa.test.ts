/**
 * QA BUG reproducer — Batch 4 pays off Batch 3's Redis wallet cache.
 *
 * Contract: qris.service.ts DELs `wallet:<userId>` AFTER the credit commits.
 * The question QA asked: what happens if a proxy request read PG BEFORE the
 * credit commit, then re-seeds the Redis cache AFTER the DEL? That stale seed
 * must not pin a value lower than the authoritative PostgreSQL balance.
 *
 * Expected to FAIL until the race is closed. This lives in its own file so the
 * main suite stays green and this failure is reported loud and deterministic.
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
import { createFakeQrisProvider, QRIS_TEST_SECRET, signQrisBody } from "../helpers/qris";

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

const app = createApp({ db, redis, env, qris: createFakeQrisProvider() });

async function makeUser(wallet = "0.0000"): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ email: `race-${Math.random().toString(16).slice(2)}@example.com`, walletBalanceIdr: wallet })
    .returning({ id: users.id });
  return row.id;
}

async function pgBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId));
  return toIdr(row?.walletBalanceIdr ?? "0");
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

describe("BUG: stale proxy read re-seeds Redis below PG after credit DEL", () => {
  test("wallet:<user> must match PG after a credit, even with a racing proxy seed", async () => {
    const userId = await makeUser();
    const providerRef = `REF-${Math.random().toString(16).slice(2)}`;
    await db.insert(paymentInvoices).values({
      id: `INV-${Math.random().toString(16).slice(2)}`,
      userId,
      planType: "PREPAID",
      baseAmountIdr: 50000,
      bonusAmountIdr: 0,
      totalPayIdr: 50000,
      qrisString: "qr://fake",
      providerRef,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 600_000),
    });
    await redis.del(`wallet:${userId}`);

    // t1: v1-proxy reads PG BEFORE webhook commits. Balance is still 0.0000.
    const stalePgRead = "0.0000";

    // t2: webhook commits credit to PG, then DELs the wallet key (real code path).
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

    // t3: proxy re-seeds from its stale read. SET NX latches the stale zero.
    await initWallet(redis, userId, stalePgRead);

    const pg = await pgBalance(userId);
    const cacheMicro = await getWalletMicro(redis, userId);
    expect(pg).toBe(50000);
    // BUG: this is 0 today because the stale NX seed fired after the DEL.
    expect(cacheMicro).toBe(50_000_000_000);
  });
});