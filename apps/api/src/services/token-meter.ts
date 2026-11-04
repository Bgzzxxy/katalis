import { eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import type Redis from "ioredis";
import { apiKeys, usageLogs, users } from "../db/schema";
import { createWalletScripts, type WalletScripts, type ChargeResult } from "../db/redis";
import { microToIdrString, round4Idr } from "../db/money";

export type MeteredUsage = {
  modelId: string;
  poolTier: "LORA" | "STABLE" | "FLEX";
  provider: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  httpStatus: number;
};

export type CostBreakdown = {
  promptTokens: number;
  completionTokens: number;
  costMicro: number;
};

const scripts: WalletScripts = createWalletScripts();

/** Integer micro-IDR cost from token counts and a model's micro-per-1M prices. */
export function meterTokens(
  usage: Pick<MeteredUsage, "promptTokens" | "completionTokens" | "poolTier">,
  priceInMicroPer1M: number,
  priceOutMicroPer1M: number,
  unlimitedExpiresAt: Date | null,
): CostBreakdown {
  const promptTokens = usage.promptTokens;
  const completionTokens = usage.completionTokens;
  let costMicro = Math.round(
    (promptTokens * priceInMicroPer1M + completionTokens * priceOutMicroPer1M) /
      1_000_000,
  );
  if (usage.poolTier === "LORA" && unlimitedExpiresAt && unlimitedExpiresAt.getTime() > Date.now()) {
    costMicro = Math.round((costMicro * 70) / 100);
  }
  return { promptTokens, completionTokens, costMicro };
}

/** Lazy-init `wallet:<userId>` from PG (fresh row read each call; SET NX in Lua). */
export async function initWallet(
  redis: Redis,
  userId: string,
  pgBalanceIdr: string | number = "0",
): Promise<number> {
  return scripts.initWallet(redis, userId, pgBalanceIdr);
}

export async function getWalletMicro(redis: Redis, userId: string): Promise<number> {
  const raw = await redis.get(`wallet:${userId}`);
  return raw === null || raw === undefined ? 0 : Math.round(Number(raw) * 1_000_000);
}

export async function precheck(
  redis: Redis,
  userId: string,
  keyHash: string,
  costMicro: number,
): Promise<"1" | "0"> {
  return scripts.precheck(redis, userId, keyHash, costMicro);
}

export async function chargeRequest(
  redis: Redis,
  userId: string,
  keyHash: string,
  costMicro: number,
): Promise<ChargeResult> {
  return scripts.charge(redis, userId, keyHash, costMicro);
}

export async function flexWindow(
  redis: Redis,
  userId: string,
  tokens: number,
  member: string,
  windowMs: number,
): Promise<number> {
  return scripts.flexWindow(redis, userId, tokens, member, windowMs);
}

export type UsageRecord = {
  userId: string;
  apiKeyId: string;
  modelId: string;
  poolTier: string;
  upstreamProvider: string;
  promptTokens: number;
  completionTokens: number;
  costMicro: number;
  latencyMs: number;
  httpStatus: number;
};

/** Persist one request: usage_logs (6dp) + api_keys.spent_idr (4dp) + last_used_at
 *  + users.wallet_balance_idr (durable debit). `costMicro` is the ACTUAL debited
 *  micro amount (already clamped/discounted), never the full nominal cost. */
export async function persistUsage(db: Db, record: UsageRecord): Promise<void> {
  const debitIdr = round4Idr(record.costMicro).toFixed(4);
  await db.transaction(async (tx) => {
    await tx
      .update(apiKeys)
      .set({
        spentIdr: sql`${apiKeys.spentIdr} + ${debitIdr}`,
        lastUsedAt: new Date(),
      })
      .where(eq(apiKeys.id, record.apiKeyId));

    await tx
      .update(users)
      .set({
        walletBalanceIdr: sql`${users.walletBalanceIdr} - ${debitIdr}`,
      })
      .where(eq(users.id, record.userId));

    await tx.insert(usageLogs).values({
      userId: record.userId,
      apiKeyId: record.apiKeyId,
      modelId: record.modelId,
      poolTier: record.poolTier,
      upstreamProvider: record.upstreamProvider,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      costChargedIdr: microToIdrString(record.costMicro),
      latencyMs: record.latencyMs,
      httpStatus: record.httpStatus,
    });
  });
}