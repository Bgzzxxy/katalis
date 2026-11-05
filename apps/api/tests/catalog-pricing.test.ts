// Pins the invariants the billing math depends on, and the round trip from the
// catalog module through GET /api/models. Prices themselves are audited against
// official upstream list price in knowledge/upstream-pricing.md — this test does
// not bake those numbers in, because a price change needs no test change, only a
// new doc row.
import { afterAll, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import type { AppEnv } from "../src/env";
import { MODEL_CATALOG, listModels } from "../src/services/model-catalog";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  closeDb,
} from "./helpers/db";

type ApiModelRow = {
  id: string;
  price_in_idr_per_1m: number;
  price_out_idr_per_1m: number;
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

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("model catalog pricing invariants", () => {
  test("the catalog is not empty (guards against a silent empty import)", () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  test("every price is a positive integer in micro-IDR", () => {
    const bad: string[] = [];
    for (const model of MODEL_CATALOG) {
      for (const [field, value] of [
        ["in", model.priceInMicroPer1M],
        ["out", model.priceOutMicroPer1M],
      ] as const) {
        if (!Number.isInteger(value) || value <= 0) {
          bad.push(`${model.id} ${field}=${value}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("output price is never below input price", () => {
    const bad = MODEL_CATALOG.filter(
      (m) => m.priceOutMicroPer1M < m.priceInMicroPer1M,
    ).map((m) => `${m.id}: out ${m.priceOutMicroPer1M} < in ${m.priceInMicroPer1M}`);
    expect(bad).toEqual([]);
  });

  test("prices fit in a safe integer when multiplied out by 1M tokens", () => {
    // token-meter multiplies tokens × micro-price before dividing by 1e6.
    // A catalog price above 2^53 / 1e6 would lose integer-exactness in real use.
    const limit = Number.MAX_SAFE_INTEGER / 1_000_000;
    const bad = MODEL_CATALOG.filter(
      (m) =>
        m.priceInMicroPer1M > limit || m.priceOutMicroPer1M > limit,
    ).map((m) => m.id);
    expect(bad).toEqual([]);
  });

  test("every model id is unique", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("listModels() returns an independent copy of the same rows", () => {
    const listed = listModels();
    expect(listed.map((m) => m.id)).toEqual(MODEL_CATALOG.map((m) => m.id));
    listed.pop();
    expect(listModels().length).toBe(MODEL_CATALOG.length);
  });
});

describe("GET /api/models echoes the catalog prices exactly", () => {
  test("status is 200 with a list envelope", async () => {
    const res = await app.request("/api/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; data: ApiModelRow[] };
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("ids and both prices match the imported catalog row for row", async () => {
    const res = await app.request("/api/models");
    const body = (await res.json()) as { data: ApiModelRow[] };

    expect(body.data.map((r) => r.id)).toEqual(MODEL_CATALOG.map((m) => m.id));

    const mismatches: string[] = [];
    for (const model of MODEL_CATALOG) {
      const row = body.data.find((r) => r.id === model.id);
      if (!row) {
        mismatches.push(`${model.id}: missing from /api/models`);
        continue;
      }
      if (row.price_in_idr_per_1m !== model.priceInMicroPer1M / 1_000_000) {
        mismatches.push(
          `${model.id}: in ${row.price_in_idr_per_1m} != ${model.priceInMicroPer1M / 1_000_000}`,
        );
      }
      if (row.price_out_idr_per_1m !== model.priceOutMicroPer1M / 1_000_000) {
        mismatches.push(
          `${model.id}: out ${row.price_out_idr_per_1m} != ${model.priceOutMicroPer1M / 1_000_000}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("every served price is a positive finite number", async () => {
    const res = await app.request("/api/models");
    const body = (await res.json()) as { data: ApiModelRow[] };
    for (const row of body.data) {
      for (const value of [row.price_in_idr_per_1m, row.price_out_idr_per_1m]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
