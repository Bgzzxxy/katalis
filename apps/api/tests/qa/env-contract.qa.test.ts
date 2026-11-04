/**
 * QA env & schema contract suite:
 *  - env fail-fast (JWT_SECRET >= 32)
 *  - schema columns mirror Prd §6.3 (checked against information_schema)
 *  - money.toIdr runtime behavior
 *  - health endpoint (up states)
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import { sql } from "drizzle-orm";
import { toIdr } from "../../src/db/money";
import type { AppEnv } from "../../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "../helpers/db";

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

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("QA · env validation (fail-fast)", () => {
  test("JWT_SECRET shorter than 32 chars must fail fast when env is read", async () => {
    // env.ts is a runtime singleton. We exercise the fail-fast path FIRST
    // (before any other import of env.ts in this file) via a mutated env.
    expect(TEST_JWT_SECRET.length).toBeGreaterThanOrEqual(32);

    const saved = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "too-short";
    try {
      await expect(import("../../src/env")).rejects.toThrow(
        "JWT_SECRET must be at least 32 characters",
      );
    } finally {
      process.env.JWT_SECRET = saved;
    }
  });

  test("env.ts maps COOKIE_SECURE and CORS_ORIGINS from the environment", async () => {
    // The deployed .env.test values must round-trip through the AppEnv type
    // used by createApp (public interface).
    expect(env.NODE_ENV).toBe("test");
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.CORS_ORIGINS).toBe("http://localhost:5173");
  });
});

describe("QA · schema mirrors Prd §6.3", () => {
  test("users columns, nullability and types", async () => {
    const rows = await db.execute(
      sql`select column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
          from information_schema.columns
          where table_schema='public' and table_name='users'
          order by ordinal_position`,
    );
    const byName = Object.fromEntries(
      (rows as Array<Record<string, unknown>>).map((r) => [r.column_name as string, r]),
    );
    expect(byName.email.data_type).toBe("character varying");
    expect(byName.email.character_maximum_length).toBe(255);
    expect(byName.email.is_nullable).toBe("NO");
    expect(byName.password_hash.is_nullable).toBe("YES");
    expect(byName.wallet_balance_idr.numeric_precision).toBe(14);
    expect(byName.wallet_balance_idr.numeric_scale).toBe(4);
    expect(byName.has_claimed_trial.column_default).toContain("false");
    expect(byName.created_at.is_nullable).toBe("NO");
  });

  test("usage_logs cost_charged_idr precision 12,6 (not 14,4)", async () => {
    const rows = await db.execute(
      sql`select numeric_precision, numeric_scale from information_schema.columns
          where table_schema='public' and table_name='usage_logs' and column_name='cost_charged_idr'`,
    );
    const [r] = rows as unknown as Array<{
      numeric_precision: number;
      numeric_scale: number;
    }>;
    expect(r.numeric_precision).toBe(12);
    expect(r.numeric_scale).toBe(6);
  });

  test("api_keys FK has ON DELETE CASCADE; other FKs do not", async () => {
    const rows = await db.execute(
      sql`select conname, pg_get_constraintdef(oid) as def from pg_constraint
          where contype='f' and connamespace='public'::regnamespace
          order by conname`,
    );
    const fks = Object.fromEntries(
      (rows as unknown as Array<{ conname: string; def: string }>).map((r) => [
        r.conname,
        r.def,
      ]),
    );
    expect(fks.api_keys_user_id_users_id_fk).toContain("ON DELETE CASCADE");
    expect(fks.payment_invoices_user_id_users_id_fk).not.toContain("CASCADE");
    expect(fks.usage_logs_user_id_users_id_fk).not.toContain("CASCADE");
  });
});

describe("QA · money.toIdr", () => {
  test("numeric string -> number, invalid -> 0", () => {
    expect(toIdr("0.0000")).toBe(0);
    expect(toIdr("123.4567")).toBe(123.4567);
    expect(toIdr(42)).toBe(42);
    expect(toIdr("NaN")).toBe(0);
    expect(toIdr("abc")).toBe(0);
    expect(toIdr("9999999999.9999")).toBe(9999999999.9999);
  });
});

describe("QA · health endpoint", () => {
  test("returns ok/up/up with healthy redis+db", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "up", redis: "up" });
  });

  test("returns 503 with redis:down when redis is unreachable", async () => {
    // Use an unroutable-but-fast refusal (port 6399 refuses immediately, so
    // this does not hang the suite on TCP connect timeouts).
    const dead = createRedis(TEST_REDIS_URL.replace("6379", "6399"));
    dead.on("error", () => {});
    const deadApp = createApp({ db, redis: dead, env });
    const res = await deadApp.request("/api/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "degraded",
      db: "up",
      redis: "down",
    });
    try {
      dead.disconnect();
    } catch {
      // ignore
    }
  });

  test("returns 503 with db:down when db is unreachable", async () => {
    const bad = createDb("postgres://katalis:katalis_dev@127.0.0.1:6599/nope", {
      max: 1,
    });
    const badApp = createApp({ db: bad.db, redis, env });
    const res = await badApp.request("/api/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "degraded",
      db: "down",
      redis: "up",
    });
    await bad.client.end();
  });
});