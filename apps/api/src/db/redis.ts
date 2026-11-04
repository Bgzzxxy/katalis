import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, { lazyConnect: false });
}

export async function pingRedis(
  redis: Redis,
  timeoutMs: number = 2000,
): Promise<boolean> {
  try {
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("redis ping timeout")), timeoutMs),
    );
    const pong = await Promise.race([pingPromise, timeoutPromise]);
    return pong === "PONG";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- Batch 3 Lua
// All balance math here is integer micro-IDR and every script returns string
// values (Lua integers are floats and would lose precision past 2^53).

export type ChargeDecision = "ok" | "insufficient" | "limit";

export type ChargeResult = {
  decision: ChargeDecision;
  /** Actual debited micro-IDR (0 when the decision is not "ok"). */
  debitMicro: number;
};

export type WalletScripts = {
  /** wallet>0 and (no spend limit or spent+cost <= limit). Returns "1"|"0". */
  precheck(redis: Redis, userId: string, keyHash: string, costMicro: number): Promise<"1" | "0">;
  /** Atomically check balance+spend-limit and debit; clamps to available. */
  charge(redis: Redis, userId: string, keyHash: string, costMicro: number): Promise<ChargeResult>;
  /** Atomic flex window prune+sum+add. Returns new total (string, integer). */
  flexWindow(redis: Redis, userId: string, tokens: number, member: string, windowMs: number): Promise<number>;
  /** Lazy-initialize `wallet:<userId>` from the PG balance once (SET NX). */
  initWallet(redis: Redis, userId: string, balanceIdr: string | number): Promise<number>;
};

const WALLET_PREFIX = "wallet:";
export const WALLET_SEED_PREFIX = "wallet:seed:";
const KEY_PREFIX_CACHE = "apikey:";
const FLEX_PREFIX = "flex:";

const PRECHECK_LUA = `
local wallet = redis.call('GET', KEYS[1])
local available = tonumber(wallet or '0') * 1000000
if available <= 0 then return '0' end
local limit = redis.call('HGET', KEYS[2], 'spend_limit_idr')
if limit and limit ~= '' then
  local limitMicro = tonumber(limit) * 1000000
  local spent = tonumber(redis.call('HGET', KEYS[2], 'spent_idr') or '0') * 1000000
  if spent + tonumber(ARGV[1]) > limitMicro then return '0' end
end
return '1'
`;

const CHARGE_LUA = `
local available = tonumber(redis.call('GET', KEYS[1]) or '0') * 1000000
if available <= 0 then return { 'insufficient', '0' } end
local cost = tonumber(ARGV[1])
local limit = redis.call('HGET', KEYS[2], 'spend_limit_idr')
if limit and limit ~= '' then
  local limitMicro = tonumber(limit) * 1000000
  local spent = tonumber(redis.call('HGET', KEYS[2], 'spent_idr') or '0') * 1000000
  if spent + cost > limitMicro then return { 'limit', '0' } end
end
local debit = math.min(cost, available)
local newIdr = (available - debit) / 1000000
redis.call('SET', KEYS[1], string.format('%.4f', newIdr))
redis.call('HINCRBYFLOAT', KEYS[2], 'spent_idr', debit / 1000000)
return { 'ok', tostring(debit) }
`;

const FLEX_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
local sum = 0
local members = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[2], '+inf', 'WITHSCORES')
for i = 1, #members, 2 do
  local member = members[i]
  local idx = string.find(member, ':')
  if idx then
    sum = sum + tonumber(string.sub(member, 1, idx - 1))
  else
    sum = sum + tonumber(member)
  end
end
sum = sum + tonumber(ARGV[1])
redis.call('ZADD', KEYS[1], ARGV[3], KEYS[2])
return tostring(sum)
`;

const INIT_WALLET_LUA = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
local seed = ARGV[1]
local snapshot = redis.call('GET', KEYS[2])
if snapshot then
  local a = tonumber(seed) or 0
  local b = tonumber(snapshot) or 0
  if b > a then seed = snapshot end
end
redis.call('SET', KEYS[1], seed, 'NX')
return redis.call('GET', KEYS[1])
`;

export function createWalletScripts(): WalletScripts {
  return {
    async precheck(redis, userId, keyHash, costMicro) {
      const result = (await redis.eval(
        PRECHECK_LUA,
        2,
        `${WALLET_PREFIX}${userId}`,
        `${KEY_PREFIX_CACHE}${keyHash}`,
        String(costMicro),
      )) as string | number;
      return result === 1 || result === "1" ? "1" : "0";
    },

    async charge(redis, userId, keyHash, costMicro) {
      const [decision, debitRaw] = (await redis.eval(
        CHARGE_LUA,
        2,
        `${WALLET_PREFIX}${userId}`,
        `${KEY_PREFIX_CACHE}${keyHash}`,
        String(costMicro),
      )) as [string, string | number];
      return {
        decision: decision as ChargeDecision,
        debitMicro: Math.round(Number(debitRaw)),
      };
    },

    async flexWindow(redis, userId, tokens, member, windowMs) {
      const now = Date.now();
      const result = (await redis.eval(
        FLEX_WINDOW_LUA,
        2,
        `${FLEX_PREFIX}${userId}`,
        `${tokens}:${member}`,
        String(tokens),
        String(now - windowMs),
        String(now),
      )) as string | number;
      return Math.round(Number(result));
    },

    async initWallet(redis, userId, balanceIdr) {
      const value = Number(balanceIdr);
      const result = (await redis.eval(
        INIT_WALLET_LUA,
        2,
        `${WALLET_PREFIX}${userId}`,
        `${WALLET_SEED_PREFIX}${userId}`,
        Number.isFinite(value) ? value.toFixed(4) : "0.0000",
      )) as string | number;
      return Number(result);
    },
  };
}