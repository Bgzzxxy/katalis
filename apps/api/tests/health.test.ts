import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { createRedis } from "../src/db/redis";
import type { AppEnv } from "../src/env";
import {
  TEST_DB_URL,
  TEST_REDIS_URL,
  TEST_JWT_SECRET,
  resetDb,
  closeDb,
} from "./helpers/db";

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

type HealthBody = {
  status: string;
  db: string;
  redis: string;
};

beforeAll(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await redis.quit();
  await closeDb(dbClient);
});

describe("GET /api/health", () => {
  test("returns ok when db and redis are up", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "up", redis: "up" });
  });

  test("returns 503 when redis is down", async () => {
    const deadRedis = createRedis(TEST_REDIS_URL);
    await deadRedis.disconnect();

    const deadApp = createApp({ db, redis: deadRedis, env });
    const res = await deadApp.request("/api/health");
    expect(res.status).toBe(503);
    expect(((await res.json()) as HealthBody).redis).toBe("down");
    try {
      await deadRedis.quit();
    } catch {
      // ioredis throws "Connection is closed" when quit follows disconnect.
    }
  });

  test("returns 503 when db is down", async () => {
    const badDb = createDb(
      "postgres://katalis:katalis_dev@127.0.0.1:6599/nope",
      { max: 1 },
    );
    const badApp = createApp({ db: badDb.db, redis, env });
    const res = await badApp.request("/api/health");
    expect(res.status).toBe(503);
    expect(((await res.json()) as HealthBody).db).toBe("down");
    await badDb.client.end();
  });
});