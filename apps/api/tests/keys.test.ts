import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { apiKeys } from "../src/db/schema";
import { lookupApiKey } from "../src/services/key.service";
import type { AppEnv } from "../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

type KeyCreated = {
  id: string;
  name: string;
  key_prefix: string;
  key: string;
  created_at: string;
};

type KeyView = {
  id: string;
  name: string;
  key_prefix: string;
  spend_limit_idr: number | null;
  spent_idr: number;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: string;
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });
const redis = createRedis(TEST_REDIS_URL);

const env: AppEnv = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  NODE_ENV: "test",
  COOKIE_SECURE: false,
  CORS_ORIGINS: "http://localhost:5173",
};

const app = createApp({ db, redis, env });

async function registerEmails() {
  const res = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "keys-a@example.com", password: "password123" }),
  });
  expect(res.status).toBe(201);
  const res2 = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "keys-b@example.com", password: "password123" }),
  });
  expect(res2.status).toBe(201);
}

async function login(email: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  expect(res.status).toBe(200);
  return cookieHeader(res);
}

function cookieHeader(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function authedRequest(
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
) {
  return app.request(path, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  await resetDb(db);
  await clearApiKeyCache(redis);
  await registerEmails();
});

afterAll(async () => {
  await clearApiKeyCache(redis);
  await redis.quit();
  await closeDb(dbClient);
});

beforeEach(async () => {
  // Keep the two registered users across tests; wipe only auth-domain rows so
  // each test starts with a clean key space.
  await db.execute(sql`TRUNCATE TABLE api_keys RESTART IDENTITY CASCADE`);
  await clearApiKeyCache(redis);
});

describe("POST /api/keys", () => {
  test("creates a key and returns the raw value only once", async () => {
    const cookie = await login("keys-a@example.com");
    const res = await authedRequest(cookie, "POST", "/api/keys", { name: "prod" });
    expect(res.status).toBe(201);

    const body = (await res.json()) as KeyCreated;
    expect(body.id).toEqual(expect.any(String));
    expect(body.name).toBe("prod");
    expect(body.key_prefix).toBe(body.key.slice(0, 16));
    expect(body.created_at).toBeTruthy();

    expect(body.key).toMatch(/^sk-ktl-[A-Za-z0-9]{32}$/);
    for (const char of body.key.slice("sk-ktl-".length)) {
      expect(BASE58.includes(char)).toBe(true);
    }

    expect(body.key.length).toBe(7 + 32);
    expect(body.key_prefix.length).toBe(16);

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, body.id), eq(apiKeys.keyHash, createHash("sha256").update(body.key).digest("hex"))));
    expect(row).toBeTruthy();
    expect(row.keyHash).toHaveLength(64);
    expect(row.keyHash).not.toBe(body.key);
    expect(JSON.stringify(body)).not.toContain(row.keyHash);
  });

  test("defaults the name and trims user input", async () => {
    const cookie = await login("keys-a@example.com");
    const res = await authedRequest(cookie, "POST", "/api/keys");
    expect(res.status).toBe(201);
    const body = (await res.json()) as KeyCreated;
    expect(body.name).toBe("API Key");
  });

  test("rejects invalid names with VALIDATION_ERROR", async () => {
    const cookie = await login("keys-a@example.com");
    const res = await authedRequest(cookie, "POST", "/api/keys", { name: "   " });
    expect(res.status).toBe(400);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/keys", () => {
  test("lists only the logged-in user keys and never exposes secret fields", async () => {
    const cookieA = await login("keys-a@example.com");
    const cookieB = await login("keys-b@example.com");

    await authedRequest(cookieA, "POST", "/api/keys", { name: "a-1" });
    await authedRequest(cookieA, "POST", "/api/keys", { name: "a-2" });
    await authedRequest(cookieB, "POST", "/api/keys", { name: "b-1" });

    const res = await authedRequest(cookieA, "GET", "/api/keys");
    expect(res.status).toBe(200);
    const body = (await res.json()) as KeyView[];
    expect(body).toHaveLength(2);

    const names = body.map((k) => k.name).sort();
    expect(names).toEqual(["a-1", "a-2"]);

    for (const key of body) {
      expect((key as unknown as { key?: string }).key).toBeUndefined();
      expect((key as unknown as { key_hash?: string }).key_hash).toBeUndefined();
      expect(key.spend_limit_idr).toBeNull();
      expect(key.spent_idr).toBe(0);
      expect(key.is_active).toBe(true);
      expect(key.last_used_at).toBeNull();
    }
  });
});

describe("PATCH /api/keys/:id", () => {
  test("renames the key", async () => {
    const cookie = await login("keys-a@example.com");
    const created = (await (
      await authedRequest(cookie, "POST", "/api/keys", { name: "old" })
    ).json()) as KeyCreated;

    const res = await authedRequest(cookie, "PATCH", `/api/keys/${created.id}`, {
      name: "new name",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as KeyView;
    expect(body.name).toBe("new name");
  });

  test("does not rename another user key and returns a uniform 404", async () => {
    const cookieA = await login("keys-a@example.com");
    const cookieB = await login("keys-b@example.com");
    const created = (await (
      await authedRequest(cookieA, "POST", "/api/keys", { name: "mine" })
    ).json()) as KeyCreated;

    const res = await authedRequest(cookieB, "PATCH", `/api/keys/${created.id}`, {
      name: "stolen",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("KEY_NOT_FOUND");
  });

  test("treats a malformed UUID as 404 rather than 500", async () => {
    const cookie = await login("keys-a@example.com");
    const res = await authedRequest(cookie, "PATCH", "/api/keys/not-a-uuid", {
      name: "x",
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as OpenAiError).error.code).toBe("KEY_NOT_FOUND");
  });
});

describe("PUT /api/keys/:id/spend-limit", () => {
  test("sets and clears the spend limit", async () => {
    const cookie = await login("keys-a@example.com");
    const created = (await (
      await authedRequest(cookie, "POST", "/api/keys", { name: "limit" })
    ).json()) as KeyCreated;

    const set = await authedRequest(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: 50000,
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as KeyView).spend_limit_idr).toBe(50000);

    const clear = await authedRequest(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: null,
    });
    expect(clear.status).toBe(200);
    expect(((await clear.json()) as KeyView).spend_limit_idr).toBeNull();
  });

  test("rejects a negative spend limit", async () => {
    const cookie = await login("keys-a@example.com");
    const created = (await (
      await authedRequest(cookie, "POST", "/api/keys", { name: "limit" })
    ).json()) as KeyCreated;

    const res = await authedRequest(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: -1,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("pause/resume", () => {
  test("pauses and resumes idempotently while invalidating the Redis cache", async () => {
    const cookie = await login("keys-a@example.com");
    const created = (await (
      await authedRequest(cookie, "POST", "/api/keys", { name: "switch" })
    ).json()) as KeyCreated;

    const keyHash = createHash("sha256").update(created.key).digest("hex");
    await lookupApiKey(db, redis, created.key);
    expect(Object.keys(await redis.hgetall(`apikey:${keyHash}`))).not.toHaveLength(0);

    const pause1 = await authedRequest(cookie, "POST", `/api/keys/${created.id}/pause`);
    expect(pause1.status).toBe(200);
    expect(((await pause1.json()) as KeyView).is_active).toBe(false);
    expect(Object.keys(await redis.hgetall(`apikey:${keyHash}`))).toHaveLength(0);

    const pause2 = await authedRequest(cookie, "POST", `/api/keys/${created.id}/pause`);
    expect(pause2.status).toBe(200);
    expect(((await pause2.json()) as KeyView).is_active).toBe(false);

    const resume = await authedRequest(cookie, "POST", `/api/keys/${created.id}/resume`);
    expect(resume.status).toBe(200);
    expect(((await resume.json()) as KeyView).is_active).toBe(true);

    const resume2 = await authedRequest(cookie, "POST", `/api/keys/${created.id}/resume`);
    expect(resume2.status).toBe(200);
    expect(((await resume2.json()) as KeyView).is_active).toBe(true);
  });
});

describe("DELETE /api/keys/:id", () => {
  test("revokes the key, deletes the row and invalidates the cache", async () => {
    const cookie = await login("keys-a@example.com");
    const created = (await (
      await authedRequest(cookie, "POST", "/api/keys", { name: "gone" })
    ).json()) as KeyCreated;

    const keyHash = createHash("sha256").update(created.key).digest("hex");
    await lookupApiKey(db, redis, created.key);

    const res = await authedRequest(cookie, "DELETE", `/api/keys/${created.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: created.id, deleted: true });

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, created.id));
    expect(row).toBeUndefined();

    expect(Object.keys(await redis.hgetall(`apikey:${keyHash}`))).toHaveLength(0);
    expect(await lookupApiKey(db, redis, created.key)).toBeNull();
  });
});

describe("auth guard", () => {
  test("rejects missing session cookies", async () => {
    const res = await app.request("/api/keys");
    expect(res.status).toBe(401);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});