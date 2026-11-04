/**
 * QA adversarial suite — inputs the developer tests do NOT cover.
 * Findings are documented as PROBE + ASSERT pairs: the probe is printed so a
 * failure carries its own reproduction evidence, then the assertion states the
 * guaranteed behavior from the plan / Prd.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { users } from "../../src/db/schema";
import { sign } from "hono/jwt";
import type { AppEnv } from "../../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "../helpers/db";

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
};

const app = createApp({ db, redis, env });

const J = { "content-type": "application/json" };
const post = (p: string, b: unknown, h: Record<string, string> = J) =>
  app.request(p, { method: "POST", headers: h, body: JSON.stringify(b) });
const rawPost = (p: string, body: string | null, h: Record<string, string> = J) =>
  app.request(p, { method: "POST", headers: h, body });
const cookiePair = (res: Response) =>
  (res.headers.get("set-cookie") ?? "").split(";")[0];

let seq = 0;
const email = (tag = "u") => `qa.${tag}.${Date.now()}.${seq++}@example.com`;

async function envelope(res: Response): Promise<OpenAiError | string> {
  const text = await res.text();
  try {
    return JSON.parse(text) as OpenAiError;
  } catch {
    return text;
  }
}

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("QA · password boundary behavior", () => {
  test("password exactly 8 chars accepted; 7 chars rejected", async () => {
    const ok = await post("/api/auth/register", {
      email: email("pw8"),
      password: "a".repeat(8),
    });
    expect(ok.status).toBe(201);

    const short = await post("/api/auth/register", {
      email: email("pw7"),
      password: "a".repeat(7),
    });
    expect(short.status).toBe(400);
    expect(((await short.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });

  test("password exactly 72 chars accepted; 73 chars rejected on register and login", async () => {
    const em = email("pw72");
    const ok = await post("/api/auth/register", { email: em, password: "a".repeat(72) });
    expect(ok.status).toBe(201);

    const tooLong = await post("/api/auth/register", {
      email: email("pw73"),
      password: "a".repeat(73),
    });
    expect(tooLong.status).toBe(400);

    const login73 = await post("/api/auth/login", {
      email: em,
      password: "a".repeat(73),
    });
    expect(login73.status).toBe(400);
    expect(((await login73.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");

    const login72 = await post("/api/auth/login", {
      email: em,
      password: "a".repeat(72),
    });
    expect(login72.status).toBe(200);
  });

  test("1-char and empty passwords -> 400 VALIDATION_ERROR (never 500)", async () => {
    for (const pw of ["x", ""]) {
      const res = await post("/api/auth/register", { email: email("short"), password: pw });
      expect(res.status).toBe(400);
      expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("argon2 hashes are salted (same password -> different hashes)", async () => {
    const em1 = email("salt1");
    const em2 = email("salt2");
    await post("/api/auth/register", { email: em1, password: "identicalpassword" });
    await post("/api/auth/register", { email: em2, password: "identicalpassword" });
    const [r1] = await db.select().from(users).where(eq(users.email, em1));
    const [r2] = await db.select().from(users).where(eq(users.email, em2));
    expect(r1.passwordHash).not.toBe(r2.passwordHash);
  });
});

describe("QA · email normalization", () => {
  test("email differing only by CASE must not create a second account for the same human", async () => {
    const em = email("case");
    const lower = await post("/api/auth/register", { email: em, password: "password123" });
    expect(lower.status).toBe(201);

    const upper = await post("/api/auth/register", {
      email: em.toUpperCase(),
      password: "password456",
    });
    console.log(
      `[QA-EVIDENCE case-variant] register lower=${lower.status} register UPPER=${upper.status}`,
    );
    const rows = await db.execute(
      sql`select email from users where lower(email) = lower(${em})`,
    );
    console.log(`[QA-EVIDENCE case-variant] rows matching lower(email): ${JSON.stringify(rows)}`);
    // Guaranteed behavior: one human -> one account (anti trial-abuse, Prd §7).
    expect(upper.status).toBe(400);
    expect(rows.length).toBe(1);
  });

  test("login with differently-cased email must reach the same account", async () => {
    const em = email("login.case");
    await post("/api/auth/register", { email: em, password: "password123" });
    const res = await post("/api/auth/login", {
      email: em.toUpperCase(),
      password: "password123",
    });
    console.log(`[QA-EVIDENCE login-case] login with UPPER-cased email -> ${res.status}`);
    expect(res.status).toBe(200);
  });

  test("email with surrounding whitespace is rejected by validation (not silently stored)", async () => {
    const em = email("ws");
    const res = await post("/api/auth/register", {
      email: `  ${em}  `,
      password: "password123",
    });
    console.log(`[QA-EVIDENCE whitespace] register '  <email>  ' -> ${res.status}`);
    expect(res.status).toBe(400);
    // The trimmed form must therefore NOT exist (no phantom account created).
    const rows = await db.select().from(users).where(eq(users.email, em));
    expect(rows).toHaveLength(0);
  });

  test("email longer than varchar(255) must yield 4xx, not 500", async () => {
    const res = await post("/api/auth/register", {
      email: `${"a".repeat(250)}@example.com`,
      password: "password123",
    });
    const body = await envelope(res);
    console.log(`[QA-EVIDENCE long-email] 262-char email -> ${res.status} ${JSON.stringify(body)}`);
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
    expect((body as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("QA · malformed request bodies", () => {
  test("malformed JSON body must not surface as 500", async () => {
    const res = await rawPost("/api/auth/register", "{not json");
    const body = await envelope(res);
    console.log(`[QA-EVIDENCE malformed-json] -> ${res.status} ${JSON.stringify(body)}`);
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
  });

  test("missing body with JSON content-type must not surface as 500", async () => {
    const res = await rawPost("/api/auth/register", null);
    const body = await envelope(res);
    console.log(`[QA-EVIDENCE empty-body] -> ${res.status} ${JSON.stringify(body)}`);
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
  });

  test("non-object JSON bodies -> 400 VALIDATION_ERROR", async () => {
    for (const raw of ["null", "[]", '"a string"', "123", "true"]) {
      const res = await rawPost("/api/auth/login", raw);
      const body = (await res.json()) as OpenAiError;
      console.log(`[QA-EVIDENCE non-object ${raw}] -> ${res.status} ${body.error.code}`);
      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("wrong content-type -> 400 VALIDATION_ERROR, never 500", async () => {
    const res = await rawPost(
      "/api/auth/register",
      JSON.stringify({ email: email("ct"), password: "password123" }),
      { "content-type": "text/plain" },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("QA · routing and method handling", () => {
  test("unmatched methods and routes must use the OpenAI error envelope, not plain text", async () => {
    const cases: Array<[string, string]> = [
      ["GET", "/api/auth/register"],
      ["POST", "/api/auth/session"],
      ["GET", "/api/auth/logout"],
      ["POST", "/api/auth/register/"],
      ["POST", "/api/auth/nope"],
      ["GET", "/api/definitely-not-a-route"],
    ];
    for (const [method, path] of cases) {
      const res = await app.request(path, { method });
      const body = await envelope(res);
      console.log(
        `[QA-EVIDENCE 404 ${method} ${path}] -> ${res.status} ${JSON.stringify(body)}`,
      );
      expect(res.status).toBe(404);
      // Plan §3.3: ALL /api/* errors use {error:{message,type,param,code}}.
      expect(typeof body).toBe("object");
      expect((body as OpenAiError).error?.code).toBeTruthy();
    }
  });
});

describe("QA · session token handling", () => {
  test("alg:none token is rejected", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "11111111-1111-4111-8111-111111111111",
        email: "attacker@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const res = await app.request("/api/auth/session", {
      headers: { cookie: `katalis_session=${header}.${payload}.` },
    });
    expect(res.status).toBe(401);
  });

  test("token signed with the wrong secret is rejected", async () => {
    const token = await sign(
      {
        sub: "11111111-1111-4111-8111-111111111111",
        email: "attacker@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "a-different-secret-that-is-32-chars-long!!",
      "HS256",
    );
    const res = await app.request("/api/auth/session", {
      headers: { cookie: `katalis_session=${token}` },
    });
    expect(res.status).toBe(401);
  });

  test("expired token is rejected", async () => {
    const em = email("expired");
    await post("/api/auth/register", { email: em, password: "password123" });
    const [row] = await db.select().from(users).where(eq(users.email, em));
    const token = await sign(
      { sub: row.id, email: em, exp: Math.floor(Date.now() / 1000) - 10 },
      TEST_JWT_SECRET,
      "HS256",
    );
    const res = await app.request("/api/auth/session", {
      headers: { cookie: `katalis_session=${token}` },
    });
    expect(res.status).toBe(401);
  });

  test("valid signature but non-UUID sub must not surface as 500", async () => {
    const token = await sign(
      { sub: "not-a-uuid", email: "ghost@example.com", exp: Math.floor(Date.now() / 1000) + 3600 },
      TEST_JWT_SECRET,
      "HS256",
    );
    const res = await app.request("/api/auth/session", {
      headers: { cookie: `katalis_session=${token}` },
    });
    const body = await envelope(res);
    console.log(`[QA-EVIDENCE non-uuid-sub] -> ${res.status} ${JSON.stringify(body)}`);
    expect(res.status).toBe(401);
  });

  test("cookie with multiple pairs still resolves the session", async () => {
    const em = email("multi");
    await post("/api/auth/register", { email: em, password: "password123" });
    const loginRes = await post("/api/auth/login", { email: em, password: "password123" });
    const res = await app.request("/api/auth/session", {
      headers: { cookie: `theme=dark; ${cookiePair(loginRes)}; other=1` },
    });
    expect(res.status).toBe(200);
  });

  test("logout clears the cookie but does NOT revoke an already-issued token (stateless JWT)", async () => {
    const em = email("replay");
    await post("/api/auth/register", { email: em, password: "password123" });
    const loginRes = await post("/api/auth/login", { email: em, password: "password123" });
    const pair = cookiePair(loginRes);

    await app.request("/api/auth/logout", { method: "POST" });
    const res = await app.request("/api/auth/session", { headers: { cookie: pair } });
    console.log(`[QA-EVIDENCE logout-replay] session with pre-logout cookie -> ${res.status}`);
    // Documented as a limitation, not a Batch 1 blocker: no server-side denylist exists.
    expect(res.status).toBe(200);
  });
});

describe("QA · mass assignment", () => {
  test("injected user fields are ignored by register", async () => {
    const em = email("mass");
    const res = await post("/api/auth/register", {
      email: em,
      password: "password123",
      id: "11111111-1111-4111-8111-111111111111",
      passwordHash: "$argon2id$v=19$m=1,t=1,p=1$aaaaaaaaaaaaaaaa$bbbb",
      walletBalanceIdr: "999999",
      wallet_balance_idr: 999999,
      hasClaimedTrial: true,
      unlimitedExpiresAt: "2020-01-01T00:00:00Z",
      isAdmin: true,
    });
    expect(res.status).toBe(201);
    const [row] = await db.select().from(users).where(eq(users.email, em));
    expect(row.id).not.toBe("11111111-1111-4111-8111-111111111111");
    expect(row.walletBalanceIdr).toBe("0.0000");
    expect(row.hasClaimedTrial).toBe(false);
    expect(row.unlimitedExpiresAt).toBeNull();
    expect(row.passwordHash?.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
  });

  test("login response never contains password_hash or google_id", async () => {
    const em = email("noshape");
    await post("/api/auth/register", { email: em, password: "password123" });
    const res = await post("/api/auth/login", { email: em, password: "password123" });
    const text = await res.text();
    expect(text).not.toContain("password");
    expect(text).not.toContain("google");
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "email",
      "id",
      "unlimited_expires_at",
      "wallet_balance_idr",
    ]);
  });
});

describe("QA · anti-enumeration timing", () => {
  test("wrong-password and unknown-email paths consume comparable time", async () => {
    const em = email("timing");
    await post("/api/auth/register", { email: em, password: "password123" });

    const sample = async (fn: () => Promise<Response>, n = 5) => {
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const t = performance.now();
        await fn();
        out.push(performance.now() - t);
      }
      return out;
    };
    const wrongPw = await sample(
      async () =>
        await post("/api/auth/login", { email: em, password: "definitelywrong" }),
    );
    const unknown = await sample(
      async () =>
        await post("/api/auth/login", {
          email: email("ghost"),
          password: "definitelywrong",
        }),
    );
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const a = avg(wrongPw);
    const b = avg(unknown);
    console.log(
      `[QA-EVIDENCE timing] wrong-pw avg=${a.toFixed(1)}ms unknown-email avg=${b.toFixed(1)}ms ratio=${(a / b).toFixed(1)}x`,
    );
    // A ratio > 5x is a practical user-enumeration oracle.
    expect(a / b).toBeLessThan(5);
  });
});