import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./routes/auth";
import { keysRoutes } from "./routes/keys";
import { v1ProxyRoutes } from "./routes/v1-proxy";
import { pingDb, type Db } from "./db";
import type Redis from "ioredis";
import { pingRedis } from "./db/redis";
import type { RouterConfig } from "./services/upstream-router";
import { billingRoutes } from "./routes/billing";
import { webhooksQrisRoutes } from "./routes/webhooks-qris";
import {
  createQrisProvider,
  type QrisProvider,
} from "./services/qris-provider";

export type AppDeps = {
  db: Db;
  redis: Redis;
  env: AppEnv;
  // Injectable upstream seam for offline tests. When omitted, the real
  // provider catalog is built from env (no paid upstream is touched in tests).
  upstream?: RouterConfig;
  // Injectable QRIS seam for offline tests. When omitted, the provider is
  // built from env; QRIS_PROVIDER is unset in dev/test until configured.
  qris?: QrisProvider | null;
};

export function createApp(deps: AppDeps) {
  const { db, redis, env, upstream } = deps;
  const qris = deps.qris !== undefined ? deps.qris : createQrisProvider(env);
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
  app.route("/api/keys", keysRoutes(db, redis, env));
  app.route("/v1", v1ProxyRoutes(db, redis, env, upstream));
  app.route("/api/billing", billingRoutes(db, redis, env, qris));
  app.route("/api/webhooks", webhooksQrisRoutes(db, redis, qris));

  return app;
}