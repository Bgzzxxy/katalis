import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import { paymentInvoices, users } from "../src/db/schema";
import { toIdr } from "../src/db/money";
import type { AppEnv } from "../src/env";
import {
  closeDb,
  resetDb,
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
} from "./helpers/db";
import { clearApiKeyCache } from "./helpers/redis";
import { cookieHeader } from "./helpers/http";
import { createFakeQrisProvider, QRIS_TEST_SECRET } from "./helpers/qris";

type OpenAiError = {
  error: { message: string; type: string; param: string | null; code: string };
};

type InvoiceView = {
  id: string;
  plan_type: string;
  total_pay_idr: number;
  qris_string: string;
  status: string;
  expires_at: string;
};

type InvoiceStatusView = {
  id: string;
  plan_type: string;
  status: string;
  total_pay_idr: number;
  paid_at: string | null;
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
  QRIS_PROVIDER: "TRIPAY",
  QRIS_WEBHOOK_SECRET: QRIS_TEST_SECRET,
};

function buildApp() {
  return createApp({ db, redis, env, qris: createFakeQrisProvider() });
}

const app = buildApp();

async function register(email: string, password = "password123") {
  const res = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(201);
}

async function login(email: string, password = "password123"): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  return cookieHeader(res.headers, "katalis_session") ?? "";
}

async function authed(cookie: string, method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function getUserId(email: string): Promise<string> {
  const [row] = await db
    .select({ id: users.id, hasClaimedTrial: users.hasClaimedTrial })
    .from(users)
    .where(eq(users.email, email));
  return row?.id ?? "";
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
  await db.execute(sql`TRUNCATE TABLE usage_logs, payment_invoices, api_keys, users RESTART IDENTITY CASCADE`);
  await clearApiKeyCache(redis);
  for (const key of await redis.keys("wallet:*")) await redis.del(key);
});

describe("POST /api/billing/invoices", () => {
  test("creates a PREPAID invoice from the custom amount and returns its QRIS string", async () => {
    await register("b-p1@example.com");
    const cookie = await login("b-p1@example.com");

    const res = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 50000,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as InvoiceView;
    expect(/^INV-KTL-\d{8}-[1-9A-HJ-NP-Za-km-z]{5}$/.test(body.id)).toBe(true);
    expect(body.plan_type).toBe("PREPAID");
    expect(body.total_pay_idr).toBe(50000);
    expect(body.qris_string).toContain("qr://");
    expect(body.status).toBe("PENDING");
    expect(new Date(body.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  test("claims TRIAL_1D once and rejects the second claim", async () => {
    await register("b-t1@example.com");
    const cookie = await login("b-t1@example.com");

    const first = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(first.status).toBe(201);

    const second = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(second.status).toBe(400);
    expect(((await second.json()) as OpenAiError).error.code).toBe("TRIAL_ALREADY_CLAIMED");
  });

  test("rejects an unknown plan_type", async () => {
    await register("b-p2@example.com");
    const cookie = await login("b-p2@example.com");

    const res = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "GOLD_999",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVALID_PLAN");
  });

  test("rejects a PREPAID amount outside the allowed range", async () => {
    await register("b-p3@example.com");
    const cookie = await login("b-p3@example.com");

    const low = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 4999,
    });
    expect(low.status).toBe(400);
    expect(((await low.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");

    const high = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "PREPAID",
      custom_amount_idr: 1000001,
    });
    expect(high.status).toBe(400);
    expect(((await high.json()) as OpenAiError).error.code).toBe("VALIDATION_ERROR");
  });

  test("does not allow double booking the trial when the provider fails", async () => {
    await register("b-t2@example.com");
    const cookie = await login("b-t2@example.com");

    const failing = createApp({
      db,
      redis,
      env,
      qris: createFakeQrisProvider({ failCreate: true }),
    });
    const res = await failing.request("/api/billing/invoices", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ plan_type: "TRIAL_1D" }),
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as OpenAiError).error.code).toBe("PAYMENT_GATEWAY_ERROR");

    const [row] = await db
      .select({ hasClaimedTrial: users.hasClaimedTrial })
      .from(users)
      .where(eq(users.email, "b-t2@example.com"));
    expect(row?.hasClaimedTrial).toBe(false);

    const retry = await authed(cookie, "POST", "/api/billing/invoices", {
      plan_type: "TRIAL_1D",
    });
    expect(retry.status).toBe(201);
  });
});

describe("GET /api/billing/invoices/:id/status", () => {
  test("returns the owner's invoice status", async () => {
    await register("b-s1@example.com");
    const cookie = await login("b-s1@example.com");
    const created = (await (
      await authed(cookie, "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: 50000,
      })
    ).json()) as InvoiceView;

    const res = await authed(cookie, "GET", `/api/billing/invoices/${created.id}/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvoiceStatusView;
    expect(body.id).toBe(created.id);
    expect(body.plan_type).toBe("PREPAID");
    expect(body.status).toBe("PENDING");
    expect(body.total_pay_idr).toBe(50000);
    expect(body.paid_at).toBeNull();
  });

  test("isolates status lookups between users (uniform 404)", async () => {
    await register("b-s2@example.com");
    await register("b-s3@example.com");
    const cookieB = await login("b-s3@example.com");
    const created = (await (
      await authed(await login("b-s2@example.com"), "POST", "/api/billing/invoices", {
        plan_type: "PREPAID",
        custom_amount_idr: 50000,
      })
    ).json()) as InvoiceView;

    const res = await authed(cookieB, "GET", `/api/billing/invoices/${created.id}/status`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as OpenAiError).error.code).toBe("INVOICE_NOT_FOUND");
  });
});