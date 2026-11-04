/**
 * QA independent verification of the Batch 1 auth contract (plan §4 Langkah 4).
 * This file REPLICATES the 10 developer test cases with additional, stricter
 * assertions on cookie attributes and anti-enumeration response equality.
 * It does NOT overwrite the developer's tests/auth.test.ts.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { users } from "../../src/db/schema";
import { verifyPassword } from "../../src/services/auth.service";
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

type UserBody = {
  id?: string;
  email?: string;
  wallet_balance_idr?: number;
  unlimited_expires_at?: unknown;
  [k: string]: unknown;
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
const cookiePair = (res: Response) =>
  (res.headers.get("set-cookie") ?? "").split(";")[0];

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("QA · auth contract (regression of plan §4)", () => {
  test("1 register new email -> 201 and argon2id hash verifies, hash never serialized", async () => {
    const res = await post("/api/auth/register", {
      email: "qa.ada@example.com",
      password: "password123",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as UserBody;
    expect(body.id).toEqual(expect.any(String));
    expect(body.email).toBe("qa.ada@example.com");
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("hash");

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, "qa.ada@example.com"));
    expect(row).toBeTruthy();
    expect(row.passwordHash?.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    expect(await verifyPassword("password123", row.passwordHash!)).toBe(true);
  });

  test("2 register response never contains password_hash for any shape", async () => {
    const res = await post("/api/auth/register", {
      email: "qa.bob@example.com",
      password: "password123",
    });
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("passwordHash");
  });

  test("3 duplicate email -> 400 EMAIL_TAKEN", async () => {
    await post("/api/auth/register", {
      email: "qa.carol@example.com",
      password: "password123",
    });
    const res = await post("/api/auth/register", {
      email: "qa.carol@example.com",
      password: "password456",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("EMAIL_TAKEN");
    expect(body.error.param).toBe("email");
  });

  test("4 invalid email / short password -> 400 VALIDATION_ERROR", async () => {
    const r1 = await post("/api/auth/register", {
      email: "not-an-email",
      password: "short",
    });
    expect(r1.status).toBe(400);
    expect(((await r1.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");

    const r2 = await post("/api/auth/register", {
      email: "ok@example.com",
      password: "1234567",
    });
    expect(r2.status).toBe(400);
    expect(((await r2.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });

  test("5 parallel duplicate register (Promise.all) -> exactly one 201", async () => {
    const [a, b] = await Promise.all([
      post("/api/auth/register", {
        email: "qa.dion@example.com",
        password: "password123",
      }),
      post("/api/auth/register", {
        email: "qa.dion@example.com",
        password: "password123",
      }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, "qa.dion@example.com"));
    expect(rows).toHaveLength(1);
  });

  test("6 login correct -> Set-Cookie has katalis_session + HttpOnly + SameSite=Lax + Path=/", async () => {
    await post("/api/auth/register", {
      email: "qa.erin@example.com",
      password: "password123",
    });
    const res = await post("/api/auth/login", {
      email: "qa.erin@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("katalis_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie).not.toContain("Secure");
  });

  test("7 wrong password and unknown email -> identical 401 INVALID_CREDENTIALS", async () => {
    await post("/api/auth/register", {
      email: "qa.fahmi@example.com",
      password: "password123",
    });
    const wrongPw = await post("/api/auth/login", {
      email: "qa.fahmi@example.com",
      password: "password456",
    });
    const unknown = await post("/api/auth/login", {
      email: "qa.ghost@example.com",
      password: "password123",
    });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = (await wrongPw.json()) as OpenAiError;
    const b = (await unknown.json()) as OpenAiError;
    expect(a).toEqual(b);
    expect(a.error.code).toBe("INVALID_CREDENTIALS");
    expect(a.error.type).toBe("auth_error");
    expect(a.error.param).toBeNull();
  });

  test("8 GET /api/auth/session: no cookie -> 401, valid cookie -> 200", async () => {
    const noCookie = await app.request("/api/auth/session");
    expect(noCookie.status).toBe(401);
    expect(((await noCookie.json()) as OpenAiError).error.code).toBe("UNAUTHENTICATED");

    await post("/api/auth/register", {
      email: "qa.gina@example.com",
      password: "password123",
    });
    const loginRes = await post("/api/auth/login", {
      email: "qa.gina@example.com",
      password: "password123",
    });
    const res = await app.request("/api/auth/session", {
      headers: { cookie: cookiePair(loginRes) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as UserBody;
    expect(body.email).toBe("qa.gina@example.com");
    expect(body.wallet_balance_idr).toBe(0);
    expect(body.unlimited_expires_at).toBeNull();
  });

  test("9 POST /api/auth/logout -> 200 {ok:true} + Max-Age=0 cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("katalis_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  test("10 tampered cookie -> 401 (HS256 verification enforced)", async () => {
    await post("/api/auth/register", {
      email: "qa.hani@example.com",
      password: "password123",
    });
    const loginRes = await post("/api/auth/login", {
      email: "qa.hani@example.com",
      password: "password123",
    });
    const pair = cookiePair(loginRes);
    const tampered = `${pair.slice(0, -2)}xx`;
    const res = await app.request("/api/auth/session", {
      headers: { cookie: tampered },
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as OpenAiError).error.code).toBe("UNAUTHENTICATED");
  });
});