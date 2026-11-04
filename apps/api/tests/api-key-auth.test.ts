import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type Redis from "ioredis";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys, users } from "../src/db/schema";
import { apiKeyAuth, type ApiKeyVariables } from "../src/middleware/api-key-auth";
import { errorHandler } from "../src/middleware/error-handler";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  resetDb,
  closeDb,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

type ApiKeyContext = {
  id: string;
  userId: string;
  keyPrefix: string;
  isActive: boolean;
  spendLimitIdr: number | null;
  spentIdr: number;
};

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

const RAW_KEY = "sk-ktl-" + "A".repeat(32);
const RAW_KEY_B = "sk-ktl-" + "B".repeat(32);

async function insertUser(email: string): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ email })
    .returning({ id: users.id });
  return row.id;
}

async function insertKey(userId: string, raw: string, isActive = true) {
  const keyHash = createHash("sha256").update(raw).digest("hex");
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId,
      name: "test key",
      keyPrefix: raw.slice(0, 16),
      keyHash,
      isActive,
    })
    .returning({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      isActive: apiKeys.isActive,
    });
  return row;
}

function createMiniApp(authRedis: Redis): Hono<ApiKeyVariables> {
  const app = new Hono<ApiKeyVariables>();
  app.onError(errorHandler);
  app.use(apiKeyAuth(db, authRedis));
  app.get("/", (c) => c.json(c.get("apiKey")));
  return app;
}

function authorize(app: Hono<ApiKeyVariables>, token?: string) {
  return app.request("/", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
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
});

describe("apiKeyAuth middleware", () => {
  test("miss: loads from Postgres and repopulates a 6-field Redis HASH", async () => {
    const userId = await insertUser("a@example.com");
    const inserted = await insertKey(userId, RAW_KEY);
    const expectedHash = createHash("sha256").update(RAW_KEY).digest("hex");

    const app = createMiniApp(redis);
    const res = await authorize(app, RAW_KEY);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiKeyContext;
    expect(body.id).toBe(inserted.id);
    expect(body.userId).toBe(userId);
    expect(body.keyPrefix).toBe(RAW_KEY.slice(0, 16));
    expect(body.isActive).toBe(true);
    expect(body.spentIdr).toBe(0);

    const rawCache = await redis.hgetall(`apikey:${expectedHash}`);
    expect(Object.keys(rawCache).sort()).toEqual([
      "id",
      "is_active",
      "key_prefix",
      "spend_limit_idr",
      "spent_idr",
      "user_id",
    ]);
  });

  test("hit: serves from Redis cache without touching Postgres", async () => {
    const userId = await insertUser("b@example.com");
    await insertKey(userId, RAW_KEY);

    const app = createMiniApp(redis);
    await authorize(app, RAW_KEY);

    // If the DB row is flipped inactive after the cache was populated, the cached
    // active flag is what the middleware sees until TTL/invalidation. This proves
    // the HIT path without adding spy infrastructure.
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.keyHash, createHash("sha256").update(RAW_KEY).digest("hex")));

    const res = await authorize(app, RAW_KEY);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiKeyContext;
    expect(body.isActive).toBe(true);
  });

  test("rejects an invalid format with the shared 401 envelope", async () => {
    const app = createMiniApp(redis);
    const res = await authorize(app, "Bearer wrong-format");
    expect(res.status).toBe(401);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("invalid_api_key");
  });

  test("returns the same 401 envelope for an unknown key and does not cache it", async () => {
    const app = createMiniApp(redis);
    const res = await authorize(app, RAW_KEY);
    expect(res.status).toBe(401);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("invalid_api_key");
    expect(body.error.type).toBe("authentication_error");

    const hash = createHash("sha256").update(RAW_KEY).digest("hex");
    const cache = await redis.hgetall(`apikey:${hash}`);
    expect(Object.keys(cache).length).toBe(0);
  });

  test("rejects an inactive key with 401 identical to an unknown key", async () => {
    const userId = await insertUser("c@example.com");
    await insertKey(userId, RAW_KEY, false);

    const inactiveBody = await (async () => {
      const res = await authorize(createMiniApp(redis), RAW_KEY);
      expect(res.status).toBe(401);
      return (await res.json()) as OpenAiError;
    })();

    expect(inactiveBody.error.code).toBe("invalid_api_key");
    expect(inactiveBody.error.type).toBe("authentication_error");
  });

  test("falls back to Postgres when Redis is down", async () => {
    const userId = await insertUser("d@example.com");
    await insertKey(userId, RAW_KEY_B);

    const downRedis = {
      hgetall: async () => {
        throw new Error("Redis unavailable");
      },
    } as unknown as Redis;

    const app = createMiniApp(downRedis);
    const res = await authorize(app, RAW_KEY_B);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiKeyContext;
    expect(body.id).toEqual(expect.any(String));
    expect(body.isActive).toBe(true);
  });

  test("repopulates the cache after it is cleared", async () => {
    const userId = await insertUser("e@example.com");
    await insertKey(userId, RAW_KEY);
    const hash = createHash("sha256").update(RAW_KEY).digest("hex");

    const app = createMiniApp(redis);
    await authorize(app, RAW_KEY);
    await clearApiKeyCache(redis);

    const cacheAfterClear = await redis.hgetall(`apikey:${hash}`);
    expect(Object.keys(cacheAfterClear).length).toBe(0);

    const res = await authorize(app, RAW_KEY);
    expect(res.status).toBe(200);
    const repopulated = await redis.hgetall(`apikey:${hash}`);
    expect(repopulated.id).toEqual(expect.any(String));
  });
});