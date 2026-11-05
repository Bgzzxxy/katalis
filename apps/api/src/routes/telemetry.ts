import { Hono } from "hono";
import type Redis from "ioredis";
import type { Db } from "../db";
import { getTelemetry } from "../services/telemetry.service";

/** Public, read-only platform telemetry. Aggregation lives in the service. */
export function telemetryRoutes(db: Db, redis: Redis) {
  const app = new Hono();

  app.get("/", async (c) => {
    return c.json(await getTelemetry(db, redis), 200);
  });

  return app;
}