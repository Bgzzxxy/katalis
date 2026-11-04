import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { users } from "../src/db/schema";
import { verifyPassword } from "../src/services/auth.service";
import type { AppEnv } from "../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "./helpers/db";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

type UserBody = {
  id?: string;
  email?: string;
  wallet_balance_idr?: number;
  unlimited_expires_at?: Date | null;
  password_hash?: string;
  passwordHash?: string;
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

function toCookieHeader(pair: string): string {
  return pair.split(";")[0];
}

async function register(email: string, password: string) {
  return app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function login(email: string, password: string) {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function session(cookie?: string) {
  return app.request("/api/auth/session", {
    headers: cookie ? { cookie } : {},
  });
}

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("POST /api/auth/register", () => {
  test("registers a new email and stores an argon2id hash", async () => {
    const res = await register("ada@example.com", "password123");
    expect(res.status).toBe(201);
    const body = (await res.json()) as UserBody;
    expect(body.id).toEqual(expect.any(String));
    expect(body.email).toBe("ada@example.com");
    expect(body.passwordHash).toBeUndefined();

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, "ada@example.com"));
    expect(row).toBeTruthy();
    expect(row.passwordHash?.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("password123", row.passwordHash!)).toBe(true);
  });

  test("never returns password_hash in the response", async () => {
    const res = await register("bob@example.com", "password123");
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("password");
  });

  test("rejects duplicate email with EMAIL_TAKEN", async () => {
    await register("carol@example.com", "password123");
    const res = await register("carol@example.com", "password456");
    expect(res.status).toBe(400);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("EMAIL_TAKEN");
  });

  test("rejects invalid email and short password", async () => {
    const res = await register("not-an-email", "short");
    expect(res.status).toBe(400);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("is race-safe for parallel duplicate registration", async () => {
    const [a, b] = await Promise.all([
      register("dion@example.com", "password123"),
      register("dion@example.com", "password123"),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);
  });
});

describe("POST /api/auth/login", () => {
  test("returns session cookie with HttpOnly and katalis_session", async () => {
    await register("erin@example.com", "password123");
    const res = await login("erin@example.com", "password123");
    expect(res.status).toBe(200);

    const body = (await res.json()) as UserBody;
    expect(body.email).toBe("erin@example.com");
    expect(body.wallet_balance_idr).toBe(0);
    expect(body.unlimited_expires_at).toBeNull();
    expect(body.password_hash).toBeUndefined();

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("katalis_session=");
  });

  test("returns identical 401 for wrong password and unknown email", async () => {
    await register("fahmi@example.com", "password123");

    const wrongPassword = await login("fahmi@example.com", "password456");
    const unknownEmail = await login("ghost@example.com", "password123");

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);

    const bodyA = (await wrongPassword.json()) as OpenAiError;
    const bodyB = (await unknownEmail.json()) as OpenAiError;
    expect(bodyA).toEqual(bodyB);
    expect(bodyA.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/auth/session", () => {
  test("rejects missing cookie", async () => {
    const res = await session();
    expect(res.status).toBe(401);
    const body = (await res.json()) as OpenAiError;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("returns the logged-in user with a valid cookie", async () => {
    await register("gina@example.com", "password123");
    const loginRes = await login("gina@example.com", "password123");
    const cookie = toCookieHeader(loginRes.headers.get("set-cookie") ?? "");

    const res = await session(cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as UserBody;
    expect(body.id).toEqual(expect.any(String));
    expect(body.email).toBe("gina@example.com");
    expect(body.wallet_balance_idr).toBe(0);
    expect(body.unlimited_expires_at).toBeNull();
  });

  test("rejects a tampered cookie", async () => {
    await register("hani@example.com", "password123");
    const loginRes = await login("hani@example.com", "password123");
    const cookie = toCookieHeader(loginRes.headers.get("set-cookie") ?? "");
    const tampered = `${cookie.slice(0, -2)}xx`;

    const res = await session(tampered);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  test("clears the session cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("katalis_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});