import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, usageLogs, users } from "../src/db/schema";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import {
  chargeRequest,
  getWalletMicro,
  initWallet,
  meterTokens,
  persistUsage,
  precheck,
} from "../src/services/token-meter";
import { microToIdrString } from "../src/db/money";
import type { MeteredUsage } from "../src/services/token-meter";

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

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

async function makeUser(): Promise<{ userId: string; keyId: string; keyHash: string }> {
  const [uRow] = await db
    .insert(users)
    .values({ email: `u-${Math.random().toString(16).slice(2)}@example.com` })
    .returning({ id: users.id });
  const [kRow] = await db
    .insert(apiKeys)
    .values({
      userId: uRow.id,
      name: "meter",
      keyPrefix: "sk-ktl-12345678",
      keyHash: createHash("sha256").update("raw").digest("hex"),
    })
    .returning({ id: apiKeys.id, keyHash: apiKeys.keyHash });
  return { userId: uRow.id, keyId: kRow.id, keyHash: kRow.keyHash };
}

async function restoreWallet(userId: string, balance: string): Promise<void> {
  await db.update(users).set({ walletBalanceIdr: balance }).where(eq(users.id, userId));
}

const METERING: MeteredUsage = {
  modelId: "qwen3-max",
  poolTier: "STABLE",
  provider: "SILICONFLOW",
  promptTokens: 100,
  completionTokens: 50,
  latencyMs: 123,
  httpStatus: 200,
};

describe("token-meter cost maths", () => {
  test("computes integer micro cost from per-1M prices (no discount)", () => {
    const cost = meterTokens({ ...METERING }, 3_000_000, 6_000_000, null);
    expect(cost.costMicro).toBe(600);
    expect(microToIdrString(cost.costMicro)).toBe("0.000600");
  });

  test("applies -30% LoRA Unlimited discount", () => {
    const cost = meterTokens(
      { ...METERING, poolTier: "LORA", promptTokens: 100, completionTokens: 100 },
      3_000_000,
      6_000_000,
      new Date(Date.now() + 86_400_000),
    );
    expect(cost.costMicro).toBe(630);
    expect(microToIdrString(cost.costMicro)).toBe("0.000630");
  });
});

describe("wallet + key spent charging", () => {
  test("charges the exact micro cost and syncs wallet+spent", async () => {
    const { userId, keyHash } = await makeUser();
    await restoreWallet(userId, "1.0000");
    await initWallet(redis, userId, "1.0000");

    const { decision, debitMicro } = await chargeRequest(redis, userId, keyHash, 600);
    expect(decision).toBe("ok");
    expect(debitMicro).toBe(600);
    expect(await getWalletMicro(redis, userId)).toBe(999_400);
  });

  test("clamps with min(cost, available) so wallet never goes negative", async () => {
    const { userId, keyHash } = await makeUser();
    await restoreWallet(userId, "0.0003");
    await initWallet(redis, userId, "0.0003");

    const { decision, debitMicro } = await chargeRequest(redis, userId, keyHash, 1_000);
    expect(decision).toBe("ok");
    expect(debitMicro).toBe(300);
    expect(await getWalletMicro(redis, userId)).toBe(0);
  });

  test("precheck rejects insufficient balance and spend-limit overflow", async () => {
    const { userId, keyHash } = await makeUser();
    await restoreWallet(userId, "0.0000");
    await initWallet(redis, userId, "0.0000");
    expect(await precheck(redis, userId, keyHash, 1_000)).toBe("0");

    await restoreWallet(userId, "1.0000");
    await redis.del(`wallet:${userId}`);
    await initWallet(redis, userId, "1.0000");
    await db
      .update(apiKeys)
      .set({ spendLimitIdr: "0.0001" })
      .where(eq(apiKeys.keyHash, keyHash));
    await clearApiKeyCache(redis);
    await redis.hset(`apikey:${keyHash}`, "spend_limit_idr", "0.0001");
    expect(await precheck(redis, userId, keyHash, 200)).toBe("0");
    expect(await precheck(redis, userId, keyHash, 100)).toBe("1");
  });

  test("initWallet is a lazy NX seed from PG", async () => {
    const { userId } = await makeUser();
    await restoreWallet(userId, "25.5000");
    const first = await initWallet(redis, userId, "25.5000");
    expect(first).toBe(25.5);
    await restoreWallet(userId, "99.0000");
    expect(await initWallet(redis, userId)).toBe(25.5);
  });

  test("parallel charges never exceed the wallet balance", async () => {
    const { userId, keyHash } = await makeUser();
    await restoreWallet(userId, "10.0000");
    await initWallet(redis, userId, "10.0000");

    const results = await Promise.all(
      Array.from({ length: 20 }, () => chargeRequest(redis, userId, keyHash, 200_000)),
    );
    const realized = results.reduce((sum, r) => sum + r.debitMicro, 0) / 1_000_000;
    expect(realized).toBeLessThanOrEqual(10);
    expect(await getWalletMicro(redis, userId)).toBeCloseTo(10_000_000 - realized * 1_000_000, 0);
  });
});

describe("usage_logs + api_keys PG sync", () => {
  test("writes a 6-decimal usage log and updates spent/last_used_at", async () => {
    const { userId, keyId } = await makeUser();

    await persistUsage(db, {
      userId,
      apiKeyId: keyId,
      modelId: METERING.modelId,
      poolTier: METERING.poolTier,
      upstreamProvider: METERING.provider,
      promptTokens: METERING.promptTokens,
      completionTokens: METERING.completionTokens,
      costMicro: 600,
      latencyMs: METERING.latencyMs,
      httpStatus: METERING.httpStatus,
    });

    const [usage] = await db.select().from(usageLogs);
    expect(usage).toBeTruthy();
    expect(usage.costChargedIdr).toBe("0.000600");
    expect((usage.costChargedIdr as string).split(".")[1]?.length).toBe(6);

    const [key] = await db
      .select({ spentIdr: apiKeys.spentIdr, lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));
    expect(key.spentIdr).toBe("0.0006");
    expect(key.lastUsedAt).toBeInstanceOf(Date);
  });
});