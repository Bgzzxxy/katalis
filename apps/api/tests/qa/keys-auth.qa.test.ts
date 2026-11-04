/**
 * QA independent suite for Batch 2 — Multi-API Key + Fast Auth middleware.
 *
 * Written from the PUBLIC surface only (HTTP routes + the exported middleware and
 * service entry points used by the proxy). It does NOT touch src/ and does NOT
 * edit the developer's tests/keys.test.ts or tests/api-key-auth.test.ts.
 *
 * Focus: cross-user isolation, secret leakage, validation boundaries, the
 * "identical 401" anti-enumeration contract, and Redis-degradation resilience.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { Hono } from "hono";
import type Redis from "ioredis";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { apiKeys } from "../../src/db/schema";
import { apiKeyAuth, type ApiKeyVariables } from "../../src/middleware/api-key-auth";
import { errorHandler } from "../../src/middleware/error-handler";
import type { AppEnv } from "../../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "../helpers/db";
import { clearApiKeyCache } from "../helpers/redis";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

type KeyCreated = {
  id: string;
  name: string;
  key_prefix: string;
  key: string;
  spend_limit_idr: number | null;
  spent_idr: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  [k: string]: unknown;
};

type KeyView = {
  id: string;
  name: string;
  key_prefix: string;
  spend_limit_idr: number | null;
  spent_idr: number;
  is_active: boolean;
  [k: string]: unknown;
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAX_LIMIT = 9999999999.9999;

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

const J = { "content-type": "application/json" };

let emailSeq = 0;
async function registerAndLogin(emailPrefix: string): Promise<string> {
  const cleanPrefix = emailPrefix.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
  const email = `${cleanPrefix}.${Date.now()}.${++emailSeq}@example.com`;
  const reg = await app.request("/api/auth/register", {
    method: "POST",
    headers: J,
    body: JSON.stringify({ email, password: "password123" }),
  });
  expect(reg.status).toBe(201);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: J,
    body: JSON.stringify({ email, password: "password123" }),
  });
  expect(login.status).toBe(200);
  return (login.headers.get("set-cookie") ?? "").split(";")[0];
}

function authed(cookie: string, method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : J),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createKey(cookie: string, name?: string): Promise<KeyCreated> {
  const res = await authed(cookie, "POST", "/api/keys", name === undefined ? undefined : { name });
  expect(res.status).toBe(201);
  return (await res.json()) as KeyCreated;
}

function miniApp(authRedis: Redis) {
  const a = new Hono<ApiKeyVariables>();
  a.onError(errorHandler);
  a.use(apiKeyAuth(db, authRedis));
  a.get("/", (c) => c.json(c.get("apiKey")));
  return a;
}

function auth(a: Hono<ApiKeyVariables>, header?: string) {
  return a.request("/", { headers: header === undefined ? {} : { authorization: header } });
}

const hashOf = (raw: string) => createHash("sha256").update(raw).digest("hex");

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
  await db.execute(
    sql`TRUNCATE TABLE api_keys RESTART IDENTITY CASCADE`,
  );
  await clearApiKeyCache(redis);
});

// ---------------------------------------------------------------------------
// 1. Key format + zero secret leakage
// ---------------------------------------------------------------------------
describe("QA · key format & secret leakage", () => {
  test("raw key is sk-ktl-<32 base58>, prefix === first 16 chars, hash is 64 hex of raw", async () => {
    const cookie = await registerAndLogin("qa-keys-a@example.com");
    const body = await createKey(cookie, "format");

    expect(body.key).toMatch(/^sk-ktl-[1-9A-HJ-NP-Za-km-z]{32}$/);
    expect(body.key).toHaveLength(39);
    for (const ch of body.key.slice(7)) expect(BASE58).toContain(ch);

    expect(body.key_prefix).toBe(body.key.slice(0, 16));
    expect(body.key_prefix).toHaveLength(16);

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, body.id));
    expect(row.keyHash).toBe(hashOf(body.key));
    expect(row.keyHash).toHaveLength(64);
    expect(row.keyPrefix).toBe(body.key.slice(0, 16));
    expect(row.keyHash).not.toBe(body.key);
  });

  test("create response leaks neither key_hash, password_hash, nor user_id", async () => {
    const cookie = await registerAndLogin("qa-keys-leak@example.com");
    const body = await createKey(cookie, "leak");
    const serialized = JSON.stringify(body);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, body.id));

    expect(serialized).not.toContain(row.keyHash);
    expect(serialized.toLowerCase()).not.toContain("key_hash");
    expect(serialized.toLowerCase()).not.toContain("password");
    expect(serialized.toLowerCase()).not.toContain("user_id");
  });

  test("list/patch/pause responses never contain the raw key or its hash", async () => {
    const cookie = await registerAndLogin("qa-keys-leak2@example.com");
    const created = await createKey(cookie, "leak2");
    const hash = hashOf(created.key);

    const list = await authed(cookie, "GET", "/api/keys");
    expect(list.status).toBe(200);
    const listJson = JSON.stringify(await list.json());
    expect(listJson).not.toContain(created.key);
    expect(listJson).not.toContain(hash);
    expect(listJson.toLowerCase()).not.toContain("key_hash");

    const patched = await authed(cookie, "PATCH", `/api/keys/${created.id}`, { name: "renamed" });
    expect(JSON.stringify(await patched.json())).not.toContain(created.key);

    const paused = await authed(cookie, "POST", `/api/keys/${created.id}/pause`);
    expect(JSON.stringify(await paused.json())).not.toContain(created.key);
  });

  test("list exposes key_prefix matching the created raw key slice", async () => {
    const cookie = await registerAndLogin("qa-keys-prefix@example.com");
    const created = await createKey(cookie, "prefix");
    const list = (await (await authed(cookie, "GET", "/api/keys")).json()) as KeyView[];
    expect(list).toHaveLength(1);
    expect(list[0].key_prefix).toBe(created.key.slice(0, 16));
    expect(list[0].spent_idr).toBe(0);
    expect(typeof list[0].spent_idr).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// 2. Cross-user isolation on EVERY route
// ---------------------------------------------------------------------------
describe("QA · cross-user isolation (uniform 404, never 403/500/leak)", () => {
  async function twoUsers() {
    const a = await registerAndLogin("qa-iso-a@example.com");
    const b = await registerAndLogin("qa-iso-b@example.com");
    const key = await createKey(a, "a-private");
    return { a, b, key };
  }

  test("GET list is scoped to the caller", async () => {
    const { a, b } = await twoUsers();
    await createKey(a, "a-2");
    const listB = (await (await authed(b, "GET", "/api/keys")).json()) as KeyView[];
    expect(listB).toHaveLength(0);
  });

  for (const [label, method, path] of [
    ["PATCH rename", "PATCH", "/api/keys/:id"],
    ["PUT spend-limit", "PUT", "/api/keys/:id/spend-limit"],
    ["POST pause", "POST", "/api/keys/:id/pause"],
    ["POST resume", "POST", "/api/keys/:id/resume"],
    ["DELETE revoke", "DELETE", "/api/keys/:id"],
  ] as const) {
    test(`${label}: other user gets 404 KEY_NOT_FOUND`, async () => {
      const { b, key } = await twoUsers();
      const url = path.replace(":id", key.id);
      const body =
        method === "PATCH"
          ? { name: "hijacked" }
          : method === "PUT"
            ? { spend_limit_idr: 1 }
            : undefined;

      const res = await authed(b, method, url, body);
      expect(res.status).toBe(404);
      const err = (await res.json()) as OpenAiError;
      expect(err.error.code).toBe("KEY_NOT_FOUND");
      expect(err.error.type).toBe("invalid_request_error");

      // The victim's key must be untouched.
      const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id));
      expect(row).toBeTruthy();
      expect(row.name).toBe("a-private");
      expect(row.isActive).toBe(true);
    });
  }

  test("a non-UUID id returns 404 (not 500) across routes", async () => {
    const cookie = await registerAndLogin("qa-iso-bad@example.com");
    for (const [method, path] of [
      ["PATCH", "/api/keys/not-a-uuid"],
      ["PUT", "/api/keys/not-a-uuid/spend-limit"],
      ["POST", "/api/keys/not-a-uuid/pause"],
      ["POST", "/api/keys/not-a-uuid/resume"],
      ["DELETE", "/api/keys/not-a-uuid"],
    ] as const) {
      const body = method === "PATCH" ? { name: "x" } : method === "PUT" ? { spend_limit_idr: 1 } : undefined;
      const res = await authed(cookie, method, path, body);
      expect(res.status).toBe(404);
      expect(((await res.json()) as OpenAiError).error.code).toBe("KEY_NOT_FOUND");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. CRUD edge cases
// ---------------------------------------------------------------------------
describe("QA · CRUD edge cases", () => {
  test("rename trims and persists; rename of unknown id -> 404", async () => {
    const cookie = await registerAndLogin("qa-crud-a@example.com");
    const created = await createKey(cookie, "before");
    const res = await authed(cookie, "PATCH", `/api/keys/${created.id}`, { name: "  after  " });
    expect(res.status).toBe(200);
    expect(((await res.json()) as KeyView).name).toBe("after");

    const missing = await authed(cookie, "PATCH", `/api/keys/00000000-0000-4000-8000-000000000000`, {
      name: "x",
    });
    expect(missing.status).toBe(404);
  });

  test("spend-limit accepts number then null; persists across list", async () => {
    const cookie = await registerAndLogin("qa-crud-b@example.com");
    const created = await createKey(cookie, "limit");

    const set = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: 50000,
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as KeyView).spend_limit_idr).toBe(50000);

    const list1 = (await (await authed(cookie, "GET", "/api/keys")).json()) as KeyView[];
    expect(list1[0].spend_limit_idr).toBe(50000);

    const clear = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: null,
    });
    expect(clear.status).toBe(200);
    expect(((await clear.json()) as KeyView).spend_limit_idr).toBeNull();
  });

  test("spend-limit fractional precision survives round-trip (4 dp)", async () => {
    const cookie = await registerAndLogin("qa-crud-c@example.com");
    const created = await createKey(cookie, "frac");
    const res = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: 12345.6789,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as KeyView).spend_limit_idr).toBe(12345.6789);
  });

  test("pause/resume are idempotent and 404 on unknown id", async () => {
    const cookie = await registerAndLogin("qa-crud-d@example.com");
    const created = await createKey(cookie, "switch");

    expect((await authed(cookie, "POST", `/api/keys/${created.id}/pause`)).status).toBe(200);
    const pause2 = await authed(cookie, "POST", `/api/keys/${created.id}/pause`);
    expect(pause2.status).toBe(200);
    expect(((await pause2.json()) as KeyView).is_active).toBe(false);

    const resume1 = await authed(cookie, "POST", `/api/keys/${created.id}/resume`);
    expect(((await resume1.json()) as KeyView).is_active).toBe(true);
    const resume2 = await authed(cookie, "POST", `/api/keys/${created.id}/resume`);
    expect(resume2.status).toBe(200);
    expect(((await resume2.json()) as KeyView).is_active).toBe(true);

    const missing = await authed(cookie, "POST", `/api/keys/00000000-0000-4000-8000-000000000000/pause`);
    expect(missing.status).toBe(404);
  });

  test("revoke deletes the row; a second revoke is 404", async () => {
    const cookie = await registerAndLogin("qa-crud-e@example.com");
    const created = await createKey(cookie, "gone");

    const first = await authed(cookie, "DELETE", `/api/keys/${created.id}`);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ id: created.id, deleted: true });

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, created.id));
    expect(row).toBeUndefined();

    const second = await authed(cookie, "DELETE", `/api/keys/${created.id}`);
    expect(second.status).toBe(404);
    expect(((await second.json()) as OpenAiError).error.code).toBe("KEY_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// 4. Validation boundaries
// ---------------------------------------------------------------------------
describe("QA · validation boundaries", () => {
  test("name: empty, whitespace-only, >100 chars rejected; exactly 100 accepted", async () => {
    const cookie = await registerAndLogin("qa-val-a@example.com");
    for (const name of ["", "   ", "\t\n", "a".repeat(101)]) {
      const res = await authed(cookie, "POST", "/api/keys", { name });
      expect(res.status).toBe(400);
      expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
    }
    const ok = await authed(cookie, "POST", "/api/keys", { name: "a".repeat(100) });
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as KeyCreated).name).toHaveLength(100);
  });

  test("name must be a string (number/object/null rejected)", async () => {
    const cookie = await registerAndLogin("qa-val-b@example.com");
    for (const name of [123, null, { a: 1 }, ["x"]]) {
      const res = await authed(cookie, "POST", "/api/keys", { name });
      expect(res.status).toBe(400);
    }
  });

  test("spend-limit: negative, string, boolean rejected; 0 and max accepted", async () => {
    const cookie = await registerAndLogin("qa-val-c@example.com");
    const created = await createKey(cookie, "bounds");

    for (const bad of [-0.0001, -1, "50000", true, 1e12]) {
      const res = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
        spend_limit_idr: bad,
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
    }

    const zero = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: 0,
    });
    expect(zero.status).toBe(200);
    expect(((await zero.json()) as KeyView).spend_limit_idr).toBe(0);

    const max = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: MAX_LIMIT,
    });
    expect(max.status).toBe(200);
    expect(((await max.json()) as KeyView).spend_limit_idr).toBe(MAX_LIMIT);
  });

  test("spend-limit above the numeric(14,4) ceiling is 400, not 500", async () => {
    const cookie = await registerAndLogin("qa-val-d@example.com");
    const created = await createKey(cookie, "over");
    const res = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: MAX_LIMIT + 0.0001,
    });
    expect(res.status).toBe(400);
  });

  test("malformed JSON body yields 400 VALIDATION_ERROR, not 500", async () => {
    const cookie = await registerAndLogin("qa-val-e@example.com");
    const res = await app.request("/api/keys", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{ this is not json ",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });

  test("missing/empty JSON object on PATCH yields 400 (name required)", async () => {
    const cookie = await registerAndLogin("qa-val-f@example.com");
    const created = await createKey(cookie, "patch");
    const res = await authed(cookie, "PATCH", `/api/keys/${created.id}`, {});
    expect(res.status).toBe(400);
  });

  test("POST with no content-type silently ignores the body and defaults the name", async () => {
    // Documents Hono zValidator behaviour: a body sent without a JSON
    // content-type is skipped, so the key is created with the default name
    // rather than rejected. Reported as a LOW hardening finding.
    const cookie = await registerAndLogin("qa-val-g@example.com");
    const res = await app.request("/api/keys", {
      method: "POST",
      headers: { cookie, "content-type": "text/plain" },
      body: JSON.stringify({ name: "typed-name" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as KeyCreated;
    expect(body.name).toBe("API Key");
  });
});

// ---------------------------------------------------------------------------
// 5. Session guard on EVERY route
// ---------------------------------------------------------------------------
describe("QA · session guard", () => {
  const routes: ReadonlyArray<[string, string, unknown]> = [
    ["GET", "/api/keys", undefined],
    ["POST", "/api/keys", { name: "x" }],
    ["PATCH", "/api/keys/00000000-0000-4000-8000-000000000000", { name: "x" }],
    ["PUT", "/api/keys/00000000-0000-4000-8000-000000000000/spend-limit", { spend_limit_idr: 1 }],
    ["POST", "/api/keys/00000000-0000-4000-8000-000000000000/pause", undefined],
    ["POST", "/api/keys/00000000-0000-4000-8000-000000000000/resume", undefined],
    ["DELETE", "/api/keys/00000000-0000-4000-8000-000000000000", undefined],
  ];

  for (const [method, path, body] of routes) {
    test(`${method} ${path} without cookie -> 401 UNAUTHENTICATED envelope`, async () => {
      const res = await app.request(path, {
        method,
        headers: body === undefined ? {} : J,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(res.status).toBe(401);
      const err = (await res.json()) as OpenAiError;
      expect(err.error.code).toBe("UNAUTHENTICATED");
      expect(err.error).toHaveProperty("type");
      expect(err.error).toHaveProperty("param");
    });
  }

  test("a garbage cookie is 401 UNAUTHENTICATED (not 500)", async () => {
    const res = await app.request("/api/keys", { headers: { cookie: "katalis_session=garbage" } });
    expect(res.status).toBe(401);
    expect(((await res.json()) as OpenAiError).error.code).toBe("UNAUTHENTICATED");
  });
});

// ---------------------------------------------------------------------------
// 6. api-key-auth middleware — adversarial
// ---------------------------------------------------------------------------
describe("QA · api-key-auth adversarial", () => {
  test("all malformed/missing headers produce a byte-identical 401 body", async () => {
    const a = miniApp(redis);
    const cases = [
      undefined, // no header at all
      "", // empty header value
      "Bearer", // scheme without token
      "Bearer ", // trailing space, empty token
      "Bearer  sk-ktl-AAAA", // double space
      "Basic sk-ktl-" + "A".repeat(32), // wrong scheme
      "bearer sk-ktl-" + "A".repeat(32), // lowercase scheme
      "sk-ktl-" + "A".repeat(32), // missing scheme
    ];
    const bodies: string[] = [];
    for (const header of cases) {
      const res = await auth(a, header);
      expect(res.status).toBe(401);
      bodies.push(JSON.stringify(await res.json()));
    }
    // Every single malformed case must be identical to the first.
    for (const b of bodies.slice(1)) expect(b).toBe(bodies[0]);
    const parsed = JSON.parse(bodies[0]) as OpenAiError;
    expect(parsed.error.code).toBe("invalid_api_key");
    expect(parsed.error.type).toBe("authentication_error");
  });

  test("well-formed-but-invalid base58 chars / wrong length are rejected uniformly", async () => {
    const a = miniApp(redis);
    const bad = [
      "sk-ktl-" + "0".repeat(32), // '0' not in base58
      "sk-ktl-" + "O".repeat(32), // 'O' not in base58
      "sk-ktl-" + "I".repeat(32), // 'I' not in base58
      "sk-ktl-" + "l".repeat(32), // 'l' not in base58
      "sk-ktl-" + "A".repeat(31), // too short
      "sk-ktl-" + "A".repeat(33), // too long
      "sk-ktl-", // empty random part
      "SK-KTL-" + "A".repeat(32), // wrong case prefix
    ];
    const ref = JSON.stringify(await (await auth(a, "Bearer nope")).json());
    for (const raw of bad) {
      const res = await auth(a, `Bearer ${raw}`);
      expect(res.status).toBe(401);
      expect(JSON.stringify(await res.json())).toBe(ref);
    }
  });

  test("unknown key is 401 and leaves no cache pollution", async () => {
    const a = miniApp(redis);
    for (const seed of ["X", "Y", "Z"]) {
      const raw = "sk-ktl-" + seed.repeat(32);
      const res = await auth(a, `Bearer ${raw}`);
      expect(res.status).toBe(401);
      expect(Object.keys(await redis.hgetall(`apikey:${hashOf(raw)}`))).toHaveLength(0);
    }
    expect(await redis.keys("apikey:*")).toHaveLength(0);
  });

  test("inactive (paused) key is 401 with the exact same body as unknown key", async () => {
    const a = miniApp(redis);
    const raw = "sk-ktl-" + "Q".repeat(32);
    // Insert via the public HTTP surface so the row is realistic.
    const cookie = await registerAndLogin("qa-auth-inactive@example.com");
    const created = await createKey(cookie, "will-pause");
    // Overwrite hash/cache path by using the created raw directly.
    expect(created.key).toMatch(/^sk-ktl-/);
    await authed(cookie, "POST", `/api/keys/${created.id}/pause`);

    const inactiveBody = JSON.stringify(await (await auth(a, `Bearer ${created.key}`)).json());
    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(401);
    const unknownBody = JSON.stringify(
      await (await auth(a, `Bearer ${raw}`)).json(),
    );
    expect(inactiveBody).toBe(unknownBody);

    // Resume makes the same key succeed.
    await authed(cookie, "POST", `/api/keys/${created.id}/resume`);
    const resumed = await auth(a, `Bearer ${created.key}`);
    expect(resumed.status).toBe(200);
    const ctx = (await resumed.json()) as { id: string };
    expect(ctx.id).toBe(created.id);
  });

  test("cache HIT serves from Redis even after the DB row is gone", async () => {
    const cookie = await registerAndLogin("qa-auth-hit@example.com");
    const created = await createKey(cookie, "hit");
    const a = miniApp(redis);

    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(200);
    expect(Object.keys(await redis.hgetall(`apikey:${hashOf(created.key)}`))).toHaveLength(6);

    // Delete the row behind the middleware's back; a HIT must still answer 200.
    await db.delete(apiKeys).where(eq(apiKeys.id, created.id));
    const hit = await auth(a, `Bearer ${created.key}`);
    expect(hit.status).toBe(200);
    expect(((await hit.json()) as { id: string }).id).toBe(created.id);
  });

  test("pause invalidates cache immediately: next auth is 401", async () => {
    const cookie = await registerAndLogin("qa-auth-invalidate@example.com");
    const created = await createKey(cookie, "inval");
    const a = miniApp(redis);

    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(200);
    expect(Object.keys(await redis.hgetall(`apikey:${hashOf(created.key)}`)).length).toBeGreaterThan(0);

    const pause = await authed(cookie, "POST", `/api/keys/${created.id}/pause`);
    expect(pause.status).toBe(200);
    expect(Object.keys(await redis.hgetall(`apikey:${hashOf(created.key)}`))).toHaveLength(0);
    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(401);
  });

  test("spend-limit change invalidates cache; next auth reflects the new value", async () => {
    const cookie = await registerAndLogin("qa-auth-limit@example.com");
    const created = await createKey(cookie, "limcache");
    const a = miniApp(redis);

    const first = (await (await auth(a, `Bearer ${created.key}`)).json()) as { spendLimitIdr: number | null };
    expect(first.spendLimitIdr).toBeNull();

    const put = await authed(cookie, "PUT", `/api/keys/${created.id}/spend-limit`, {
      spend_limit_idr: 77777,
    });
    expect(put.status).toBe(200);
    expect(Object.keys(await redis.hgetall(`apikey:${hashOf(created.key)}`))).toHaveLength(0);

    const second = (await (await auth(a, `Bearer ${created.key}`)).json()) as { spendLimitIdr: number | null };
    expect(second.spendLimitIdr).toBe(77777);
  });

  test("context carries userId, keyPrefix and spentIdr with correct shapes", async () => {
    const cookie = await registerAndLogin("qa-auth-ctx@example.com");
    const created = await createKey(cookie, "ctx");
    const a = miniApp(redis);
    const ctx = (await (await auth(a, `Bearer ${created.key}`)).json()) as {
      id: string;
      userId: string;
      keyPrefix: string;
      isActive: boolean;
      spendLimitIdr: number | null;
      spentIdr: number;
    };
    expect(ctx.id).toBe(created.id);
    expect(ctx.keyPrefix).toBe(created.key.slice(0, 16));
    expect(ctx.isActive).toBe(true);
    expect(ctx.spentIdr).toBe(0);
    expect(ctx.spendLimitIdr).toBeNull();
    expect(Object.keys(ctx).sort()).toEqual(
      ["id", "isActive", "keyPrefix", "spendLimitIdr", "spentIdr", "userId"].sort(),
    );
  });

  test("a revoked key drops out of the cache and returns 401", async () => {
    const cookie = await registerAndLogin("qa-auth-revoke@example.com");
    const created = await createKey(cookie, "revoke");
    const a = miniApp(redis);
    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(200);

    const del = await authed(cookie, "DELETE", `/api/keys/${created.id}`);
    expect(del.status).toBe(200);
    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(401);
    expect(Object.keys(await redis.hgetall(`apikey:${hashOf(created.key)}`))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Redis degradation — the cache must never break a write path
// ---------------------------------------------------------------------------
describe("QA · Redis resilience", () => {
  test("Redis down during auth falls back to Postgres", async () => {
    const cookie = await registerAndLogin("qa-redis-down-auth@example.com");
    const created = await createKey(cookie, "redisdown");

    const downRedis = {
      hgetall: async () => {
        throw new Error("redis down");
      },
      multi: () => {
        throw new Error("redis down");
      },
      del: async () => {
        throw new Error("redis down");
      },
    } as unknown as Redis;

    const a = miniApp(downRedis);
    const res = await auth(a, `Bearer ${created.key}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(created.id);
  });

  test("Redis down during POST /api/keys must still create the key (cache is best-effort)", async () => {
    // Realistic ioredis outage model: multi() returns a pipeline; exec() rejects
    // (the "down" server is not reachable). This mirrors how lookupApiKey already
    // guards writeApiKeyCache with try/catch.
    const pipeline = {
      hset() {
        return this;
      },
      expire() {
        return this;
      },
      async exec(): Promise<never> {
        throw new Error("redis down");
      },
    };
    const brokenRedis = {
      multi: () => pipeline,
      del: async () => undefined,
      hgetall: async () => ({}),
    } as unknown as Redis;

    const brokenApp = createApp({ db, redis: brokenRedis, env });
    const cookie = await registerAndLogin("qa-redis-down-create@example.com");

    const res = await brokenApp.request("/api/keys", {
      method: "POST",
      headers: { cookie, ...J },
      body: JSON.stringify({ name: "created-while-redis-down" }),
    });

    // Desired contract: the DB write is authoritative; a cache failure is
    // best-effort and must NOT fail the request (batch-2-plan §3: "Redis down ->
    // fallback PG"). lookupApiKey wraps its cache write in try/catch; createApiKey
    // must do the same.
    const dbRow = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.name, "created-while-redis-down"));
    expect(dbRow).toHaveLength(1); // the row lands regardless
    expect(res.status).toBe(201); // but the response must not become a 500
  });
});

// ---------------------------------------------------------------------------
// 8. Redis content must never contain the raw key (INVARIANT §5.1)
// ---------------------------------------------------------------------------
describe("QA · Redis stores no raw key", () => {
  test("cache key is the sha256 and HASH values never include the raw key", async () => {
    const cookie = await registerAndLogin("qa-redis-noraw@example.com");
    const created = await createKey(cookie, "noraw");
    const a = miniApp(redis);
    expect((await auth(a, `Bearer ${created.key}`)).status).toBe(200);

    const hash = hashOf(created.key);
    const values = await redis.hgetall(`apikey:${hash}`);
    expect(Object.keys(values)).toHaveLength(6);
    const serialized = JSON.stringify(values);
    // The full raw key must never appear; only the display prefix may.
    expect(serialized).not.toContain(created.key);
    expect(serialized).not.toContain(created.key.slice(16)); // random tail

    // The raw key must not be a literal Redis key either.
    expect(await redis.keys("*sk-ktl*")).toHaveLength(0);
  });

  test("unknown key body is byte-identical to a missing-header body", async () => {
    const a = miniApp(redis);
    const missing = JSON.stringify(await (await auth(a)).json());
    const unknown = JSON.stringify(
      await (await auth(a, `Bearer sk-ktl-${"A".repeat(32)}`)).json(),
    );
    const malformed = JSON.stringify(await (await auth(a, "Bearer not-a-key")).json());
    expect(unknown).toBe(missing);
    expect(malformed).toBe(missing);
  });
});
