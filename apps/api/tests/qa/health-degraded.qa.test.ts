/**
 * QA health-degraded suite.
 *
 * BUG #4 (reported): when Redis is unreachable, ioredis retries in the
 * background and `pingRedis()` awaits the offline queue, so GET /api/health
 * blocks for ~73 seconds before answering 503. A container/orchestrator
 * health probe (typical timeout 1-5s) would kill the API before it ever
 * reports "degraded".
 *
 * The test below asserts the *serviceability* contract (must answer within a
 * health-check budget). It is expected to FAIL until the bug is fixed; the
 * guaranteed 503 contract itself is asserted in env-contract.qa.test.ts.
 */
import { afterAll, describe, expect, test } from "vitest";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import { createRedis } from "../../src/db/redis";
import type { AppEnv } from "../../src/env";
import { TEST_DB_URL, TEST_REDIS_URL, TEST_JWT_SECRET } from "../helpers/db";

const { client: dbClient, db } = createDb(TEST_DB_URL, { max: 1 });

const env: AppEnv = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  NODE_ENV: "test",
  COOKIE_SECURE: false,
  CORS_ORIGINS: "http://localhost:5173",
};

afterAll(async () => {
  await dbClient.end();
});

describe("QA · health degradation latency", () => {
  test(
    "[BUG] /api/health must answer within a 5s health-check budget when redis is unreachable",
    async () => {
      const dead = createRedis("redis://127.0.0.1:6399");
      dead.on("error", () => {});
      const deadApp = createApp({ db, redis: dead, env });

      const t = performance.now();
      const res = await deadApp.request("/api/health");
      const ms = performance.now() - t;
      const body = (await res.json()) as {
        status: string;
        db: string;
        redis: string;
      };

      console.log(
        `[QA-EVIDENCE health-redis-unreachable] status=${res.status} elapsedMs=${ms.toFixed(0)} body=${JSON.stringify(body)}`,
      );

      // Contract that DOES hold today (kept so a regression is still caught):
      expect(res.status).toBe(503);
      expect(body).toEqual({ status: "degraded", db: "up", redis: "down" });

      // Serviceability contract that FAILS today:
      expect(ms).toBeLessThan(5000);

      try {
        dead.disconnect();
      } catch {
        // ignore
      }
    },
    120000,
  );
});