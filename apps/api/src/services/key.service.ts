import { createHash, randomInt } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type Redis from "ioredis";
import type { Db } from "../db";
import { toIdr } from "../db/money";
import { apiKeys } from "../db/schema";
import { AppError } from "../middleware/error-handler";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PREFIX = "sk-ktl-";
const RANDOM_CHARS = 32;
const KEY_PREFIX_LENGTH = 16;
const CACHE_TTL_SECONDS = 300;

export type ApiKeyRow = {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  spendLimitIdr: string | null;
  spentIdr: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type ApiKeyView = {
  id: string;
  name: string;
  key_prefix: string;
  spend_limit_idr: number | null;
  spent_idr: number;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
};

export type ApiKeyContext = {
  id: string;
  userId: string;
  keyPrefix: string;
  isActive: boolean;
  spendLimitIdr: number | null;
  spentIdr: number;
};

export function generateApiKey(): { raw: string; keyHash: string; keyPrefix: string } {
  let random = "";
  for (let i = 0; i < RANDOM_CHARS; i += 1) {
    random += BASE58_ALPHABET[randomInt(58)];
  }
  const raw = `${PREFIX}${random}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, KEY_PREFIX_LENGTH),
  };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function parseApiKey(value: string): string | null {
  if (!value.startsWith(PREFIX)) return null;
  const random = value.slice(PREFIX.length);
  if (random.length !== RANDOM_CHARS) return null;
  for (const char of random) {
    if (!BASE58_ALPHABET.includes(char)) return null;
  }
  return value;
}

function encodeCache(row: ApiKeyRow): Record<string, string> {
  return {
    id: row.id,
    user_id: row.userId,
    key_prefix: row.keyPrefix,
    is_active: row.isActive ? "1" : "0",
    spend_limit_idr: row.spendLimitIdr ?? "",
    spent_idr: row.spentIdr,
  };
}

function decodeCache(
  hash: Record<string, string>,
): ApiKeyContext | null {
  if (!hash.id || !hash.user_id || !hash.key_prefix || !hash.is_active) {
    return null;
  }
  return {
    id: hash.id,
    userId: hash.user_id,
    keyPrefix: hash.key_prefix,
    isActive: hash.is_active === "1",
    spendLimitIdr:
      hash.spend_limit_idr === undefined || hash.spend_limit_idr === ""
        ? null
        : toIdr(hash.spend_limit_idr),
    spentIdr: hash.spent_idr === undefined ? 0 : toIdr(hash.spent_idr),
  };
}

async function getKeyByHash(db: Db, keyHash: string): Promise<ApiKeyRow | null> {
  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  return row ?? null;
}

async function writeApiKeyCache(
  redis: Redis,
  keyHash: string,
  row: ApiKeyRow,
): Promise<void> {
  await redis
    .multi()
    .hset(`apikey:${keyHash}`, encodeCache(row))
    .expire(`apikey:${keyHash}`, CACHE_TTL_SECONDS)
    .exec();
}

export async function lookupApiKey(
  db: Db,
  redis: Redis,
  raw: string,
): Promise<ApiKeyContext | null> {
  const parsed = parseApiKey(raw);
  if (!parsed) return null;

  const keyHash = hashApiKey(parsed);
  const cacheKey = `apikey:${keyHash}`;

  try {
    const cached = await redis.hgetall(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      const decoded = decodeCache(cached);
      if (decoded) return decoded;
    }
  } catch {
    // Redis is down: fall through to PostgreSQL.
  }

  const row = await getKeyByHash(db, keyHash);
  if (!row) return null;

  // Inactive keys are cached too so repeated 401s stay O(1). Pause/resume and
  // revoke invalidate this key explicitly (`invalidateApiKeyCache`).
  try {
    await writeApiKeyCache(redis, keyHash, row);
  } catch {
    // Best-effort cache; a down Redis must not fail the auth path.
  }

  return decodeCache(encodeCache(row));
}

export async function invalidateApiKeyCache(
  redis: Redis,
  keyHash: string,
): Promise<void> {
  try {
    await redis.del(`apikey:${keyHash}`);
  } catch {
    // Best-effort invalidation; stale data is bounded by the 300s TTL.
  }
}

function fromIdrValue(value: string | number | null): number | null {
  if (value === null) return null;
  return toIdr(value);
}

export function toKeyView(row: ApiKeyRow): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.keyPrefix,
    spend_limit_idr: fromIdrValue(row.spendLimitIdr),
    spent_idr: toIdr(row.spentIdr),
    is_active: row.isActive,
    last_used_at: row.lastUsedAt,
    created_at: row.createdAt,
  };
}

export async function createApiKey(
  db: Db,
  redis: Redis,
  userId: string,
  name?: string,
): Promise<ApiKeyView & { key: string }> {
  const safeName = (name ?? "API Key").trim();
  if (safeName.length < 1 || safeName.length > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "Nama API key harus 1-100 karakter", {
      type: "validation_error",
      param: "name",
    });
  }

  const { raw, keyHash, keyPrefix } = generateApiKey();

  try {
    const [row] = await db
      .insert(apiKeys)
      .values({
        userId,
        name: safeName,
        keyHash,
        keyPrefix,
      })
      .returning({
        id: apiKeys.id,
        userId: apiKeys.userId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        keyHash: apiKeys.keyHash,
        spendLimitIdr: apiKeys.spendLimitIdr,
        spentIdr: apiKeys.spentIdr,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      });

    try {
      await writeApiKeyCache(redis, keyHash, row);
    } catch {
      // Best-effort cache: a down Redis must not fail key creation. The next
      // auth attempt repopulates from PostgreSQL.
    }
    return { ...toKeyView(row), key: raw };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membuat API key", {
        type: "api_error",
      });
    }
    throw err;
  }
}

export async function listApiKeys(
  db: Db,
  userId: string,
): Promise<ApiKeyView[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id));
  return rows.map(toKeyView);
}

async function getOwnedKeyRow(
  db: Db,
  userId: string,
  keyId: string,
): Promise<ApiKeyRow> {
  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!row) {
    throw new AppError(404, "KEY_NOT_FOUND", "API key tidak ditemukan", {
      type: "invalid_request_error",
    });
  }
  return row;
}

export async function renameApiKey(
  db: Db,
  userId: string,
  keyId: string,
  name: string,
): Promise<ApiKeyView> {
  const safeName = name.trim();
  if (safeName.length < 1 || safeName.length > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "Nama API key harus 1-100 karakter", {
      type: "validation_error",
      param: "name",
    });
  }

  await getOwnedKeyRow(db, userId, keyId);
  const [row] = await db
    .update(apiKeys)
    .set({ name: safeName })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    });
  return toKeyView(row);
}

export async function setSpendLimit(
  db: Db,
  redis: Redis,
  userId: string,
  keyId: string,
  spendLimitIdr: number | null,
): Promise<ApiKeyView> {
  const row = await getOwnedKeyRow(db, userId, keyId);
  const [updated] = await db
    .update(apiKeys)
    .set({ spendLimitIdr: spendLimitIdr === null ? null : spendLimitIdr.toFixed(4) })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    });

  await invalidateApiKeyCache(redis, row.keyHash);
  return toKeyView(updated);
}

export async function setApiKeyActive(
  db: Db,
  redis: Redis,
  userId: string,
  keyId: string,
  isActive: boolean,
): Promise<ApiKeyView> {
  const row = await getOwnedKeyRow(db, userId, keyId);
  const [updated] = await db
    .update(apiKeys)
    .set({ isActive })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      spendLimitIdr: apiKeys.spendLimitIdr,
      spentIdr: apiKeys.spentIdr,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    });

  await invalidateApiKeyCache(redis, row.keyHash);
  return toKeyView(updated);
}

export async function revokeApiKey(
  db: Db,
  redis: Redis,
  userId: string,
  keyId: string,
): Promise<{ id: string; deleted: true }> {
  const row = await getOwnedKeyRow(db, userId, keyId);
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
  await invalidateApiKeyCache(redis, row.keyHash);
  return { id: keyId, deleted: true };
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const top = err as { code?: string };
  const cause = (err as { cause?: unknown }).cause as { code?: string } | undefined;
  return top.code === "23505" || cause?.code === "23505";
}