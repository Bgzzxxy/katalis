import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type Redis from "ioredis";
import type { Db } from "../db";
import type { QrisProvider } from "../services/qris-provider";
import { settleWebhook } from "../services/qris.service";
import { AppError } from "../middleware/error-handler";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export function webhooksQrisRoutes(db: Db, redis: Redis, provider: QrisProvider | null) {
  const app = new Hono();

  app.post("/qris", bodyLimit({ maxSize: MAX_WEBHOOK_BODY_BYTES }), async (c) => {
    // Read the raw body ONCE: signatures are over the exact bytes, and parsing
    // with c.req.json() would consume the stream before verification.
    const rawBody = await c.req.text();

    if (!provider?.verifySignature(new Headers(c.req.raw.headers), rawBody)) {
      throw new AppError(403, "INVALID_SIGNATURE", "Tanda tangan webhook tidak valid", {
        type: "authentication_error",
      });
    }

    const event = (provider as QrisProvider).parseWebhook(rawBody);
    if (!event) {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload webhook tidak valid", {
        type: "invalid_request_error",
      });
    }

    const result = await settleWebhook(db, redis, event.providerRef, event.status);
    return c.json(result, 200);
  });

  return app;
}