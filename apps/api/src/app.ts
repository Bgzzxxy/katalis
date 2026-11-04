import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./routes/auth";
import { pingDb, type Db } from "./db";
import type Redis from "ioredis";
import { pingRedis } from "./db/redis";

export type AppDeps = {
  db: Db;
  redis: Redis;
  env: AppEnv;
};

export function createApp(deps: AppDeps) {
  const { db, redis, env } = deps;
  const app = new Hono();

  app.onError(errorHandler);

  app.notFound((c) => {
    return c.json(
      {
        error: {
          message: "Route not found",
          type: "invalid_request_error",
          param: null,
          code: "NOT_FOUND",
        },
      },
      404,
    );
  });

  // CORS_ORIGINS is consumed from env from Batch 1 because the Vite dev server
  // runs on a different port and Batch 5 needs it for cookie-based sessions.
  app.use(
    "/api/*",
    cors({
      origin: env.CORS_ORIGINS
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      credentials: true,
    }),
  );

  app.get("/api/health", async (c) => {
    const dbUp = await pingDb(db);
    const redisUp = await pingRedis(redis);

    if (!dbUp || !redisUp) {
      return c.json(
        {
          status: "degraded",
          db: dbUp ? "up" : "down",
          redis: redisUp ? "up" : "down",
        },
        503,
      );
    }

    return c.json({ status: "ok", db: "up", redis: "up" }, 200);
  });

  app.route("/api/auth", authRoutes(db, env));

  return app;
}